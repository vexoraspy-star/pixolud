"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { tankById } from "@/lib/tanks/tankDefs";
import { buildTankModel, type TankModel } from "@/lib/tanks/tankModel";

/** Sol du hangar : beton tache, joints et lignes de securite jaunes. */
function hangarFloorTexture(): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#5a5b58";
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 5000; k++) {
    const v = 70 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle = "rgba(30,28,24,0.18)";
    ctx.beginPath();
    ctx.ellipse(Math.random() * S, Math.random() * S, 20 + Math.random() * 50, 10 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(20,20,20,0.5)";
  ctx.lineWidth = 2;
  for (let p = 0; p <= S; p += S / 4) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(230,190,40,0.85)";
  ctx.lineWidth = 10;
  ctx.setLineDash([36, 18]);
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(40, S);
  ctx.moveTo(S - 40, 0);
  ctx.lineTo(S - 40, S);
  ctx.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  return t;
}

/**
 * Le char du garage : il tourne lentement sur un plateau dans un hangar,
 * et on le fait tourner a la souris ou au doigt.
 */
export default function TankGaragePreview({ tankId }: { tankId: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; setModel: (id: string) => void } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    // Le canvas suit toujours son cadre (100 %) : sa taille en pixels ne doit
    // jamais pousser la mise en page du garage.
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1f1c);
    scene.fog = new THREE.Fog(0x1d1f1c, 18, 42);
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100);

    // Lumieres : une verriere au-dessus, un projecteur chaud, un contre-jour froid.
    const hemi = new THREE.HemisphereLight(0xd8e4ff, 0x3a3428, 1.5);
    const key = new THREE.DirectionalLight(0xffe8c8, 3);
    key.position.set(6, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    const rim = new THREE.DirectionalLight(0x9fc3ff, 1.4);
    rim.position.set(-8, 5, -9);
    scene.add(hemi, key, rim);

    const floorTex = hangarFloorTexture();
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    scene.add(floor);
    // Plateau tournant.
    const tableGeo = new THREE.CylinderGeometry(4.6, 4.8, 0.16, 48);
    const tableMat = new THREE.MeshLambertMaterial({ color: 0x3f423d });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 0.08;
    table.receiveShadow = true;
    scene.add(table);
    // Murs du hangar : poutres et portes coulissantes, juste des volumes sombres.
    const wallGeo = new THREE.BoxGeometry(60, 16, 1);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x2a2c28 });
    const back = new THREE.Mesh(wallGeo, wallMat);
    back.position.set(0, 8, -16);
    scene.add(back);
    const beamGeo = new THREE.BoxGeometry(0.6, 16, 0.8);
    const beamMat = new THREE.MeshLambertMaterial({ color: 0x3a3d38 });
    const beams: THREE.Mesh[] = [];
    for (let k = -3; k <= 3; k++) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.position.set(k * 7, 8, -15.3);
      scene.add(b);
      beams.push(b);
    }

    const holder = new THREE.Group();
    holder.position.y = 0.16;
    scene.add(holder);
    let model: TankModel | null = null;
    const setModel = (id: string) => {
      if (model) {
        holder.remove(model.root);
        model.dispose();
      }
      model = buildTankModel(tankById(id));
      model.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      model.turret.rotation.y = 0.35;
      model.gun.rotation.x = -0.05;
      holder.add(model.root);
    };
    sceneRef.current = { scene, setModel };

    let yaw = -0.6;
    let dragging = false;
    let lastX = 0;
    let idle = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
      idle = 0;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      idle += dt;
      if (!dragging && idle > 2) yaw += dt * 0.22;
      holder.rotation.y = yaw;
      table.rotation.y = yaw;
      camera.position.set(9.5, 4.2, 9.5);
      camera.lookAt(0, 1.2, 0);
      renderer.render(scene, camera);
    };
    const interval = window.setInterval(tick, 16);
    const onResize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      // Cadre etroit (telephone) : on recule pour voir tout le char.
      camera.fov = w / h < 1 ? 52 : 38;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    onResize();
    const observer = new ResizeObserver(onResize);
    observer.observe(container);

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      if (model) model.dispose();
      floorTex.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      tableGeo.dispose();
      tableMat.dispose();
      wallGeo.dispose();
      wallMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setModel(tankId);
  }, [tankId]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
