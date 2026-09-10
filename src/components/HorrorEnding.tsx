"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { makeDawnSkyTexture, makeFacadeTexture } from "@/lib/manorTextures";
import { createAudio, playHatch, playWhisper, playStinger } from "@/lib/manorAudio";

interface Beat {
  at: number;
  text: string;
}

// Epilogue : on sort par la trappe a l'aube, et la derniere image explique
// enfin ce que racontaient les cinq objets.
const BEATS: Beat[] = [
  { at: 0, text: "Tu pousses la trappe. L'air froid te brûle les poumons." },
  { at: 4.4, text: "Le jour se lève. Derrière toi, le manoir se tait enfin." },
  { at: 9.2, text: "À la fenêtre de l'étage, quelqu'un te regarde partir." },
  {
    at: 14.2,
    text: "Sur la photo de famille déchirée, le visage rayé... c'était le tien.",
  },
];
const DURATION = 19.5;

export default function HorrorEnding({ onDone }: { onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(BEATS[0].text);
  const [fade, setFade] = useState(1);
  const [showButton, setShowButton] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1726);
    scene.fog = new THREE.Fog(0x241f2e, 30, 130);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      400,
    );
    camera.rotation.order = "YXZ";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x6a6a92, 0x2a2118, 1.15));
    const sun = new THREE.DirectionalLight(0xffb277, 1.15);
    sun.position.set(-40, 18, 40);
    scene.add(sun);

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 170),
      new THREE.MeshBasicMaterial({ map: makeDawnSkyTexture(), depthWrite: false }),
    );
    sky.position.set(0, 46, -150);
    scene.add(sky);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshLambertMaterial({ color: 0x1b2117 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Le manoir, vu de l'arriere : on en sort.
    const manor = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(46, 30, 22),
      new THREE.MeshLambertMaterial({ color: 0x14120f }),
    );
    body.position.set(0, 15, -12);
    manor.add(body);
    const facade = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 39),
      new THREE.MeshBasicMaterial({ map: makeFacadeTexture(), transparent: true }),
    );
    facade.position.set(0, 19.5, -0.9);
    manor.add(facade);
    manor.position.set(0, 0, -34);
    scene.add(manor);

    // La fenetre de l'etage qui s'allume, et la silhouette dedans. La
    // position est calculee pour tomber pile sur une fenetre peinte de la
    // facade (texture 512x384, fenetres a wx=92+col*68, wy=128+row*82).
    const FACADE_Z = -34.9;
    const winX = (177 / 512 - 0.5) * 52;
    const winY = (1 - 151 / 384) * 39;
    const window1 = new THREE.Mesh(
      new THREE.PlaneGeometry(3.45, 4.67),
      new THREE.MeshBasicMaterial({ color: 0xffb14d, transparent: true, opacity: 0 }),
    );
    window1.position.set(winX, winY, FACADE_Z + 0.08);
    scene.add(window1);
    const watcher = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 3.1),
      new THREE.MeshBasicMaterial({ color: 0x0a0708, transparent: true, opacity: 0 }),
    );
    watcher.position.set(winX, winY - 0.5, FACADE_Z + 0.16);
    scene.add(watcher);
    const watcherHead = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 12),
      new THREE.MeshBasicMaterial({ color: 0x0a0708, transparent: true, opacity: 0 }),
    );
    watcherHead.position.set(winX, winY + 1.3, FACADE_Z + 0.16);
    scene.add(watcherHead);

    // La trappe d'ou l'on emerge, au premier plan.
    const hatch = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.3, 3.2),
      new THREE.MeshLambertMaterial({ color: 0x2b241a }),
    );
    hatch.position.set(1.6, 0.15, 12);
    hatch.rotation.y = 0.4;
    scene.add(hatch);

    // Herbes hautes : quelque chose de vivant, enfin.
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2c3a21, side: THREE.DoubleSide });
    const bladeGeo = new THREE.PlaneGeometry(0.16, 1.5);
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, 360);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 360; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 34;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, 0.75, 14 + Math.sin(a) * r * 0.55),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0)),
        new THREE.Vector3(1, 0.6 + Math.random() * 0.8, 1),
      );
      grass.setMatrixAt(i, m);
    }
    scene.add(grass);

    const audio = createAudio();
    audio.setTension(0.15);
    let elapsed = 0;
    let lastTime = performance.now();
    let beatIndex = -1;
    let hatchDone = false;
    let watcherShown = false;

    function tick() {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += delta;

      let idx = 0;
      for (let i = 0; i < BEATS.length; i++) if (elapsed >= BEATS[i].at) idx = i;
      if (idx !== beatIndex) {
        beatIndex = idx;
        setCaption(BEATS[idx].text);
      }

      // Ouverture : on emerge du trou. Fermeture : fondu au noir.
      if (elapsed < 2.6) setFade(Math.max(0, 1 - elapsed / 2.6));
      else if (elapsed > DURATION - 3) setFade(Math.min(1, (elapsed - (DURATION - 3)) / 3));

      if (!hatchDone && elapsed > 0.35) {
        hatchDone = true;
        playHatch(audio.ctx, audio.master);
      }

      // La camera sort du sol, se releve, puis se retourne vers le manoir.
      let camY: number;
      let yaw: number;
      let pitch = 0;
      if (elapsed < 4.4) {
        const t = Math.min(1, elapsed / 4.4);
        camY = THREE.MathUtils.lerp(-1.4, 1.75, t * t * (3 - 2 * t));
        yaw = Math.PI; // dos au manoir : on regarde la plaine
        pitch = THREE.MathUtils.lerp(0.35, 0.02, t);
      } else if (elapsed < 9.2) {
        const t = (elapsed - 4.4) / 4.8;
        camY = 1.75;
        // demi-tour lent vers le manoir
        yaw = THREE.MathUtils.lerp(Math.PI, 0, t * t * (3 - 2 * t));
      } else {
        const t = Math.min(1, (elapsed - 9.2) / (DURATION - 9.2));
        camY = 1.75;
        yaw = 0;
        // le regard remonte vers la fenetre de l'etage (elle est a ~0.44 rad)
        pitch = THREE.MathUtils.lerp(0, 0.42, t * t * (3 - 2 * t));
      }
      camera.position.set(1.2 + Math.sin(elapsed * 0.8) * 0.1, camY, 12.4);
      camera.rotation.set(pitch, yaw, Math.sin(elapsed * 1.6) * 0.008);

      // La fenetre s'allume, puis la silhouette s'y installe.
      if (elapsed >= 8.6) {
        const t = Math.min(1, (elapsed - 8.6) / 2.4);
        (window1.material as THREE.MeshBasicMaterial).opacity = t * 0.85;
      }
      if (elapsed >= 10.4) {
        const t = Math.min(1, (elapsed - 10.4) / 1.6);
        (watcher.material as THREE.MeshBasicMaterial).opacity = t;
        (watcherHead.material as THREE.MeshBasicMaterial).opacity = t;
        if (!watcherShown) {
          watcherShown = true;
          playWhisper(audio.ctx, audio.master, { pan: -0.4, gain: 1.1 });
          window.setTimeout(() => playStinger(audio.ctx, audio.master, { pan: -0.3 }), 900);
        }
      }

      if (elapsed >= DURATION) {
        setShowButton(true);
        renderer.render(scene, camera);
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

  function finishFromButton() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black select-none">
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: fade }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-6">
        <p className="max-w-xl text-center text-base leading-relaxed text-zinc-100 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
          {caption}
        </p>
      </div>
      {showButton ? (
        <button
          type="button"
          onClick={finishFromButton}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-600"
        >
          Continuer
        </button>
      ) : (
        <button
          type="button"
          onClick={finishFromButton}
          className="absolute bottom-5 right-5 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
        >
          Passer →
        </button>
      )}
    </div>
  );
}
