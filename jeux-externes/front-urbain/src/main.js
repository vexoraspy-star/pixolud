import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';

// Ajouts Pixolud : reglages partages, deroulement de la mission, resolution adaptative.
import {
  qualiteDeDepart,
  sensibilite,
  sensibiliteMoteur,
  luminosite,
  biaisExposition,
} from './pixolud/reglages.js';
import { Partie } from './pixolud/partie.js';
import { ResolutionAdaptative } from './pixolud/resolution.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
// Deterministic shutter for the pixel gate: the engine does not schedule its own
// frames, the driver advances exactly N of them through window.__PUMP__. Opt-in,
// because tools that measure real frame pacing (tools/perf.mjs) need the loop to
// free-run. See the long comment in src/dev/shots.js.
const lockstep = capture && params.get('lockstep') === '1';

// Pixolud : niveau prudent par defaut (detection simple de la carte graphique),
// ou celui que le joueur a choisi dans le menu. `?q=` reste possible pour mesurer.
const qualite = qualiteDeDepart(params);
const config = createConfig({
  quality: qualite.niveau,
  deterministic: capture,
  sensitivity: sensibiliteMoteur(sensibilite()),
});
config.qualityAuto = qualite.auto;

const canvas = document.getElementById('game');

// Pixolud : avance de l'ecran de chargement (index.html). L'init des systemes
// compte pour 70 %, la compilation des shaders (prewarm) pour les 30 % restants.
const ETAPES = {
  render: 'Moteur de rendu',
  materials: 'Matériaux',
  sky: 'Ciel et lumière',
  world: 'Construction de la ville',
  physics: 'Physique',
  player: 'Joueur',
  weapons: 'Armes',
  fx: 'Effets',
  ai: 'Soldats ennemis',
  ui: 'Interface',
  audio: 'Sons',
};
function avancer(fraction, texte) {
  const barre = document.getElementById('chargement-barre');
  if (barre) barre.style.width = `${Math.round(Math.max(0.02, Math.min(1, fraction)) * 100)}%`;
  const etape = document.getElementById('chargement-etape');
  if (etape && texte) etape.textContent = texte;
}

const engine = new Engine({ canvas, config });

// Registration order is irrelevant — Registry topo-sorts on static deps.
engine
  .add(RenderSystem)
  .add(MaterialSystem)
  .add(SkySystem)
  .add(WorldSystem)
  .add(PhysicsSystem)
  .add(PlayerSystem)
  .add(WeaponSystem)
  .add(FxSystem)
  .add(AiSystem)
  .add(UiSystem)
  .add(AudioSystem)
  .add(Partie)
  .add(ResolutionAdaptative);

try {
  await engine.init((fait, total, id) => {
    avancer((fait / total) * 0.7, `${ETAPES[id] ?? 'Préparation'}… (${fait + 1}/${total})`);
  });
} catch (err) {
  console.error('[boot] init failed', err);
  // Pixolud : message en francais, detail technique replie en dessous.
  document.getElementById('chargement')?.remove();
  const boite = document.createElement('div');
  boite.setAttribute('role', 'alert');
  boite.style.cssText =
    'position:fixed;inset:0;z-index:9999;overflow:auto;padding:2rem;background:#0b0a08;' +
    'color:#eef4f7;font:15px/1.6 Arial,sans-serif';
  const titre = document.createElement('h1');
  titre.style.cssText = 'font-size:22px;margin-bottom:12px';
  titre.textContent = 'Front Urbain n’a pas pu démarrer';
  const texte = document.createElement('p');
  texte.textContent =
    'Ce jeu a besoin de WebGL 2 et d’une carte graphique récente. Essaie de mettre ton ' +
    'navigateur à jour (Chrome, Edge ou Firefox), d’activer l’accélération matérielle, ' +
    'puis recharge la page.';
  const details = document.createElement('details');
  details.style.cssText = 'margin-top:16px;color:#f99';
  const resume = document.createElement('summary');
  resume.textContent = 'Détail technique';
  const pre = document.createElement('pre');
  pre.style.cssText = 'white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace';
  pre.textContent = String(err?.stack ?? err?.message ?? err);
  details.append(resume, pre);
  boite.append(titre, texte, details);
  document.body.appendChild(boite);
  throw err;
}

// Luminosite partagee des jeux 3D Pixolud -> correction d'exposition.
engine.ctx.peek('render')?.setExposureBias?.(biaisExposition(luminosite()));

const shotApi = installShotApi(engine, { capture, lockstep });

// Compile every shader permutation before the frame loop starts. Measured: without
// this, 86 programs compile lazily during play, up to 30 on one frame, producing
// 3.1-3.9 SECOND stalls. See src/core/prewarm.js.
//
// ON BY DEFAULT since the capture path was made frame-deterministic; opt out with
// `?prewarm=0`. It is now PROVEN pixel-neutral: `tools/baseline.mjs` with
// `--query=prewarm=0` vs `--query=prewarm=1` reports identical:true on all 11
// shots (0 changed pixels, maxDelta 0). The two things that previously made the
// ~1.4 s pre-warm spend look like a visual change were both boot-duration
// couplings OUTSIDE the subsystems: (1) the shutter frame index was latency-bound
// because the engine kept stepping through the driver's round trips — fixed by
// lockstep in src/dev/shots.js; (2) `will-change: transform` on the compass strip
// cached a composited-layer raster taken at a wall-clock-dependent moment — fixed
// in src/ui/style.js.
// Pixolud : la compilation des shaders peut durer plus d'une minute sous
// Windows sans que la barre bouge ; un compteur de secondes montre que ca vit.
const debutPrewarm = performance.now();
let avancePrewarm = 0;
const texteChrono = () =>
  `Préparation des effets graphiques… ${Math.round((performance.now() - debutPrewarm) / 1000)} s`;
avancer(0.7, texteChrono());
const chrono = setInterval(() => avancer(0.7 + 0.3 * avancePrewarm, texteChrono()), 1000);
let warmup;
try {
  warmup =
    params.get('prewarm') === '0'
      ? { ok: false, reason: 'disabled by ?prewarm=0' }
      : await prewarm(engine, {
          onProgress: (p) => {
            avancePrewarm = typeof p === 'number' ? p : avancePrewarm;
            avancer(0.7 + 0.3 * avancePrewarm, texteChrono());
          },
        });
} finally {
  clearInterval(chrono);
}
console.info('[boot] prewarm', warmup);
window.__PREWARM__ = warmup;

// Pixolud : briefing et touches avant de lacher le joueur dans la rue ; le
// temps du jeu reste fige jusqu'au clic sur "Commencer la mission".
if (!capture) engine.ctx.peek('partie')?.afficherAccueil(qualite);

engine.start();

// Capture harness handshake: only flag ready once a frame has actually landed.
//
// BOOT_FRAMES is deliberately a frame COUNT, not a rAF race. In lockstep mode the
// engine has no loop of its own, so we hand-pump exactly this many frames and only
// then raise __READY__; the shot is therefore always applied at engine frame 3, no
// matter how long boot (or pre-warm) took in wall-clock terms.
const BOOT_FRAMES = 3;
if (lockstep) {
  await shotApi.pump(BOOT_FRAMES);
  window.__READY__ = true;
  document.getElementById('chargement')?.remove();
} else {
  let warm = 0;
  const readyProbe = () => {
    if (++warm >= BOOT_FRAMES) {
      window.__READY__ = true;
      // Pixolud : la premiere image est la, on retire l'ecran de chargement.
      document.getElementById('chargement')?.remove();
      return;
    }
    requestAnimationFrame(readyProbe);
  };
  requestAnimationFrame(readyProbe);
}

window.__ENGINE__ = engine;

if (import.meta.hot) {
  import.meta.hot.dispose(() => engine.dispose());
}
