import * as THREE from "three";
import type { SkyState } from "./voxelSky";

// Ciel de Cubes : voute peinte en couleurs de sommets, soleil et lune en pixel
// art, etoiles, nuages instancies qui derivent avec le vent. Aucun effet plein
// ecran, aucune lumiere, uniquement des materiaux non eclaires (MeshBasic et
// PointsMaterial). Les lumieres restent dans la scene, reglees par voxelSky.
//
// Ordre de rendu : voute (-10, opaque, sans ecriture de profondeur), puis dans
// la passe transparente etoiles (-9), soleil et lune (-8), nuages (-7), et
// enfin le reste (eau, particules). Les nuages passent donc devant le soleil,
// la lune devant les etoiles, et le relief cache tout ce qui est derriere lui.

const SKY_RADIUS = 145;
/** Distance du soleil et de la lune a la camera. */
const BODY_DISTANCE = 120;
const STAR_RADIUS = 140;
const STAR_COUNT = 700;
/** Recoloration de la voute : au plus toutes les 250 ms... */
const REPAINT_EVERY = 0.25;
/** ...sauf saut d'heure (sommeil, commande) : tout de suite. */
const REPAINT_JUMP = 0.004;

/** Case de nuages qui boucle autour de la camera, en blocs. */
const CLOUD_TILE = 300;
const CLOUD_CLUSTERS = 34;
const CLOUD_PARTS = 3;
/** Les nuages s'effacent entre ces deux distances : la boucle ne se voit jamais. */
const CLOUD_FADE_NEAR = 105;
const CLOUD_FADE_FAR = 145;
/** Vent lent vers +X, en blocs par seconde. */
const WIND = 0.8;

export interface VoxelAtmosphere {
  update(camera: THREE.Camera, dt: number, sky: SkyState): void;
  dispose(): void;
}

/** Generateur pseudo-aleatoire a graine (mulberry32) : le ciel est le meme a chaque partie. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Texture pixel art : filtrage au plus proche, sans mipmaps. */
function pixelTexture(width: number, height: number, draw: (img: ImageData) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(width, height);
    draw(img);
    ctx.putImageData(img, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function put(img: ImageData, x: number, y: number, r: number, g: number, b: number, a: number) {
  const o = (y * img.width + x) * 4;
  img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a;
}

/** Soleil 32 px : disque pale au coeur blanc, halo chaud en anneaux. */
function sunTexture() {
  return pixelTexture(32, 32, (img) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const r = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
      if (r <= 4.2) put(img, x, y, 255, 252, 234, 255);
      else if (r <= 6.3) put(img, x, y, 255, 236, 168, 255);
      else if (r <= 15) {
        // Halo en paliers (pixel art) qui s'eteint vers le bord.
        const k = 1 - (r - 6.3) / 8.7;
        const alpha = Math.ceil(k * k * 3) / 3 * 0.42;
        put(img, x, y, 255, 214, 140, Math.round(alpha * 255));
      }
    }
  });
}

/** Lune : bande de 8 phases de 32 px (0 pleine lune, 4 nouvelle lune). */
function moonTexture() {
  const radius = 10;
  const craters = [[-0.35, -0.25, 0.28], [0.3, 0.15, 0.22], [0.05, 0.5, 0.2], [-0.15, 0.12, 0.13], [0.42, -0.42, 0.15], [-0.5, 0.35, 0.14]];
  return pixelTexture(256, 32, (img) => {
    for (let frame = 0; frame < 8; frame++) {
      const a = frame / 8 * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
      const litShare = (1 + ca) / 2;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const u = (x + 0.5 - 16) / radius, v = (y + 0.5 - 16) / radius;
        const d2 = u * u + v * v;
        const px = frame * 32 + x;
        if (d2 <= 1) {
          // Eclairee si la normale de la sphere regarde le soleil.
          const w = Math.sqrt(1 - d2);
          if (-u * sa + w * ca > -1e-3) {
            let crater = false;
            for (const [cx, cy, cr] of craters) if ((u - cx) * (u - cx) + (v - cy) * (v - cy) < cr * cr) { crater = true; break; }
            if (crater) put(img, px, y, 198, 204, 222, 255);
            else put(img, px, y, 236, 240, 250, 255);
          } else put(img, px, y, 46, 56, 88, 70);
        } else if (d2 <= 2.25 && litShare > 0.05) {
          // Leger halo, plus fort quand la lune est pleine.
          const k = 1 - (Math.sqrt(d2) - 1) / 0.5;
          put(img, px, y, 200, 215, 255, Math.round(Math.ceil(k * 2) / 2 * 40 * litShare));
        }
      }
    }
  });
}

export function createVoxelAtmosphere(scene: THREE.Scene): VoxelAtmosphere {
  // ------------------------------------------------------------ voute
  const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 20);
  const skyPositions = skyGeometry.getAttribute("position");
  const vertexCount = skyPositions.count;
  const directions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    directions[i * 3] = skyPositions.getX(i) / SKY_RADIUS;
    directions[i * 3 + 1] = skyPositions.getY(i) / SKY_RADIUS;
    directions[i * 3 + 2] = skyPositions.getZ(i) / SKY_RADIUS;
  }
  const skyColors = new Float32Array(vertexCount * 3);
  const skyColorAttribute = new THREE.BufferAttribute(skyColors, 3);
  skyColorAttribute.setUsage(THREE.DynamicDrawUsage);
  skyGeometry.setAttribute("color", skyColorAttribute);
  const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
  skyMesh.renderOrder = -10;
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  function paintSky(sky: SkyState) {
    const h = sky.horizon, z = sky.zenith, g = sky.glow, s = sky.sunDir;
    for (let i = 0, o = 0; i < vertexCount; i++, o += 3) {
      const dx = directions[o], dy = directions[o + 1], dz = directions[o + 2];
      let r: number, gr: number, b: number;
      if (dy >= 0) {
        const t = Math.pow(dy, 0.55);
        r = h.r + (z.r - h.r) * t; gr = h.g + (z.g - h.g) * t; b = h.b + (z.b - h.b) * t;
      } else {
        // Sous l'horizon : l'horizon assombri doucement (le bord du monde, noye
        // dans le brouillard couleur horizon, ne doit pas trancher).
        const k = 1 - 0.2 * Math.pow(smooth(0, 1, -dy), 1.5);
        r = h.r * k; gr = h.g * k; b = h.b * k;
      }
      const d = dx * s.x + dy * s.y + dz * s.z;
      if (d > 0) {
        let p = d * d; p *= p; p *= p;
        const f = p * smooth(-0.18, 0.04, dy);
        r += g.r * f; gr += g.g * f; b += g.b * f;
      }
      skyColors[o] = Math.min(1, r); skyColors[o + 1] = Math.min(1, gr); skyColors[o + 2] = Math.min(1, b);
    }
    skyColorAttribute.needsUpdate = true;
  }

  // ------------------------------------------------------------ soleil et lune
  const sunMap = sunTexture();
  const sunGeometry = new THREE.PlaneGeometry(12, 12);
  const sunMaterial = new THREE.MeshBasicMaterial({ map: sunMap, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.renderOrder = -8;
  scene.add(sun);

  const moonMap = moonTexture();
  moonMap.repeat.set(1 / 8, 1);
  const moonGeometry = new THREE.PlaneGeometry(9, 9);
  const moonMaterial = new THREE.MeshBasicMaterial({ map: moonMap, transparent: true, fog: false, depthWrite: false, toneMapped: false });
  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
  moon.renderOrder = -8;
  scene.add(moon);

  // ------------------------------------------------------------ etoiles
  const rand = seeded(0x51e7);
  const starPositions = new Float32Array(STAR_COUNT * 3), starColors = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Tirage uniforme sur l'hemisphere superieure (y uniforme = aire uniforme).
    const y = 0.015 + rand() * 0.985, angle = rand() * Math.PI * 2, ring = Math.sqrt(1 - y * y);
    starPositions[i * 3] = Math.cos(angle) * ring * STAR_RADIUS;
    starPositions[i * 3 + 1] = y * STAR_RADIUS;
    starPositions[i * 3 + 2] = Math.sin(angle) * ring * STAR_RADIUS;
    // Surtout des etoiles pales, quelques brillantes ; bleutees ou chaudes parfois.
    // Melange additif : plus sombre = plus transparent. Pres de l'horizon elles s'eteignent.
    const light = (0.3 + 0.7 * rand() * rand()) * smooth(0.02, 0.22, y);
    const tint = rand();
    const tr = tint < 0.15 ? 0.8 : 1, tg = tint < 0.15 ? 0.88 : tint < 0.25 ? 0.9 : 1, tb = tint < 0.25 && tint >= 0.15 ? 0.75 : 1;
    starColors[i * 3] = tr * light; starColors[i * 3 + 1] = tg * light; starColors[i * 3 + 2] = tb * light;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMaterial = new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  scene.add(stars);

  // ------------------------------------------------------------ nuages
  // Non eclaires : chaque face garde sa teinte (dessus blanc, cotes a peine
  // ombres, dessous gris bleute), multipliee par sky.cloudColor.
  const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
  const faceShades = ["#f1f5f7", "#f1f5f7", "#ffffff", "#d9e3ea", "#e9eff3", "#e9eff3"];
  const cloudShades = new Float32Array(24 * 3);
  const shade = new THREE.Color();
  // Double conversion conservee de l'ancien ciel : les teintes reglees a l'oeil
  // (dessous nettement plus gris) restent identiques.
  faceShades.forEach((hex, face) => {
    shade.set(hex).convertSRGBToLinear();
    for (let v = 0; v < 4; v++) shade.toArray(cloudShades, (face * 4 + v) * 3);
  });
  cloudGeometry.setAttribute("color", new THREE.BufferAttribute(cloudShades, 3));
  const cloudFade = { value: new THREE.Vector2(CLOUD_FADE_NEAR, CLOUD_FADE_FAR) };
  const cloudMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true });
  // Fondu selon la distance a la camera : les nuages lointains disparaissent
  // avant d'atteindre le bord de la case, la boucle reste invisible.
  cloudMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uNuageFondu = cloudFade;
    shader.vertexShader = "varying vec3 vNuageVue;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n\tvNuageVue = mvPosition.xyz;",
    );
    shader.fragmentShader = "uniform vec2 uNuageFondu;\nvarying vec3 vNuageVue;\n" + shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      "#include <alphamap_fragment>\n\tdiffuseColor.a *= 1.0 - smoothstep(uNuageFondu.x, uNuageFondu.y, length(vNuageVue));",
    );
  };
  cloudMaterial.customProgramCacheKey = () => "cubes-nuages";

  const cloudCount = CLOUD_CLUSTERS * CLOUD_PARTS;
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudCount);
  clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clouds.frustumCulled = false;
  clouds.renderOrder = -7;
  // Chaque nuage : une dalle principale, une dalle voisine, une bosse sur le dessus.
  const clusterX = new Float32Array(CLOUD_CLUSTERS), clusterY = new Float32Array(CLOUD_CLUSTERS), clusterZ = new Float32Array(CLOUD_CLUSTERS);
  const partX = new Float32Array(cloudCount), partY = new Float32Array(cloudCount), partZ = new Float32Array(cloudCount);
  const sizeX = new Float32Array(cloudCount), sizeY = new Float32Array(cloudCount), sizeZ = new Float32Array(cloudCount);
  const cloudRand = seeded(0xc10d);
  const side = () => (cloudRand() < 0.5 ? -1 : 1);
  for (let c = 0; c < CLOUD_CLUSTERS; c++) {
    clusterX[c] = cloudRand() * CLOUD_TILE;
    clusterZ[c] = cloudRand() * CLOUD_TILE;
    // Entre y 96 et 105 (dalle de 3 blocs, bosse jusqu'a 108.5) : au-dessus des montagnes.
    clusterY[c] = 96 + Math.floor(cloudRand() * 4) * 3;
    const w = 14 + Math.floor(cloudRand() * 16), d = 10 + Math.floor(cloudRand() * 12);
    const i = c * CLOUD_PARTS;
    partX[i] = 0; partY[i] = 0; partZ[i] = 0;
    sizeX[i] = w; sizeY[i] = 3; sizeZ[i] = d;
    partX[i + 1] = side() * Math.round(w * 0.35); partY[i + 1] = 0; partZ[i + 1] = side() * Math.round(d * 0.4);
    sizeX[i + 1] = Math.round(w * (0.45 + cloudRand() * 0.3)); sizeY[i + 1] = 3; sizeZ[i + 1] = Math.round(d * (0.5 + cloudRand() * 0.3));
    partX[i + 2] = Math.round((cloudRand() - 0.5) * w * 0.3); partY[i + 2] = 2.5; partZ[i + 2] = Math.round((cloudRand() - 0.5) * d * 0.3);
    sizeX[i + 2] = Math.round(w * 0.45); sizeY[i + 2] = 2; sizeZ[i + 2] = Math.round(d * 0.45);
  }
  // Matrices identite une fois : ensuite on n'ecrit que l'echelle et la translation.
  const identity = new THREE.Matrix4();
  for (let i = 0; i < cloudCount; i++) clouds.setMatrixAt(i, identity);
  const cloudMatrices = clouds.instanceMatrix.array as Float32Array;
  scene.add(clouds);

  let wind = 0;
  let painted = false, paintedPhase = 0, sincePaint = 0;

  return {
    update(camera, dt, sky) {
      const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.1) : 0;
      const eye = camera.position, sd = sky.sunDir;

      // Voute : suit la camera, recoloree seulement quand l'heure avance.
      skyMesh.position.copy(eye);
      sincePaint += step;
      let jump = Math.abs(sky.phase - paintedPhase);
      jump = Math.min(jump, 1 - jump);
      if (!painted || jump > REPAINT_JUMP || (sincePaint >= REPAINT_EVERY && jump > 0)) {
        paintSky(sky);
        painted = true; paintedPhase = sky.phase; sincePaint = 0;
      }
      if (scene.background instanceof THREE.Color) scene.background.copy(sky.horizon);
      if (scene.fog) scene.fog.color.copy(sky.horizon);

      // Soleil : face a la camera, efface en passant sous l'horizon.
      sun.visible = sd.y > -0.1;
      if (sun.visible) {
        sun.position.copy(eye).addScaledVector(sd, BODY_DISTANCE);
        sun.quaternion.copy(camera.quaternion);
        sunMaterial.opacity = smooth(-0.1, 0.03, sd.y);
        sunMaterial.color.setRGB(1, 1, 1).lerp(sky.sunColor, 0.55);
      }
      // Lune : a l'oppose, plus franche quand la nuit est noire.
      moon.visible = sd.y < 0.1;
      if (moon.visible) {
        moon.position.copy(eye).addScaledVector(sd, -BODY_DISTANCE);
        moon.quaternion.copy(camera.quaternion);
        moonMaterial.opacity = smooth(-0.1, 0.03, -sd.y) * (0.45 + 0.55 * sky.starOpacity);
        moonMap.offset.x = (Math.floor(sky.moonPhase) & 7) / 8;
      }

      // Etoiles : tournent lentement avec l'heure (un tour par jour).
      stars.visible = sky.starOpacity > 0.01;
      if (stars.visible) {
        starMaterial.opacity = sky.starOpacity;
        stars.position.copy(eye);
        stars.rotation.y = -sky.phase * Math.PI * 2;
      }

      // Nuages : derivent dans le monde et bouclent dans une case centree sur la camera.
      cloudMaterial.color.copy(sky.cloudColor);
      wind = (wind + step * WIND) % CLOUD_TILE;
      const cx = eye.x, cz = eye.z;
      for (let c = 0; c < CLOUD_CLUSTERS; c++) {
        let dx = clusterX[c] + wind - cx;
        dx -= Math.round(dx / CLOUD_TILE) * CLOUD_TILE;
        let dz = clusterZ[c] - cz;
        dz -= Math.round(dz / CLOUD_TILE) * CLOUD_TILE;
        const bx = cx + dx, by = clusterY[c], bz = cz + dz;
        for (let p = 0, i = c * CLOUD_PARTS; p < CLOUD_PARTS; p++, i++) {
          const o = i * 16;
          cloudMatrices[o] = sizeX[i]; cloudMatrices[o + 5] = sizeY[i]; cloudMatrices[o + 10] = sizeZ[i];
          cloudMatrices[o + 12] = bx + partX[i]; cloudMatrices[o + 13] = by + partY[i]; cloudMatrices[o + 14] = bz + partZ[i];
        }
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      scene.remove(skyMesh, sun, moon, stars, clouds);
      skyGeometry.dispose(); skyMaterial.dispose();
      sunGeometry.dispose(); sunMaterial.dispose(); sunMap.dispose();
      moonGeometry.dispose(); moonMaterial.dispose(); moonMap.dispose();
      starGeometry.dispose(); starMaterial.dispose();
      cloudGeometry.dispose(); cloudMaterial.dispose(); clouds.dispose();
    },
  };
}
