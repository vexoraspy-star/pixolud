"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildSurvivor, type Survivor } from "@/lib/backroomsCharacters";
import { makeCeilingTiles, makeHallCarpet, makeHallWallpaper, makeLightPanel } from "@/lib/backroomsTextures";

/**
 * Salon du groupe en 3D : une piece du Hall, et les survivants du groupe
 * alignes face a la camera. Quand quelqu'un rejoint, son personnage entre
 * par le cote en marchant jusqu'a sa place ; quand il parle, les barres
 * s'allument au-dessus de sa tete.
 */

export interface StageMember {
  id: string;
  name: string;
  /** Rang d'arrivee : donne la couleur de la veste. */
  color: number;
}

interface Actor {
  id: string;
  survivor: Survivor;
  x: number;
  targetX: number;
  walk: number;
  speed: number;
  /** Petit decalage pour que les survivants ne bougent pas en rythme. */
  phase: number;
  lookYaw: number;
  nextLookAt: number;
}

const SLOT_GAP = 1.25;

export default function BackroomsLobbyStage({
  members,
  speaking,
}: {
  members: StageMember[];
  speaking: Record<string, boolean>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef(members);
  const speakingRef = useRef(speaking);
  useEffect(() => {
    membersRef.current = members;
    speakingRef.current = speaking;
  }, [members, speaking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const owned: { dispose: () => void }[] = [];
    const own = <T extends { dispose: () => void }>(x: T) => {
      owned.push(x);
      return x;
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8a7b3c);
    scene.fog = new THREE.Fog(0x8a7b3c, 7, 16);

    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 40);
    camera.position.set(0, 1.55, 5.4);
    camera.lookAt(0, 1.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff1b0, 0x6b5a1e, 1.15));
    const key = new THREE.PointLight(0xfff3c4, 3.2, 9, 1.4);
    key.position.set(0, 2.6, 1.6);
    scene.add(key);

    // Piece : sol, mur du fond, deux murs lateraux, plafond et deux neons.
    const wallTex = own(makeHallWallpaper());
    wallTex.repeat.set(4, 1);
    const wallMat = own(new THREE.MeshLambertMaterial({ map: wallTex }));
    const sideTex = own(makeHallWallpaper());
    sideTex.repeat.set(2, 1);
    const sideMat = own(new THREE.MeshLambertMaterial({ map: sideTex }));
    const carpetTex = own(makeHallCarpet());
    carpetTex.repeat.set(4, 3);
    const ceilTex = own(makeCeilingTiles());
    ceilTex.repeat.set(5, 3);

    const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 9)), own(new THREE.MeshLambertMaterial({ map: carpetTex })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.5);
    scene.add(floor);
    const ceiling = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 9)), own(new THREE.MeshLambertMaterial({ map: ceilTex })));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 2.8, 1.5);
    scene.add(ceiling);
    const back = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 2.8)), wallMat);
    back.position.set(0, 1.4, -1.6);
    scene.add(back);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(own(new THREE.PlaneGeometry(9, 2.8)), sideMat);
      wall.position.set(side * 5.2, 1.4, 1.5);
      wall.rotation.y = -side * (Math.PI / 2);
      scene.add(wall);
    }
    // Encadrement de porte a gauche, par ou entrent les nouveaux.
    const doorway = new THREE.Mesh(own(new THREE.PlaneGeometry(1.1, 2.15)), own(new THREE.MeshBasicMaterial({ color: 0x1c1708 })));
    doorway.position.set(-5.19, 1.075, 0.3);
    doorway.rotation.y = Math.PI / 2;
    scene.add(doorway);
    const panelMat = own(new THREE.MeshBasicMaterial({ map: own(makeLightPanel()) }));
    const panelGeo = own(new THREE.BoxGeometry(1.3, 0.05, 0.62));
    for (const x of [-2.2, 2.2]) {
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(x, 2.77, 0.6);
      scene.add(panel);
    }

    const actors = new Map<string, Actor>();
    let elapsed = 0;
    let last = performance.now();

    function reconcile() {
      const list = membersRef.current;
      const ids = new Set(list.map((m) => m.id));
      for (const [id, actor] of actors) {
        if (ids.has(id)) continue;
        scene.remove(actor.survivor.group);
        actor.survivor.dispose();
        actors.delete(id);
      }
      list.forEach((m, i) => {
        const targetX = (i - (list.length - 1) / 2) * SLOT_GAP;
        let actor = actors.get(m.id);
        if (!actor) {
          const survivor = buildSurvivor(m.color, m.name);
          // Le premier est deja la ; les suivants entrent par la porte de gauche.
          const fromDoor = actors.size > 0;
          actor = {
            id: m.id,
            survivor,
            x: fromDoor ? -5.6 : targetX,
            targetX,
            walk: 0,
            speed: 0,
            phase: Math.random() * 10,
            lookYaw: 0,
            nextLookAt: 2 + Math.random() * 3,
          };
          survivor.group.position.set(actor.x, 0, fromDoor ? 0.3 : 0);
          scene.add(survivor.group);
          actors.set(m.id, actor);
        }
        actor.targetX = targetX;
        actor.survivor.setName(m.name);
      });
    }

    function step() {
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (document.hidden) return;
      elapsed += delta;
      reconcile();

      for (const actor of actors.values()) {
        const g = actor.survivor.group;
        const dx = actor.targetX - actor.x;
        const moving = Math.abs(dx) > 0.03;
        const want = moving ? Math.min(2.4, Math.abs(dx) * 3 + 0.8) : 0;
        actor.speed += (want - actor.speed) * Math.min(1, delta * 6);
        if (moving) actor.x += Math.sign(dx) * Math.min(Math.abs(dx), actor.speed * delta);
        actor.walk += actor.speed * delta * 2.6;
        // En marche il regarde ou il va ; arrive, il se tourne vers nous et
        // jette de temps en temps un regard aux autres.
        if (elapsed > actor.nextLookAt) {
          actor.nextLookAt = elapsed + 2.5 + Math.random() * 4;
          actor.lookYaw = Math.random() < 0.55 ? 0 : (Math.random() - 0.5) * 1.1;
        }
        const yaw = moving ? Math.sign(dx) * (Math.PI / 2) : actor.lookYaw;
        let turn = yaw - g.rotation.y;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        g.rotation.y += turn * Math.min(1, delta * 5);
        g.position.x = actor.x;
        g.position.z += ((moving ? 0.3 : 0) - g.position.z) * Math.min(1, delta * 3);
        actor.survivor.update({
          time: elapsed + actor.phase,
          walkPhase: actor.walk,
          speed: actor.speed,
          crouch: 0,
          pitch: Math.sin(elapsed * 0.6 + actor.phase) * 0.06,
          lampOn: false,
          dead: false,
          speaking: speakingRef.current[actor.id] ? 1 : 0,
        });
      }
      camera.position.x = Math.sin(elapsed * 0.25) * 0.15;
      camera.lookAt(0, 1.05, 0);
      renderer.render(scene, camera);
    }

    const interval = window.setInterval(() => {
      try {
        step();
      } catch {
        // une image perdue n'arrete pas le salon
      }
    }, 16);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      for (const actor of actors.values()) actor.survivor.dispose();
      for (const o of owned) o.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="h-56 w-full overflow-hidden border border-white/10 sm:h-72" aria-label="Les survivants du groupe" />;
}
