import * as THREE from "three";

// Ciel peint, nuages en un seul maillage instancie : aucun effet plein ecran.
export function createVoxelAtmosphere(scene: THREE.Scene) {
  const canvas = document.createElement("canvas");
  canvas.width = 8; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#438cce");
  gradient.addColorStop(.36, "#79bfdf");
  gradient.addColorStop(.52, "#d7e8da");
  gradient.addColorStop(.65, "#d6e7d3");
  gradient.addColorStop(1, "#accbb2");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 8, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const skyGeometry = new THREE.SphereGeometry(145, 24, 16);
  const skyMaterial = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.renderOrder = -10;
  scene.add(sky);

  // Nuages non eclaires : vus d'en dessous, la lumiere du sol (vert olive)
  // les rendait gris-vert. Chaque face garde sa teinte : dessus blanc,
  // cotes a peine ombres, dessous gris bleute.
  const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
  const faceShades = ["#f1f5f7", "#f1f5f7", "#ffffff", "#d9e3ea", "#e9eff3", "#e9eff3"];
  const cloudColors = new Float32Array(24 * 3);
  const shade = new THREE.Color();
  faceShades.forEach((hex, face) => {
    shade.set(hex).convertSRGBToLinear();
    for (let v = 0; v < 4; v++) shade.toArray(cloudColors, (face * 4 + v) * 3);
  });
  cloudGeometry.setAttribute("color", new THREE.BufferAttribute(cloudColors, 3));
  const cloudMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const cloudCount = 32;
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudCount);
  clouds.frustumCulled = false;
  const transform = new THREE.Object3D();
  for (let i = 0; i < cloudCount; i++) {
    const cluster = Math.floor(i / 4), part = i % 4;
    const angle = cluster * 2.399;
    transform.position.set(Math.cos(angle) * (40 + cluster * 9) + part * 4, 43 + cluster % 3 * 4 + part % 2, Math.sin(angle) * (40 + cluster * 9));
    transform.scale.set(12 + (i * 7) % 11, 1.3 + part * .25, 7 + (i * 3) % 8);
    transform.updateMatrix(); clouds.setMatrixAt(i, transform.matrix);
  }
  scene.add(clouds);
  const sunGeometry = new THREE.BoxGeometry(7, 7, .5);
  const sunMaterial = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: "#fff1bf", fog: false, toneMapped: false });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);
  const sunPosition = new THREE.Vector3(-58, 53, -90);
  let drift = 0;
  return {
    update(camera: THREE.Camera, delta: number) {
      sky.position.copy(camera.position);
      sun.position.copy(camera.position).add(sunPosition);
      sun.quaternion.copy(camera.quaternion);
      drift = (drift + delta * .32) % 300;
      clouds.position.set(camera.position.x + Math.sin(drift * .015) * 7, camera.position.y, camera.position.z);
    },
    dispose() {
      scene.remove(sky, sun, clouds);
      skyGeometry.dispose(); skyMaterial.dispose(); texture.dispose();
      cloudGeometry.dispose(); cloudMaterial.dispose(); clouds.dispose();
      sunGeometry.dispose(); sunMaterial.dispose();
    },
  };
}
