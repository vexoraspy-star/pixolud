"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildSoldier, poseSoldier, type SoldierParts } from "@/lib/duelSoldier";
import { buildWeaponModel, type WeaponId, type WeaponModel } from "@/lib/duelWeapons";
import { CAMOS, SKINS, type CamoId, type SkinId } from "@/lib/duelProfile";
import { createAnimatedModel, type AnimatedModel } from "@/lib/models3d";
import { createDancer, type DanceId, type Dancer } from "@/lib/duelDances";

/**
 * Le decor 3D du salon : ton soldat sur une plateforme au-dessus de l'eau,
 * sous un grand ciel, et ton arme qui flotte a cote de lui.
 *
 * C'est la premiere chose qu'on voit en arrivant dans le jeu de tir : elle
 * doit montrer TA tenue et TON camouflage, pas un menu de texte. On peut
 * faire tourner le personnage en le faisant glisser.
 */
export default function DuelLobbyStage({
  skin,
  camo,
  weapon,
  dance = null,
}: {
  skin: SkinId;
  camo: CamoId;
  weapon: WeaponId;
  /** Danse a montrer (apercu de la boutique ou du casier), ou null. */
  dance?: DanceId | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ setLook: (skin: SkinId, camo: CamoId, weapon: WeaponId) => void; setDance: (id: DanceId | null) => void } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe6ff, 18, 60);
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const owned: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T): T => {
      owned.push(x);
      return x;
    };

    // --- Ciel en degrade ---
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 8;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext("2d")!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#2f8ff0");
    grad.addColorStop(0.55, "#7cc6ff");
    grad.addColorStop(1, "#d9f1ff");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 8, 256);
    const skyTex = keep(new THREE.CanvasTexture(skyCanvas));
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      keep(new THREE.SphereGeometry(90, 24, 16)),
      keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })),
    );
    scene.add(sky);

    scene.add(new THREE.HemisphereLight(0xdff2ff, 0x3a6a8a, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    sun.position.set(6, 10, 7);
    scene.add(sun);

    // --- Eau ---
    const water = new THREE.Mesh(
      keep(new THREE.CircleGeometry(80, 48)),
      keep(new THREE.MeshLambertMaterial({ color: 0x3aa0d8 })),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.6;
    scene.add(water);
    // Reflets : de fines bandes claires qui glissent a la surface.
    const glintMat = keep(new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.35 }));
    const glintGeo = keep(new THREE.PlaneGeometry(1.8, 0.05));
    const glints: THREE.Mesh[] = [];
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Mesh(glintGeo, glintMat);
      g.rotation.x = -Math.PI / 2;
      g.position.set((Math.random() - 0.5) * 30, -0.58, -Math.random() * 26 + 2);
      g.userData.speed = 0.2 + Math.random() * 0.3;
      glints.push(g);
      scene.add(g);
    }

    // --- Plateforme ---
    const platform = new THREE.Mesh(
      keep(new THREE.CylinderGeometry(1.6, 1.75, 0.6, 40)),
      keep(new THREE.MeshLambertMaterial({ color: 0x33424f })),
    );
    platform.position.y = -0.3;
    scene.add(platform);
    const topDisc = new THREE.Mesh(
      keep(new THREE.CircleGeometry(1.58, 40)),
      keep(new THREE.MeshLambertMaterial({ color: 0x4d6272 })),
    );
    topDisc.rotation.x = -Math.PI / 2;
    topDisc.position.y = 0.005;
    scene.add(topDisc);
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0x57e3ff }));
    const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(1.45, 0.035, 8, 60)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // --- Decor lointain : rochers et palmiers stylises ---
    const rockMat = keep(new THREE.MeshLambertMaterial({ color: 0x7c8a6a, flatShading: true }));
    const rockGeo = keep(new THREE.IcosahedronGeometry(1, 0));
    for (const [x, z, s] of [
      [-9, -16, 3.2],
      [11, -20, 4.5],
      [-17, -26, 5],
      [18, -12, 2.4],
      [4, -30, 3.6],
    ] as const) {
      const r = new THREE.Mesh(rockGeo, rockMat);
      r.position.set(x, -0.6 + s * 0.35, z);
      r.scale.set(s, s * 0.8, s);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      scene.add(r);
    }
    const trunkMat = keep(new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
    const leafMat = keep(new THREE.MeshLambertMaterial({ color: 0x3f9a4a, flatShading: true }));
    const trunkGeo = keep(new THREE.CylinderGeometry(0.12, 0.2, 4, 6));
    const leafGeo = keep(new THREE.ConeGeometry(1.4, 0.5, 6));
    for (const [x, z] of [
      [-10.5, -14],
      [12.5, -18.5],
    ] as const) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 1.5 + 0.8, z);
      trunk.rotation.z = 0.12;
      scene.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x + 0.25, 4.3 + 0.8, z);
      scene.add(leaves);
    }
    // Nuages : des ellipsoides blancs aplatis.
    const cloudMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
    const cloudGeo = keep(new THREE.SphereGeometry(1, 10, 8));
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(k * 1.3 - 2, Math.random() * 0.5, Math.random() * 0.6);
        puff.scale.set(1.3 + Math.random(), 0.7 + Math.random() * 0.4, 1);
        c.add(puff);
      }
      c.position.set((Math.random() - 0.5) * 60, 12 + Math.random() * 8, -35 - Math.random() * 15);
      c.userData.speed = 0.3 + Math.random() * 0.4;
      clouds.push(c);
      scene.add(c);
    }

    // --- Le soldat et son arme ---
    const holder = new THREE.Group();
    scene.add(holder);
    let soldier: SoldierParts | null = null;
    let gun: WeaponModel | null = null;
    const gunPivot = new THREE.Group();
    gunPivot.position.set(1.25, 1.25, 0.2);
    scene.add(gunPivot);

    // Le SWAT anime (CC0) remplace le soldat dessine en code des qu'il est
    // charge ; il porte ta tenue et ton arme, avec ton camouflage.
    let swat: AnimatedModel | null = null;
    let swatGun: WeaponModel | null = null;
    const swatGunHolder = new THREE.Group();
    let stageDisposed = false;
    let lastLook: [SkinId, CamoId, WeaponId] | null = null;
    let dancer: Dancer | null = null;
    let wantedDance: DanceId | null = null;
    createAnimatedModel("soldat-swat", 1.8)
      .then((m) => {
        if (stageDisposed) {
          m.dispose();
          return;
        }
        swat = m;
        m.attach("Wrist.R", swatGunHolder, "Idle_Gun_Pointing");
        m.play("Idle_Gun");
        holder.add(m.root);
        dancer = createDancer(m);
        if (lastLook) setLook(...lastLook);
        if (wantedDance) setDance(wantedDance);
      })
      .catch(() => {});

    function setLook(skinId: SkinId, camoId: CamoId, weaponId: WeaponId) {
      lastLook = [skinId, camoId, weaponId];
      const s = SKINS[skinId];
      if (soldier) {
        holder.remove(soldier.group);
        soldier.dispose();
        soldier = null;
      }
      if (gun) {
        gunPivot.remove(gun.group);
        gun.dispose();
        gun = null;
      }
      if (swat) {
        swat.tint((n) => n === "Swat", s.accent);
        swat.tint((n) => n === "Swat_Black", s.gear);
        swat.tint((n) => n === "Visor", s.visor);
        if (swatGun) {
          swatGunHolder.remove(swatGun.group);
          swatGun.dispose();
        }
        // L'arme du jeu, retournee (elle vise -Z a la premiere personne) et
        // placee pour que la poignee tombe dans la main.
        swatGun = buildWeaponModel(weaponId, { camo: camoId, hands: false });
        swatGun.group.rotation.y = Math.PI;
        swatGun.group.scale.setScalar(0.9);
        swatGun.group.position.set(0, 0.13, 0.1);
        swatGunHolder.add(swatGun.group);
      } else {
        soldier = buildSoldier(s.accent, { cloth: s.cloth, gear: s.gear, visor: s.visor });
        holder.add(soldier.group);
        gun = buildWeaponModel(weaponId, { camo: camoId, hands: false });
        gun.group.scale.setScalar(1.55);
        gun.group.rotation.y = Math.PI / 2;
        gunPivot.add(gun.group);
      }
      // Lueur de rarete sous l'arme, a la couleur du camouflage.
      ringMat.color.set(CAMOS[camoId].rarity === "legendaire" ? 0xffc14a : CAMOS[camoId].rarity === "epique" ? 0xc47dff : 0x57e3ff);
    }
    /** Apercu d'une danse : l'arme disparait, le soldat danse en boucle. */
    function setDance(id: DanceId | null) {
      wantedDance = id;
      if (!dancer || !swat) return;
      dancer.start(id);
      swatGunHolder.visible = id === null;
      if (id === null) swat.play("Idle_Gun", { fade: 0.25 });
    }
    apiRef.current = { setLook, setDance };

    // --- Rotation a la souris ou au doigt ---
    let dragging = false;
    let lastX = 0;
    let spin = 0.35;
    let yaw = -0.35;
    function onDown(e: PointerEvent) {
      dragging = true;
      lastX = e.clientX;
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
      spin = 0;
    }
    function onUp() {
      dragging = false;
    }
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // Le personnage est decale a droite : le panneau de gauche le masquait.
    function frame() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      camera.aspect = w / h;
      const narrow = w < 700;
      camera.position.set(narrow ? 0 : -1.35, 1.55, narrow ? 6.2 : 5.3);
      camera.lookAt(narrow ? 0.3 : -0.35, 1.05, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    frame();
    window.addEventListener("resize", frame);

    let last = performance.now();
    let t = 0;
    const tick = () => {
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      t += delta;
      if (!dragging) {
        spin = Math.min(0.35, spin + delta * 0.05);
        yaw += spin * delta;
      }
      holder.rotation.y = yaw;
      if (soldier) {
        poseSoldier(soldier, { walk: 0, speed: 0, pitch: 0.08 + Math.sin(t * 1.2) * 0.02, death: 0 });
        soldier.torso.position.y = 0.9 + Math.sin(t * 2) * 0.012;
      }
      if (swat && dancer?.current) {
        swat.update(delta);
        dancer.update(delta);
      } else if (swat) {
        // Au repos l'arme basse ; de temps en temps il la leve et vise.
        const cycle = t % 9;
        swat.play(cycle > 6.5 ? "Idle_Gun_Pointing" : "Idle_Gun", { fade: 0.35 });
        swat.update(delta);
        if (swatGun) swatGun.update({ time: t, recoil: 0, reload: 0, aim: 0, sprint: 0 });
      }
      gunPivot.rotation.y = t * 0.6;
      gunPivot.position.y = 1.25 + Math.sin(t * 1.4) * 0.06;
      if (gun) gun.update({ time: t, recoil: 0, reload: 0, aim: 0, sprint: 0 });
      for (const g of glints) {
        g.position.x += g.userData.speed * delta;
        if (g.position.x > 16) g.position.x = -16;
      }
      for (const c of clouds) {
        c.position.x += c.userData.speed * delta;
        if (c.position.x > 40) c.position.x = -40;
      }
      ring.scale.setScalar(1 + Math.sin(t * 2.2) * 0.015);
      renderer.render(scene, camera);
    };
    const iv = window.setInterval(tick, 16);

    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      apiRef.current = null;
      stageDisposed = true;
      if (soldier) soldier.dispose();
      if (gun) gun.dispose();
      if (swatGun) swatGun.dispose();
      if (swat) swat.dispose();
      for (const o of owned) o.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    apiRef.current?.setLook(skin, camo, weapon);
  }, [skin, camo, weapon]);
  useEffect(() => {
    apiRef.current?.setDance(dance);
  }, [dance]);

  return <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />;
}
