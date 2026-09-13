import * as THREE from "three";

// Les screamers du Manoir Maudit.
//
// Une regle : un screamer ne tue jamais et ne fait jamais de bruit que la
// chose pourrait entendre. Il fait peur, c'est tout — sinon le joueur finit
// par le vivre comme une injustice et plus comme une peur.
//
// Tout est dessine ici : une silhouette (la « dame blanche », qui n'est PAS
// la chose : elle est pale, immobile, et ne chasse pas) et deux images
// peintes au canvas pour les flashs plein ecran.

export interface Ghost {
  group: THREE.Group;
  /** 0 = invisible, 1 = pleinement la. */
  setOpacity(value: number): void;
  /** Leve les bras et ouvre la bouche, pour le moment ou elle se jette sur toi. */
  setRush(value: number): void;
  dispose(): void;
}

export function buildGhost(): Ghost {
  const group = new THREE.Group();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  // Non eclairee : elle ne depend pas de la lampe, on la voit dans le noir.
  const pale = new THREE.MeshBasicMaterial({ color: 0xcfc9bd, transparent: true, opacity: 1 });
  const cloth = new THREE.MeshBasicMaterial({ color: 0x9c968b, transparent: true, opacity: 1 });
  const hole = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1 });
  const hair = new THREE.MeshBasicMaterial({ color: 0x0b0a0c, transparent: true, opacity: 1 });
  owned.push(pale, cloth, hole, hair);

  function mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
    owned.push(geo);
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    return m;
  }

  // Robe de nuit qui traine au sol, trop longue.
  const dress = mesh(new THREE.CylinderGeometry(0.13, 0.36, 1.35, 10, 1, true), cloth);
  dress.position.y = 0.68;
  const chest = mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.42, 10), cloth);
  chest.position.y = 1.52;

  // Cou trop long, tete penchee.
  const neck = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 6), pale);
  neck.position.y = 1.83;
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.95;
  headPivot.rotation.z = 0.32;
  group.add(headPivot);
  const headGeo = new THREE.SphereGeometry(0.12, 14, 12);
  owned.push(headGeo);
  const head = new THREE.Mesh(headGeo, pale);
  head.scale.set(0.9, 1.18, 0.95);
  head.position.y = 0.08;
  headPivot.add(head);
  // Deux orbites vides et une bouche qui s'etire vers le bas.
  const eyeGeo = new THREE.SphereGeometry(0.026, 8, 6);
  owned.push(eyeGeo);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, hole);
    eye.scale.set(1, 1.35, 0.5);
    eye.position.set(side * 0.045, 0.11, 0.105);
    headPivot.add(eye);
  }
  const mouthGeo = new THREE.SphereGeometry(0.03, 8, 6);
  owned.push(mouthGeo);
  const mouth = new THREE.Mesh(mouthGeo, hole);
  mouth.position.set(0, -0.0, 0.1);
  mouth.scale.set(0.8, 1.2, 0.4);
  headPivot.add(mouth);
  // Cheveux longs qui tombent devant les epaules.
  const hairGeo = new THREE.BoxGeometry(0.05, 0.7, 0.03);
  owned.push(hairGeo);
  for (let i = 0; i < 7; i++) {
    const strand = new THREE.Mesh(hairGeo, hair);
    const a = -0.9 + (i / 6) * 1.8;
    strand.position.set(Math.sin(a) * 0.12, -0.18, Math.cos(a) * 0.05 - 0.04);
    strand.rotation.z = a * 0.08;
    headPivot.add(strand);
  }

  // Bras trop longs, qui pendent jusqu'aux genoux.
  const armGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.95, 6);
  owned.push(armGeo);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.19, 1.68, 0);
    const arm = new THREE.Mesh(armGeo, pale);
    arm.position.y = -0.47;
    pivot.add(arm);
    group.add(pivot);
    return { pivot, side };
  });

  const mats = [pale, cloth, hole, hair];

  return {
    group,
    setOpacity(value: number) {
      const v = Math.max(0, Math.min(1, value));
      for (const m of mats) m.opacity = v;
      group.visible = v > 0.01;
    },
    setRush(value: number) {
      const v = Math.max(0, Math.min(1, value));
      for (const { pivot, side } of arms) {
        pivot.rotation.x = -v * 1.7;
        pivot.rotation.z = side * v * 0.35;
      }
      headPivot.rotation.z = 0.32 * (1 - v);
      headPivot.rotation.x = -v * 0.25;
      mouth.scale.set(0.8 + v * 0.9, 1.2 + v * 3.2, 0.4);
      mouth.position.y = -v * 0.05;
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}

/**
 * Visage plein ecran, peint au canvas. Il n'apparait qu'une fraction de
 * seconde : on ne doit pas avoir le temps de le detailler, seulement de
 * reconnaitre que c'est un visage et qu'il ne va pas.
 */
export function makeScareFaceUrl(): string {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  // Tete trop etroite, trop longue.
  const grad = ctx.createRadialGradient(256, 230, 30, 256, 260, 250);
  grad.addColorStop(0, "#d9d2c3");
  grad.addColorStop(0.55, "#8f877a");
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(256, 262, 150, 225, 0, 0, Math.PI * 2);
  ctx.fill();

  // Orbites noires, qui coulent.
  for (const side of [-1, 1]) {
    const x = 256 + side * 62;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, 205, 40, 52, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + side * 4, 250);
    ctx.bezierCurveTo(x + side * 10, 300, x - side * 6, 330, x + side * 2, 380);
    ctx.stroke();
    // Une pupille minuscule, qui te regarde quand meme.
    ctx.fillStyle = "#e8e0d0";
    ctx.beginPath();
    ctx.arc(x + side * 6, 212, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bouche demesurement ouverte.
  ctx.fillStyle = "#050000";
  ctx.beginPath();
  ctx.ellipse(256, 385, 58, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,10,10,0.5)";
  ctx.beginPath();
  ctx.ellipse(256, 405, 40, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dents irregulieres.
  ctx.fillStyle = "#bdb39c";
  for (let i = 0; i < 9; i++) {
    const x = 214 + i * 10.5;
    ctx.fillRect(x, 300 + Math.abs(4 - i) * 3, 6, 16 + Math.random() * 10);
  }

  // Craquelures et grain : l'image est « sale ».
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    let x = 120 + Math.random() * 270;
    let y = 60 + Math.random() * 380;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (Math.random() - 0.5) * 40;
      y += Math.random() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 60;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.8);
}

/**
 * Main pale aux doigts trop longs, pour la cachette : quelqu'un d'autre
 * etait deja dans l'armoire.
 */
export function makeScareHandUrl(): string {
  const w = 360;
  const h = 640;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);

  const skin = ctx.createLinearGradient(0, h, 0, 0);
  skin.addColorStop(0, "rgba(120,112,100,0)");
  skin.addColorStop(0.35, "#8d8576");
  skin.addColorStop(1, "#d6cfc0");
  ctx.fillStyle = skin;
  ctx.strokeStyle = "rgba(20,15,10,0.7)";
  ctx.lineWidth = 3;

  // Poignet et paume.
  ctx.beginPath();
  ctx.moveTo(130, h);
  ctx.lineTo(120, 380);
  ctx.quadraticCurveTo(110, 300, 150, 280);
  ctx.lineTo(250, 285);
  ctx.quadraticCurveTo(275, 320, 250, 390);
  ctx.lineTo(235, h);
  ctx.closePath();
  ctx.fill();

  // Quatre doigts demesures, a trois phalanges, et un pouce.
  const fingers = [
    { x: 150, len: 250, bend: -0.12 },
    { x: 182, len: 290, bend: -0.04 },
    { x: 214, len: 275, bend: 0.05 },
    { x: 244, len: 215, bend: 0.14 },
  ];
  for (const f of fingers) {
    let x = f.x;
    let y = 290;
    let angle = -Math.PI / 2 + f.bend;
    const seg = f.len / 3;
    for (let k = 0; k < 3; k++) {
      const nx = x + Math.cos(angle) * seg;
      const ny = y + Math.sin(angle) * seg;
      ctx.lineCap = "round";
      ctx.lineWidth = 22 - k * 4;
      ctx.strokeStyle = "#bfb7a6";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      // Articulation sombre.
      ctx.fillStyle = "rgba(40,30,25,0.55)";
      ctx.beginPath();
      ctx.arc(nx, ny, 5 - k, 0, Math.PI * 2);
      ctx.fill();
      x = nx;
      y = ny;
      angle += f.bend * 1.6 + 0.12;
    }
    // Ongle noir.
    ctx.fillStyle = "#1a1410";
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 9, angle + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 20;
  ctx.strokeStyle = "#b3ab9a";
  ctx.beginPath();
  ctx.moveTo(250, 340);
  ctx.quadraticCurveTo(320, 300, 330, 230);
  ctx.stroke();
  return c.toDataURL("image/png");
}
