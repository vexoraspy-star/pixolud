"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { makeNightSkyTexture, makeFacadeTexture } from "@/lib/manorTextures";
import { createAudio, playCrash, playStinger } from "@/lib/manorAudio";

interface Beat {
  at: number;
  text: string;
}

// Cinematique d'ouverture entierement en 3D : la camera quitte la voiture en
// panne, remonte l'allee jusqu'au manoir, et la porte s'ouvre toute seule.
const BEATS: Beat[] = [
  { at: 0, text: "Ta voiture vient de lâcher en pleine nuit, sur une route de campagne perdue." },
  { at: 4.2, text: "Pas de réseau. Une seule lumière à des kilomètres : un vieux manoir." },
  { at: 9.4, text: "Tu frappes. Personne ne répond... mais la porte s'entrouvre toute seule." },
  { at: 13.4, text: "Une odeur de poussière et de cire brûlée. Tu n'es pas seul ici." },
];
const DURATION = 17.2;

export default function HorrorCutscene({ onDone }: { onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(BEATS[0].text);
  const [fade, setFade] = useState(1);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060c);
    scene.fog = new THREE.Fog(0x05060c, 18, 95);

    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / container.clientHeight,
      0.1,
      400,
    );
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x2a3050, 0x0a0a08, 0.8));
    const moon = new THREE.DirectionalLight(0xaebbe8, 0.5);
    moon.position.set(24, 40, -30);
    scene.add(moon);

    // Ciel etoile : un grand plan derriere le manoir.
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 160),
      new THREE.MeshBasicMaterial({ map: makeNightSkyTexture(), depthWrite: false }),
    );
    sky.position.set(0, 44, -140);
    scene.add(sky);

    // Sol + allee.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 260),
      new THREE.MeshLambertMaterial({ color: 0x0b0f0a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -60;
    scene.add(ground);

    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 190),
      new THREE.MeshLambertMaterial({ color: 0x18140f }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, -50);
    scene.add(path);

    // Le manoir : masse sombre + facade dessinee.
    const manor = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(46, 30, 22),
      new THREE.MeshLambertMaterial({ color: 0x0b0a09 }),
    );
    body.position.set(0, 15, -12);
    manor.add(body);
    const facade = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 39),
      new THREE.MeshBasicMaterial({ map: makeFacadeTexture(), transparent: true }),
    );
    facade.position.set(0, 19.5, -0.9);
    manor.add(facade);
    manor.position.set(0, 0, -46);
    scene.add(manor);

    // L'embrasure : un rectangle noir qui s'agrandit quand la porte s'ouvre.
    const doorway = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    doorway.position.set(0, 5, -45.5);
    doorway.scale.x = 0.02;
    scene.add(doorway);
    // Lueur chaude qui s'echappe de l'entrebaillement.
    const doorGlow = new THREE.PointLight(0xffb463, 0, 34, 2);
    doorGlow.position.set(0, 4.5, -44);
    scene.add(doorGlow);

    // Deux arbres morts qui bordent l'allee.
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x0a0908 });
    for (const [tx, tz] of [
      [-9, -6],
      [10, -18],
      [-11, -30],
    ] as [number, number][]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 13, 6), barkMat);
      trunk.position.set(tx, 6.5, tz);
      scene.add(trunk);
      for (let b = 0; b < 4; b++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 5.5, 5), barkMat);
        branch.position.set(tx + (b % 2 ? 1.6 : -1.6), 10 + b * 0.9, tz + (b < 2 ? 0.8 : -0.8));
        branch.rotation.z = (b % 2 ? 1 : -1) * 0.85;
        branch.rotation.x = (b < 2 ? 1 : -1) * 0.3;
        scene.add(branch);
      }
    }

    // La voiture en panne, capot ouvert, un phare qui clignote.
    const car = new THREE.Group();
    const carMat = new THREE.MeshLambertMaterial({ color: 0x14171d });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 9), carMat);
    chassis.position.y = 1.35;
    car.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.4, 4.4), carMat);
    cabin.position.set(0, 2.75, 0.4);
    car.add(cabin);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(4, 0.16, 3.4), carMat);
    hood.position.set(0, 3.1, -3.4);
    hood.rotation.x = -0.75;
    car.add(hood);
    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.6, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x08090b });
    for (const [wx, wz] of [
      [-2.1, -3],
      [2.1, -3],
      [-2.1, 3],
      [2.1, 3],
    ] as [number, number][]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.85, wz);
      car.add(wheel);
    }
    const headlamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: 0xffdca0 }),
    );
    headlamp.position.set(-1.3, 1.6, -4.55);
    headlamp.rotation.y = Math.PI;
    car.add(headlamp);
    const headlight = new THREE.SpotLight(0xffd9a0, 8, 42, Math.PI / 7, 0.6, 1.2);
    headlight.position.set(-1.3, 1.6, -4.6);
    const headTarget = new THREE.Object3D();
    headTarget.position.set(-2.4, 0.4, -26);
    car.add(headTarget);
    headlight.target = headTarget;
    car.add(headlight);
    car.position.set(4.2, 0, 27);
    car.rotation.y = -0.34;
    scene.add(car);

    // Pluie.
    const RAIN = 1400;
    const rainPos = new Float32Array(RAIN * 3);
    for (let i = 0; i < RAIN; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 90;
      rainPos[i * 3 + 1] = Math.random() * 46;
      rainPos[i * 3 + 2] = -Math.random() * 110 + 25;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rain = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({ color: 0x9fb2cc, size: 0.13, transparent: true, opacity: 0.5 }),
    );
    scene.add(rain);

    const audio = createAudio();
    let elapsed = 0;
    let lastTime = performance.now();
    let beatIndex = -1;
    let doorOpened = false;
    let thunderAt = 6.4;

    function finish() {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    }

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += delta;

      // Legende courante.
      let idx = 0;
      for (let i = 0; i < BEATS.length; i++) if (elapsed >= BEATS[i].at) idx = i;
      if (idx !== beatIndex) {
        beatIndex = idx;
        setCaption(BEATS[idx].text);
      }

      // Fondu d'ouverture puis fondu au noir final.
      if (elapsed < 1.4) setFade(1 - elapsed / 1.4);
      else if (elapsed > DURATION - 2.2) {
        setFade(Math.min(1, (elapsed - (DURATION - 2.2)) / 2.2));
      }

      // Trajet de la camera : on reste loin pendant qu'on decouvre le manoir,
      // puis on remonte l'allee, et enfin on franchit la porte.
      const smooth = (t: number) => t * t * (3 - 2 * t);
      let camZ: number;
      let camY = 2.7;
      if (elapsed < 4.2) {
        camZ = 34 - elapsed * 0.95;
      } else if (elapsed < 9.4) {
        camZ = THREE.MathUtils.lerp(30, -6, smooth((elapsed - 4.2) / 5.2));
      } else if (elapsed < 13.4) {
        const t = (elapsed - 9.4) / 4;
        camZ = THREE.MathUtils.lerp(-6, -27, smooth(t));
        camY = THREE.MathUtils.lerp(2.7, 3.4, t);
      } else {
        const t = Math.min(1, (elapsed - 13.4) / (DURATION - 13.4));
        camZ = THREE.MathUtils.lerp(-27, -43.6, t * t);
        camY = THREE.MathUtils.lerp(3.4, 4.2, t);
      }
      const sway = Math.sin(elapsed * 1.15) * 0.35 + Math.sin(elapsed * 2.7) * 0.12;
      camera.position.set(sway * 0.5, camY + Math.sin(elapsed * 2.2) * 0.05, camZ);
      // De loin on cadre tout le manoir, de pres on descend vers la porte.
      const lookY = THREE.MathUtils.clamp(3.5 + (camZ + 46) * 0.16, 4, 16);
      camera.lookAt(0, lookY, -46);

      // La porte s'ouvre pendant la 3e legende.
      if (elapsed >= 9.4) {
        const t = Math.min(1, (elapsed - 9.4) / 3.2);
        doorway.scale.x = THREE.MathUtils.lerp(0.02, 1, t * t * (3 - 2 * t));
        doorGlow.intensity = 3.4 * t * (0.85 + Math.sin(elapsed * 7) * 0.15);
        if (!doorOpened) {
          doorOpened = true;
          playCrash(audio.ctx, audio.master);
        }
      }

      // Eclair + tonnerre.
      if (elapsed >= thunderAt) {
        thunderAt = elapsed + 5.5 + Math.random() * 4;
        moon.intensity = 3.2;
        playStinger(audio.ctx, audio.master);
      }
      moon.intensity = THREE.MathUtils.lerp(moon.intensity, 0.5, delta * 3.4);

      // Phare qui clignote faiblement.
      const flicker = Math.random() > 0.965 ? 0.15 : 1;
      headlight.intensity = 8 * flicker;
      headlamp.visible = flicker > 0.5;

      // Pluie.
      const pos = rainGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < RAIN; i++) {
        let y = pos.getY(i) - delta * (26 + (i % 7));
        if (y < 0) y = 44 + Math.random() * 6;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;

      if (elapsed >= DURATION) {
        finish();
        return;
      }
      renderer.render(scene, camera);
    }
    const intervalId = window.setInterval(tick, 16);
    tick();

    function handleResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", handleResize);
      audio.stop();
      audio.ctx.close().catch(() => {});
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      <div
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: fade }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-6">
        <p className="max-w-xl text-center text-base leading-relaxed text-zinc-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {caption}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (doneRef.current) return;
          doneRef.current = true;
          onDone();
        }}
        className="absolute bottom-5 right-5 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
      >
        Passer →
      </button>
    </div>
  );
}
