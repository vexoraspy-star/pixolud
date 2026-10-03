"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ATTAQUES, ENERGIE_MAX, type ColosseId, type Difficulte } from "@/lib/colosses";
import {
  Combat,
  TEMPS_FURIE,
  commandeVide,
  type Combattant,
  type Commande,
  type Cote,
  type Evenement,
  type Projectile,
} from "@/lib/colossesCombat";
import { Ordinateur } from "@/lib/colossesIA";
import { animerCombattant, familleDuCoup, nouveauVisuel, type Visuel } from "@/lib/colossesGestes";
import { construireColosse, habillerColosse, redresserCape, type ModeleColosse } from "@/lib/colossesModeles";
import { createAnimatedModel, type AnimatedModel } from "@/lib/models3d";
import { appliquerPose, poseCible, vitessePose, type ContexteAnim, type EtatAnim } from "@/lib/colossesPoses";
import {
  creerAudio,
  sonAcheve,
  sonBloc,
  sonEclats,
  sonFoudre,
  sonFurie,
  sonGong,
  sonKo,
  sonPied,
  sonPoing,
  sonProjectile,
  sonRayon,
  sonSaut,
  sonSeisme,
  sonSol,
  sonSpecial,
  sonTeleport,
  sonVent,
  type ColossesAudio,
} from "@/lib/colossesAudio";

/**
 * Colosses : la scene.
 *
 * Les regles vivent dans colossesCombat.ts (qui touche qui, qui bloque, qui
 * tombe) et l'ordinateur dans colossesIA.ts. Ici, on ne fait que montrer : le
 * temple, les deux combattants (leurs gestes viennent de colossesGestes.ts),
 * les etincelles, les projectiles, la camera — et on traduit le clavier en
 * commandes pour le moteur.
 *
 * Conventions de la maison (CLAUDE.md) : boucle a setInterval(16 ms), delta
 * plafonne, MeshLambertMaterial uniquement, peu de lumieres, et tout est
 * libere a la sortie.
 */

export interface ColossesEtat {
  vieA: number;
  vieB: number;
  energieA: number;
  energieB: number;
  roundsA: number;
  roundsB: number;
  round: number;
  temps: number;
  /** Message affiche en grand au centre ("Round 1", "K.O. !", "Achève-le !"...). */
  annonce: string;
  /** Rempli quand le match est fini : "A" ou "B". */
  vainqueur: "A" | "B" | null;
  /** Combo en cours : celui que A inflige a B, et l'inverse. */
  comboA: { coups: number; pourcent: number } | null;
  comboB: { coups: number; pourcent: number } | null;
  /** Une indication sous l'annonce (le code du coup de grace). */
  indice: string;
}

export interface ColossesOptions {
  /** Faux = deux joueurs sur le meme clavier. */
  contreOrdinateur: boolean;
  difficulte: Difficulte;
  volume: number;
  /** Le joueur B est le reflet sombre de son personnage (fin du tournoi). */
  boss?: boolean;
  /** Jeu en pause (menu de pause ouvert). */
  pause?: boolean;
}

interface Touches {
  gauche: string[];
  droite: string[];
  saut: string[];
  bas: string[];
  poing: string[];
  pied: string[];
  pouvoir: string[];
  garde: string[];
}

/**
 * Joueur 1, en solo : les fleches servent aussi, c'est plus confortable.
 *
 * ATTENTION : a deux sur le clavier, ces fleches appartiennent au joueur 2.
 * Les laisser au joueur 1 faisait avancer LES DEUX personnages en meme temps —
 * on appuyait a gauche, les deux reculaient, et aucun coup ne portait.
 */
const TOUCHES_A_SOLO: Touches = {
  gauche: ["q", "a", "arrowleft"],
  droite: ["d", "arrowright"],
  saut: ["z", "w", "arrowup"],
  bas: ["s", "arrowdown"],
  poing: ["f"],
  pied: ["g"],
  pouvoir: ["h"],
  garde: [" ", "j"],
};

/** Joueur 1, a deux sur le clavier : la main gauche et le milieu du clavier. */
const TOUCHES_A_DUO: Touches = {
  gauche: ["q", "a"],
  droite: ["d"],
  saut: ["z", "w"],
  bas: ["s"],
  poing: ["f"],
  pied: ["g"],
  pouvoir: ["h"],
  garde: [" ", "j"],
};

/** Joueur 2 : les fleches et la main droite. */
const TOUCHES_B: Touches = {
  gauche: ["arrowleft"],
  droite: ["arrowright"],
  saut: ["arrowup"],
  bas: ["arrowdown"],
  poing: ["o"],
  pied: ["p"],
  pouvoir: ["m"],
  garde: ["l"],
};

const FRAICHES = ["poing", "pied", "pouvoir", "gardePressee", "gauchePressee", "droitePressee", "basPresse", "hautPresse"] as const;

/** Couleur de la pierre (petrification, gravats). */
const PIERRE = 0x9a948a;

/** Un combattant, cote image. */
interface Rendu {
  c: Combattant;
  /** Le modele dessine en code : il se bat tant que le vrai n'est pas charge. */
  modele: ModeleColosse;
  anime: AnimatedModel | null;
  /** Les capes du modele anime, et leur rotation d'origine (voir redresserCape). */
  capes: { obj: THREE.Object3D; attache: THREE.Quaternion }[];
  visuel: Visuel;
  /** Orientation lissee du corps. */
  tourne: number;
  vrille: number;
  hauteur: number;
  materiaux: THREE.Material[] | null;
  couleurs: Map<THREE.Material, THREE.Color>;
  /** Effets du coup de grace subi : statue, chute foudroyee, parti en gravats. */
  petrifie: boolean;
  tombe: boolean;
  disparu: boolean;
  /** Dernier clignotement d'impact, pour le modele de secours. */
  flash: number;
}

export default function ColossesScene({
  persoA,
  persoB,
  options,
  onEtat,
  onFin,
  onMessage,
}: {
  persoA: ColosseId;
  persoB: ColosseId;
  options: ColossesOptions;
  onEtat: (e: ColossesEtat) => void;
  onFin: (vainqueur: "A" | "B") => void;
  onMessage?: (cote: Cote | null, texte: string) => void;
}) {
  const hote = useRef<HTMLDivElement>(null);
  // Les callbacks changent a chaque rendu React : on les garde dans des refs
  // pour que la boucle de jeu n'ait pas besoin d'etre recreee.
  const etatRef = useRef(onEtat);
  const finRef = useRef(onFin);
  const messageRef = useRef(onMessage);
  const optionsRef = useRef(options);
  useEffect(() => {
    etatRef.current = onEtat;
    finRef.current = onFin;
    messageRef.current = onMessage;
    optionsRef.current = options;
  });

  useEffect(() => {
    const container = hote.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0a1c);
    scene.fog = new THREE.Fog(0x0c0a1c, 18, 44);

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 2.4, 11);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Lumieres : cinq en tout (la regle de la maison en tolere huit) ---
    const ciel = new THREE.HemisphereLight(0xb4c4ff, 0x1c1226, 2.0);
    scene.add(ciel);
    const cle = new THREE.DirectionalLight(0xffe8c8, 1.6);
    cle.position.set(3, 8, 9);
    scene.add(cle);
    const contre = new THREE.DirectionalLight(0x7ab8ff, 1.0);
    contre.position.set(-5, 6, -7);
    scene.add(contre);

    const aJeter: { dispose(): void }[] = [];
    function garder<T extends { dispose(): void }>(x: T): T {
      aJeter.push(x);
      return x;
    }

    // ================================================================ decor
    // Un temple de pierre au clair de lune : dalles, colonnes, deux gardiens
    // de pierre et des braseros. Des volumes simples, tous poses ici.
    const pierre = garder(new THREE.MeshLambertMaterial({ color: 0x5b5566 }));
    const pierreSombre = garder(new THREE.MeshLambertMaterial({ color: 0x3a3544 }));
    const pierreClaire = garder(new THREE.MeshLambertMaterial({ color: 0x7a7488 }));

    // Le sol : une grande dalle sombre, et un damier la ou l'on se bat. Le
    // damier sert de regle — sans reperes, on ne juge plus les distances.
    const socle = new THREE.Mesh(garder(new THREE.BoxGeometry(60, 1, 34)), pierreSombre);
    socle.position.y = -0.52;
    scene.add(socle);
    const dalleGeo = garder(new THREE.BoxGeometry(1.86, 0.4, 1.86));
    for (let i = -8; i <= 8; i++) {
      for (let j = -2; j <= 1; j++) {
        const dalle = new THREE.Mesh(dalleGeo, (i + j) % 2 === 0 ? pierre : pierreClaire);
        dalle.position.set(i * 1.9, -0.2, j * 1.9 + 0.4);
        scene.add(dalle);
      }
    }

    // Le mur du fond, ses creneaux, et un embleme lumineux au centre.
    const mur = new THREE.Mesh(garder(new THREE.BoxGeometry(60, 6.2, 1)), pierreSombre);
    mur.position.set(0, 3.1, -6.5);
    scene.add(mur);
    const creneauGeo = garder(new THREE.BoxGeometry(1.2, 0.9, 1.1));
    for (let x = -28; x <= 28; x += 2.4) {
      const c = new THREE.Mesh(creneauGeo, pierre);
      c.position.set(x, 6.65, -6.5);
      scene.add(c);
    }
    // L'embleme du temple : un anneau et une flamme en losange. (Une croix
    // dans un cercle avait ete essayee : on aurait dit un bouton « fermer ».)
    const embleme = new THREE.Mesh(
      garder(new THREE.TorusGeometry(1.1, 0.1, 8, 36)),
      garder(new THREE.MeshBasicMaterial({ color: 0x9a1f3a })),
    );
    embleme.position.set(0, 4.1, -5.95);
    scene.add(embleme);
    const flamme = new THREE.Mesh(
      garder(new THREE.OctahedronGeometry(0.5, 0)),
      garder(new THREE.MeshBasicMaterial({ color: 0xffb454 })),
    );
    flamme.scale.set(0.8, 1.35, 0.15);
    flamme.position.set(0, 4.1, -5.9);
    scene.add(flamme);

    const colonneGeo = garder(new THREE.CylinderGeometry(0.42, 0.52, 5.6, 10));
    const chapiteauGeo = garder(new THREE.BoxGeometry(1.25, 0.4, 1.25));
    for (const x of [-13, -6.5, 6.5, 13]) {
      const c = new THREE.Mesh(colonneGeo, pierre);
      c.position.set(x, 3, -5.6);
      scene.add(c);
      const haut = new THREE.Mesh(chapiteauGeo, pierreClaire);
      haut.position.set(x, 5.9, -5.6);
      scene.add(haut);
      const bas = new THREE.Mesh(chapiteauGeo, pierreClaire);
      bas.position.set(x, 0.2, -5.6);
      scene.add(bas);
    }

    // Deux gardiens de pierre, bras croises sur leurs socles : ils regardent
    // le combat depuis le fond, comme des juges.
    const gardienYeux = garder(new THREE.MeshBasicMaterial({ color: 0xff7a3c }));
    const boite = (l: number, h: number, p: number, m: THREE.Material) =>
      new THREE.Mesh(garder(new THREE.BoxGeometry(l, h, p)), m);
    for (const x of [-9.8, 9.8]) {
      const g = new THREE.Group();
      const piedestal = boite(2.1, 1.2, 1.6, pierreClaire);
      piedestal.position.y = 0.6;
      g.add(piedestal);
      const jambes = boite(1.1, 1.7, 0.7, pierre);
      jambes.position.y = 2.05;
      g.add(jambes);
      const buste = boite(1.7, 1.5, 0.9, pierre);
      buste.position.y = 3.6;
      g.add(buste);
      const bras = boite(1.8, 0.45, 1.15, pierreClaire);
      bras.position.set(0, 3.55, 0.2);
      g.add(bras);
      const tete = boite(0.72, 0.82, 0.72, pierre);
      tete.position.y = 4.78;
      g.add(tete);
      const yeux = boite(0.5, 0.08, 0.05, gardienYeux);
      yeux.position.set(0, 4.85, 0.37);
      g.add(yeux);
      g.position.set(x, 0, -5.1);
      // Ils se tournent legerement vers le centre de l'arene.
      g.rotation.y = x < 0 ? 0.35 : -0.35;
      scene.add(g);
    }

    // La lune, loin derriere le mur : c'est elle qui donne l'heure du combat.
    const lune = new THREE.Mesh(
      garder(new THREE.SphereGeometry(1.9, 24, 16)),
      garder(new THREE.MeshBasicMaterial({ color: 0xece8ff, fog: false })),
    );
    lune.position.set(-4, 9.4, -16);
    scene.add(lune);
    const halo = new THREE.Mesh(
      garder(new THREE.CircleGeometry(3.2, 32)),
      garder(new THREE.MeshBasicMaterial({ color: 0x4b3f8a, transparent: true, opacity: 0.35, fog: false })),
    );
    halo.position.set(-4, 9.4, -16.5);
    scene.add(halo);

    // Braseros : la seule lumiere chaude de l'image.
    const feuMat = garder(new THREE.MeshBasicMaterial({ color: 0xffa23c }));
    const vasqueMat = garder(new THREE.MeshLambertMaterial({ color: 0x2a2530 }));
    const feux: THREE.Mesh[] = [];
    for (const x of [-4.4, 4.4]) {
      const pied = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.12, 0.22, 1.6, 8)), vasqueMat);
      pied.position.set(x, 0.8, -3.8);
      scene.add(pied);
      const vasque = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.58, 0.3, 0.42, 10)), vasqueMat);
      vasque.position.set(x, 1.7, -3.8);
      scene.add(vasque);
      const f = new THREE.Mesh(garder(new THREE.SphereGeometry(0.42, 8, 6)), feuMat);
      f.position.set(x, 2.06, -3.8);
      scene.add(f);
      feux.push(f);
      const l = new THREE.PointLight(0xff9a3c, 14, 12);
      l.position.set(x, 2.4, -3.3);
      scene.add(l);
    }

    // ============================================================ le combat
    const combat = new Combat(persoA, persoB, Boolean(optionsRef.current.boss));
    const ordi = optionsRef.current.contreOrdinateur ? new Ordinateur("B", optionsRef.current.difficulte) : null;

    function nouveauRendu(c: Combattant): Rendu {
      const modele = construireColosse(c.perso, garder);
      scene.add(modele.racine);
      scene.add(modele.ombre);
      return {
        c,
        modele,
        anime: null,
        capes: [],
        visuel: nouveauVisuel(),
        tourne: (c.sens * Math.PI) / 2,
        vrille: 0,
        hauteur: 0,
        materiaux: null,
        couleurs: new Map(),
        petrifie: false,
        tombe: false,
        disparu: false,
        flash: 0,
      };
    }
    const rendus = [nouveauRendu(combat.a), nouveauRendu(combat.b)];
    const renduDe = (c: Combattant) => (c === combat.a ? rendus[0] : rendus[1]);

    // Les vrais combattants animes arrivent des que le fichier est la. En
    // attendant (ou si le reseau echoue), le modele dessine en code se bat.
    let detruit = false;
    for (const r of rendus) {
      createAnimatedModel("colosse", 2.05)
        .then((m) => {
          if (detruit) {
            m.dispose();
            return;
          }
          const { capes } = habillerColosse(m, r.c.perso, garder);
          r.capes = capes.map((obj) => ({ obj, attache: obj.quaternion.clone() }));
          r.anime = m;
          r.materiaux = null;
          r.modele.os.corps!.visible = false;
          r.modele.racine.add(m.root);
        })
        .catch(() => {});
    }

    /** Tous les materiaux d'un combattant (pour la petrification, la brume...). */
    function materiaux(r: Rendu): THREE.Material[] {
      if (!r.materiaux) {
        const liste = new Set<THREE.Material>();
        r.modele.racine.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || !mesh.visible) return;
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) liste.add(m);
        });
        r.materiaux = [...liste];
      }
      return r.materiaux;
    }
    function teinter(r: Rendu, couleur: number, part: number) {
      const cible = new THREE.Color(couleur);
      for (const m of materiaux(r)) {
        const c = (m as THREE.MeshLambertMaterial).color;
        if (!c) continue;
        let base = r.couleurs.get(m);
        if (!base) {
          base = c.clone();
          r.couleurs.set(m, base);
        }
        c.copy(base).lerp(cible, part);
      }
    }
    function opacite(r: Rendu, a: number) {
      for (const m of materiaux(r)) {
        if (!m.transparent) {
          m.transparent = true;
          m.needsUpdate = true;
        }
        m.opacity = a;
        m.depthWrite = a > 0.95;
      }
    }
    function petrifier(r: Rendu) {
      r.petrifie = true;
      if (r.anime) r.anime.tint(() => true, PIERRE);
      for (const m of materiaux(r)) {
        const c = (m as THREE.MeshLambertMaterial).color;
        if (!c) continue;
        // Les couleurs de sommets portent deja la pierre : le materiau reste blanc.
        c.setHex((m as THREE.MeshLambertMaterial).vertexColors ? 0xffffff : PIERRE);
      }
    }

    // ============================================================= effets
    const particuleGeo = garder(new THREE.SphereGeometry(0.08, 8, 6));
    interface Particule {
      mesh: THREE.Mesh;
      vie: number;
      vieMax: number;
      vx: number;
      vy: number;
      vz: number;
      gravite: number;
      croissance: number;
      opacite: number;
    }
    const particules: Particule[] = [];
    function particule(
      x: number,
      y: number,
      z: number,
      couleur: number,
      o: { vx?: number; vy?: number; vz?: number; vie?: number; gravite?: number; taille?: number; croissance?: number; opacite?: number },
    ) {
      if (particules.length > 340) return;
      const opac = o.opacite ?? 1;
      const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opac, depthWrite: false });
      const mesh = new THREE.Mesh(particuleGeo, mat);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(o.taille ?? 1);
      scene.add(mesh);
      const vie = o.vie ?? 0.38;
      particules.push({
        mesh,
        vie,
        vieMax: vie,
        vx: o.vx ?? 0,
        vy: o.vy ?? 0,
        vz: o.vz ?? 0,
        gravite: o.gravite ?? 14,
        croissance: o.croissance ?? 0,
        opacite: opac,
      });
    }
    const hasard = (a: number) => (Math.random() - 0.5) * a;
    function eclats(x: number, y: number, couleur: number, combien: number, vitesse = 1) {
      for (let i = 0; i < combien; i++) {
        particule(x + hasard(0.4), y + hasard(0.4), 0.4, couleur, {
          vx: hasard(7) * vitesse,
          vy: (Math.random() * 5 + 1) * vitesse,
          vie: 0.38,
        });
      }
    }
    function fumee(x: number, y: number, combien: number, couleur = 0x5d5866, etendue = 0.5) {
      for (let i = 0; i < combien; i++) {
        particule(x + hasard(etendue), y + hasard(0.3), hasard(0.6), couleur, {
          vx: hasard(0.8),
          vy: 0.6 + Math.random() * 0.8,
          vie: 0.9 + Math.random() * 0.6,
          gravite: -0.3,
          taille: 1.8 + Math.random(),
          croissance: 2.2,
          opacite: 0.55,
        });
      }
    }
    function aura(c: Combattant, couleur: number, combien: number) {
      for (let i = 0; i < combien; i++) {
        particule(c.x + hasard(0.9), c.y + 0.2 + Math.random() * 1.8 * c.taille, hasard(0.6), couleur, {
          vx: hasard(0.6),
          vy: 1.2 + Math.random() * 1.6,
          vie: 0.55,
          gravite: -1,
          taille: 0.7,
        });
      }
    }

    // Les eclairs : une ligne brisee de petits segments lumineux.
    const segmentGeo = garder(new THREE.BoxGeometry(1, 1, 1));
    interface Trait {
      groupe: THREE.Group;
      mat: THREE.MeshBasicMaterial;
      vie: number;
      vieMax: number;
    }
    const traits: Trait[] = [];
    function foudre(x: number, yBas: number, couleur: number, hauteur = 11, epaisseur = 0.1, vie = 0.28) {
      const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false });
      const groupe = new THREE.Group();
      let px = x + hasard(1.4);
      let py = yBas + hauteur;
      const n = 9;
      for (let i = 1; i <= n; i++) {
        const ny = yBas + hauteur * (1 - i / n);
        const nx = i === n ? x : x + hasard(1.1);
        const dx = nx - px;
        const dy = ny - py;
        const seg = new THREE.Mesh(segmentGeo, mat);
        seg.scale.set(epaisseur, Math.hypot(dx, dy), epaisseur);
        seg.position.set((px + nx) / 2, (py + ny) / 2, 0.35);
        seg.rotation.z = Math.atan2(-dx, dy);
        groupe.add(seg);
        px = nx;
        py = ny;
      }
      scene.add(groupe);
      traits.push({ groupe, mat, vie, vieMax: vie });
    }

    // Anneaux au sol (seisme) et spheres d'energie (decharge, chocs).
    const anneauGeo = garder(new THREE.RingGeometry(0.75, 1, 40));
    const sphereFilGeo = garder(new THREE.IcosahedronGeometry(1, 1));
    interface Onde3D {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      vie: number;
      vieMax: number;
      de: number;
      vers: number;
    }
    const ondes3d: Onde3D[] = [];
    function onde3d(geo: THREE.BufferGeometry, x: number, y: number, couleur: number, de: number, vers: number, vie: number, sol: boolean, fil = false) {
      const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, depthWrite: false, side: THREE.DoubleSide, wireframe: fil });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0.1);
      if (sol) mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(de);
      scene.add(mesh);
      ondes3d.push({ mesh, mat, vie, vieMax: vie, de, vers });
    }

    // Gravats de la statue : des blocs qui retombent et restent au sol.
    const gravats: { mesh: THREE.Mesh; vx: number; vy: number; vr: number; pose: boolean }[] = [];
    const pierreGravats = garder(new THREE.MeshLambertMaterial({ color: PIERRE }));
    function briser(r: Rendu) {
      const c = r.c;
      const sens = Math.sign(c.x - combat.autre(c).x) || 1;
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(segmentGeo, pierreGravats);
        const t = 0.12 + Math.random() * 0.24;
        m.scale.set(t * (0.8 + Math.random() * 0.6), t, t * (0.8 + Math.random() * 0.6));
        m.position.set(c.x + hasard(0.6), 0.15 + Math.random() * 1.8 * c.taille, hasard(0.5));
        m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        scene.add(m);
        gravats.push({ mesh: m, vx: sens * (0.5 + Math.random() * 3) + hasard(1.5), vy: 1 + Math.random() * 4, vr: hasard(10), pose: false });
      }
      fumee(c.x, 0.8, 16, 0x8a8478, 1.2);
      r.disparu = true;
    }

    // Le rayon du ciel (coup de grace de Lame), et l'etoile qui brille au loin.
    let rayon: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } | null = null;
    let etoile: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number } | null = null;

    // ======================================================= projectiles
    const ondeGeo = garder(new THREE.SphereGeometry(0.3, 14, 10));
    const ondeHaloGeo = garder(new THREE.SphereGeometry(0.52, 14, 10));
    const lameGeo = garder(new THREE.TorusGeometry(0.38, 0.06, 6, 20, Math.PI));
    const lameHaloGeo = garder(new THREE.TorusGeometry(0.38, 0.16, 6, 20, Math.PI));
    const rocherGeo = garder(new THREE.DodecahedronGeometry(0.44, 0));
    const rocherMat = garder(new THREE.MeshLambertMaterial({ color: 0x7a7066 }));
    interface VisuelProjectile {
      groupe: THREE.Group;
      mats: THREE.Material[];
      p: Projectile;
    }
    const projVisuels = new Map<number, VisuelProjectile>();
    function creerProjectile(p: Projectile): VisuelProjectile {
      const accent = p.auteur.perso.accent;
      const groupe = new THREE.Group();
      const mats: THREE.Material[] = [];
      const basique = (color: number, opacity = 1) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
        mats.push(m);
        return m;
      };
      switch (p.def.forme) {
        case "lame": {
          const lame = new THREE.Mesh(lameGeo, basique(0xffffff));
          const lueur = new THREE.Mesh(lameHaloGeo, basique(accent, 0.45));
          for (const m of [lame, lueur]) {
            // L'arc regarde dans le sens de la course : « ) » vers la droite.
            m.rotation.z = p.sens > 0 ? -Math.PI / 2 : Math.PI / 2;
            m.scale.set(0.8, 1.3, 1);
            groupe.add(m);
          }
          break;
        }
        case "rocher":
          groupe.add(new THREE.Mesh(rocherGeo, rocherMat));
          break;
        case "voile": {
          groupe.add(new THREE.Mesh(ondeHaloGeo, basique(accent, 0.4)));
          groupe.add(new THREE.Mesh(ondeGeo, basique(0x3b2a5e, 0.75)));
          break;
        }
        default:
          groupe.add(new THREE.Mesh(ondeGeo, basique(0xffffff)));
          groupe.add(new THREE.Mesh(ondeHaloGeo, basique(accent, 0.5)));
      }
      groupe.position.set(p.x, p.y, 0.2);
      scene.add(groupe);
      const v = { groupe, mats, p };
      projVisuels.set(p.id, v);
      return v;
    }
    function retirerProjectile(id: number) {
      const v = projVisuels.get(id);
      if (!v) return;
      scene.remove(v.groupe);
      for (const m of v.mats) m.dispose();
      projVisuels.delete(id);
    }
    function majProjectiles(dt: number) {
      const vivants = new Set(combat.projectiles.map((p) => p.id));
      for (const id of [...projVisuels.keys()]) if (!vivants.has(id)) retirerProjectile(id);
      for (const p of combat.projectiles) {
        const v = projVisuels.get(p.id) ?? creerProjectile(p);
        const g = v.groupe;
        g.position.set(p.x, p.y + Math.sin(horloge * 20) * 0.04, 0.2);
        switch (p.def.forme) {
          case "rocher":
            g.rotation.z -= p.sens * dt * 9;
            if (Math.random() < 0.3) fumee(p.x - p.sens * 0.3, p.y - 0.3, 1, 0x6e665e, 0.2);
            break;
          case "voile":
            g.scale.setScalar(1 + Math.sin(horloge * 9) * 0.12);
            if (Math.random() < 0.5) particule(p.x, p.y, 0.2, p.auteur.perso.accent, { vx: hasard(1), vy: hasard(1), vie: 0.5, gravite: 0, taille: 1.4, opacite: 0.5 });
            break;
          case "lame":
            g.scale.set(1, 1 + Math.sin(horloge * 30) * 0.08, 1);
            if (Math.random() < 0.6) particule(p.x - p.sens * 0.3, p.y + hasard(0.5), 0.2, p.auteur.perso.accent, { vx: -p.sens * 2, vy: 0, vie: 0.2, gravite: 0, taille: 0.6 });
            break;
          default:
            g.scale.setScalar(1 + Math.sin(horloge * 30) * 0.12);
        }
      }
    }

    // ============================================================ clavier
    const touches = new Set<string>();
    const fraiches = new Set<string>();
    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (!touches.has(k)) fraiches.add(k);
      touches.add(k);
      // Les fleches et l'espace font defiler la page sous le jeu.
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      touches.delete(e.key.toLowerCase());
    }
    function onBlur() {
      touches.clear();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const enfoncee = (liste: string[]) => liste.some((k) => touches.has(k));
    const pressee = (liste: string[]) => liste.some((k) => fraiches.has(k));
    function lire(t: Touches): Commande {
      const cmd = commandeVide();
      cmd.gauche = enfoncee(t.gauche);
      cmd.droite = enfoncee(t.droite);
      cmd.haut = enfoncee(t.saut);
      cmd.bas = enfoncee(t.bas);
      cmd.garde = enfoncee(t.garde);
      cmd.poing = pressee(t.poing);
      cmd.pied = pressee(t.pied);
      cmd.pouvoir = pressee(t.pouvoir);
      cmd.gardePressee = pressee(t.garde);
      cmd.gauchePressee = pressee(t.gauche);
      cmd.droitePressee = pressee(t.droite);
      cmd.basPresse = pressee(t.bas);
      cmd.hautPresse = pressee(t.saut);
      return cmd;
    }
    /** Les appuis de l'ordinateur pendant un arret sur image, gardes pour l'image suivante. */
    let attenteOrdi: Partial<Commande> = {};

    // =========================================================== la partie
    const audio: ColossesAudio = creerAudio(optionsRef.current.volume);
    let horloge = 0;
    let derniere = performance.now();
    let tremblement = 0;
    /** Temps reel restant au ralenti (le K.O.). */
    let ralenti = 0;
    /** Eclair blanc dans le ciel (foudre, furie). */
    let eclairage = 0;
    let finAnnoncee = false;
    let auraT = 0;
    /** Etapes deja jouees du coup de grace. */
    const graceFaite = new Set<string>();

    const toucheGrace = (cote: Cote) => (cote === "A" ? "H" : optionsRef.current.contreOrdinateur ? "" : "M");

    function comboDe(cible: Combattant): { coups: number; pourcent: number } | null {
      const d = cible.dernierCombo;
      if (d.coups < 2 || combat.horloge - d.quand > 1.3) return null;
      return { coups: d.coups, pourcent: Math.round((d.degats / cible.perso.vie) * 100) };
    }

    function publier() {
      let indice = "";
      if (combat.phase === "acheve" && combat.acheve) {
        const cote = combat.acheve.vainqueur.cote;
        const touche = toucheGrace(cote);
        if (touche) indice = `Coup de grâce : ↓ → ↓ + ${touche}, près de ${combat.acheve.perdant.perso.pronom === "elle" ? "elle" : "lui"}`;
      }
      etatRef.current({
        vieA: Math.max(0, combat.a.vie),
        vieB: Math.max(0, combat.b.vie),
        energieA: combat.a.energie,
        energieB: combat.b.energie,
        roundsA: combat.roundsA,
        roundsB: combat.roundsB,
        round: combat.round,
        temps: Math.max(0, Math.ceil(combat.temps)),
        annonce: combat.annonce,
        vainqueur: combat.vainqueur,
        comboA: comboDe(combat.b),
        comboB: comboDe(combat.a),
        indice,
      });
    }

    /** Ce que les evenements du moteur donnent a voir et a entendre. */
    function traiter(e: Evenement) {
      switch (e.type) {
        case "coup": {
          const a = ATTAQUES[e.attaque];
          if (a.degats >= 9 || a.pouvoir) sonVent(audio);
          break;
        }
        case "pouvoir":
          if (e.attaque === "furie") {
            sonFurie(audio);
            eclairage = 0.12;
          } else if (!ATTAQUES[e.attaque].projectile) sonSpecial(audio);
          aura(e.qui, e.qui.perso.accent, 12);
          break;
        case "touche": {
          const r = renduDe(e.cible);
          if (e.bloque) {
            sonBloc(audio);
            eclats(e.x, e.y, 0x9fd8ff, 7);
            r.anime?.flash(0x2a4a7a);
          } else {
            const a = ATTAQUES[e.attaque];
            if (e.lourd || a.pouvoir) sonPied(audio);
            else if (e.attaque === "pied" || e.attaque === "coupBas" || e.attaque === "piedSaute" || e.attaque === "retourne") sonPied(audio);
            else sonPoing(audio);
            const couleur = a.pouvoir ? e.attaquant.perso.accent : e.contre ? 0xff6a3c : 0xffd98a;
            eclats(e.x, e.y, couleur, a.pouvoir ? 22 : e.lourd ? 14 : 10, e.lourd ? 1.3 : 1);
            r.anime?.flash(e.contre ? 0x7a2a10 : 0x5a4a2a);
            r.flash = 0.14;
            if (e.lourd || a.pouvoir) tremblement = Math.max(tremblement, 0.24);
          }
          break;
        }
        case "projectile":
          sonProjectile(audio, e.p.def.forme);
          eclats(e.p.x, e.p.y, e.p.auteur.perso.accent, 8, 0.6);
          break;
        case "projectileFin":
          if (!e.touche) eclats(e.p.x, e.p.y, e.p.auteur.perso.accent, 6, 0.5);
          else if (e.p.def.forme === "rocher") fumee(e.p.x, e.p.y, 8, 0x7a7066);
          else if (e.p.def.forme === "voile") fumee(e.p.x, e.p.y, 10, 0x8a6cc4);
          break;
        case "choc":
          eclats(e.x, e.y, 0xffffff, 20, 1.2);
          onde3d(sphereFilGeo, e.x, e.y, 0xffffff, 0.2, 1.2, 0.25, false, true);
          sonBloc(audio);
          break;
        case "saut":
          sonSaut(audio);
          break;
        case "sol":
          sonSol(audio);
          break;
        case "chute":
          sonSol(audio);
          fumee(e.qui.x, 0.15, 6, 0x6b6570, 1.2);
          tremblement = Math.max(tremblement, 0.12);
          break;
        case "seisme": {
          sonSeisme(audio);
          tremblement = Math.max(tremblement, 0.4);
          onde3d(anneauGeo, e.qui.x, 0.03, e.qui.perso.accent, 0.3, 3.2, 0.5, true);
          const sens = e.qui.sens;
          for (let i = 0; i < 14; i++) {
            const x = e.qui.x + sens * (0.3 + (i / 14) * 2.6);
            fumee(x, 0.2, 1, 0x7a6d5e, 0.3);
            particule(x, 0.1, hasard(0.5), 0x7a7066, { vx: hasard(1), vy: 3 + Math.random() * 3, vie: 0.6, taille: 1.5 });
          }
          break;
        }
        case "decharge": {
          const c = e.qui;
          sonFoudre(audio);
          eclairage = 0.1;
          onde3d(sphereFilGeo, c.x, c.y + 1.1, c.perso.accent, 0.4, 1.7, 0.3, false, true);
          for (let i = 0; i < 4; i++) foudre(c.x + hasard(2.2), c.y + 0.2, c.perso.accent, 2.4, 0.05, 0.18);
          break;
        }
        case "teleport": {
          sonTeleport(audio);
          for (const x of [e.de, e.vers]) {
            fumee(x, 1, 10, e.qui.perso.accent, 0.6);
            fumee(x, 0.6, 6, 0x3b2a5e, 0.6);
          }
          break;
        }
        case "saisie":
          sonBloc(audio);
          break;
        case "message":
          messageRef.current?.(e.cote, e.texte);
          break;
        case "furie":
          tremblement = Math.max(tremblement, 0.3);
          eclairage = 0.15;
          break;
        case "furieCoup": {
          const accent = e.qui.perso.accent;
          if (e.final) {
            sonPied(audio);
            sonSpecial(audio);
            eclats(e.x, e.y, accent, 30, 1.5);
            onde3d(sphereFilGeo, e.x, e.y, accent, 0.3, 1.8, 0.35, false, true);
            tremblement = 0.5;
            eclairage = 0.12;
          } else {
            sonPoing(audio);
            eclats(e.x, e.y, accent, 14, 1.1);
            tremblement = Math.max(tremblement, 0.18);
          }
          if (e.qui.perso.id === "eclair") foudre(e.x, e.y - 1, accent, 3, 0.06, 0.15);
          renduDe(e.cible).anime?.flash(0x5a4a2a);
          break;
        }
        case "acheve":
          sonAcheve(audio);
          ralenti = 0.5;
          break;
        case "grace":
          graceFaite.clear();
          break;
        case "ko":
          sonKo(audio);
          if (e.parKo && !combat.parGrace) {
            tremblement = 0.45;
            // Le K.O. se regarde au ralenti, camera au plus pres : c'est le
            // moment que le joueur racontera.
            ralenti = 1.6;
          }
          break;
        case "gong":
          sonGong(audio);
          break;
        case "fin":
          if (!finAnnoncee) {
            finAnnoncee = true;
            publier();
            finRef.current(e.vainqueur);
          }
          break;
      }
    }

    /** Les quatre coups de grace : une mise en scene, sans une goutte de sang. */
    function majGrace() {
      const g = combat.grace;
      if (!g || combat.phase !== "grace") return;
      const victime = renduDe(g.victime);
      const t = g.t;
      const une = (cle: string, quand: number) => {
        if (t < quand || graceFaite.has(cle)) return false;
        graceFaite.add(cle);
        return true;
      };
      const v = g.victime;
      switch (g.id) {
        case "roc":
          if (une("pierre", 0.6)) {
            petrifier(victime);
            sonBloc(audio);
            fumee(v.x, 1, 10, 0x8a8478, 0.8);
          }
          if (une("eclats", 1.7)) {
            briser(victime);
            sonEclats(audio);
            tremblement = 0.55;
          }
          break;
        case "lame": {
          if (une("rayon", 0.6)) {
            const mat = new THREE.MeshBasicMaterial({ color: g.auteur.perso.accent, transparent: true, opacity: 0, depthWrite: false, fog: false });
            const mesh = new THREE.Mesh(garder(new THREE.CylinderGeometry(0.8, 0.8, 34, 24, 1, true)), mat);
            mesh.position.set(v.x, 17, 0);
            scene.add(mesh);
            rayon = { mesh, mat };
            sonRayon(audio);
          }
          if (rayon) {
            const montee = Math.min(1, (t - 0.6) / 0.35);
            const fin = t > 2.9 ? Math.max(0, 1 - (t - 2.9) / 0.5) : 1;
            rayon.mat.opacity = 0.55 * montee * fin * (0.85 + Math.random() * 0.15);
            rayon.mesh.scale.set(0.3 + montee * 0.9, 1, 0.3 + montee * 0.9);
            rayon.mesh.position.x = v.x;
            if (Math.random() < 0.6) particule(v.x + hasard(1.2), 0.2, hasard(0.8), 0xffffff, { vy: 4 + Math.random() * 3, vie: 0.8, gravite: -2, taille: 0.7 });
          }
          if (t > 1.8) opacite(victime, Math.max(0, 1 - (t - 1.8) / 0.9));
          if (une("etoile", 3.0)) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false });
            const mesh = new THREE.Mesh(garder(new THREE.OctahedronGeometry(0.25, 0)), mat);
            mesh.position.set(v.x, 8.6, -3);
            scene.add(mesh);
            etoile = { mesh, mat, t: 0 };
          }
          break;
        }
        case "eclair":
          for (const [cle, quand] of [
            ["f1", 0.75],
            ["f2", 1.1],
            ["f3", 1.45],
          ] as const) {
            if (une(cle, quand)) {
              foudre(v.x, v.y + 1.1 * v.taille, 0xfff6a0, 12, 0.13, 0.45);
              foudre(v.x + hasard(0.6), v.y + 0.8, 0xffffff, 12, 0.06, 0.3);
              sonFoudre(audio);
              eclairage = 0.16;
              tremblement = Math.max(tremblement, 0.3);
              eclats(v.x, v.y + 1.2, 0xfff6a0, 18, 1.3);
            }
          }
          if (t > 0.75) {
            teinter(victime, 0x141210, Math.min(0.9, (t - 0.75) * 0.9));
            if (Math.random() < 0.35) fumee(v.x, v.y + 1.4, 1, 0x3a3838, 0.4);
          }
          if (une("tombe", 1.9) && victime.anime) {
            victime.tombe = true;
            victime.anime.play("KO_B", { loop: false, fade: 0.15 });
          }
          break;
        case "brume":
        default:
          if (t > 0.5) {
            // La brume tourne autour de la victime, puis l'efface.
            const a = horloge * 5;
            for (let i = 0; i < 2; i++) {
              const ang = a + i * Math.PI;
              particule(v.x + Math.cos(ang) * 0.9, v.y + 0.3 + Math.random() * 1.8, Math.sin(ang) * 0.9, i ? g.auteur.perso.accent : 0x6c5a8e, {
                vx: -Math.sin(ang) * 2,
                vz: Math.cos(ang) * 2,
                vy: 0.3,
                vie: 0.8,
                gravite: 0,
                taille: 1.6,
                croissance: 1.5,
                opacite: 0.5,
              });
            }
          }
          if (t > 1.2) opacite(victime, Math.max(0, 1 - (t - 1.2) / 1.3));
          break;
      }
    }

    // ================================================== les combattants
    function etatSecours(c: Combattant): ContexteAnim["etat"] {
      switch (c.etat) {
        case "attaque":
        case "furie":
          return c.action ? "coup" : "garde";
        case "touche":
        case "saisi":
        case "subit":
          return "touche";
        case "garde":
          return "bloc";
        case "jongle":
        case "chute":
        case "sol":
        case "ko":
          return "ko";
        case "releve":
          return "accroupi";
        case "victoire":
          return "victoire";
        case "sonne":
          return "garde";
        default:
          if (c.y > 0.05) return "saut";
          if (c.accroupi) return "accroupi";
          if (c.enGarde) return "bloc";
          if (c.marche !== 0) return Math.sign(c.marche) === c.sens ? "marche" : "recul";
          return "garde";
      }
    }

    function animer(r: Rendu, dt: number, fige: boolean) {
      const c = r.c;
      const { racine, ombre, os } = r.modele;
      if (!fige) {
        if (r.anime) {
          if (r.petrifie) {
            // Statue : plus rien ne bouge.
          } else if (r.tombe) r.anime.update(dt);
          else {
            const res = animerCombattant(
              c,
              r.anime,
              r.visuel,
              { phase: combat.phase, chrono: combat.chrono, horloge: combat.horloge, furie: combat.furie, grace: combat.grace },
              dt,
            );
            r.vrille = res.vrille;
            r.hauteur = res.hauteur;
            // Debout, accroupi ou en train de frapper, la cape pend ; a terre,
            // elle suit le corps.
            const couche = c.etat === "jongle" || c.etat === "chute" || c.etat === "sol" || c.etat === "releve" || c.etat === "ko";
            if (!couche) for (const cp of r.capes) redresserCape(cp.obj, cp.attache, r.anime.root);
          }
        } else {
          const etat: EtatAnim = etatSecours(c);
          let progression = 0;
          let finPreparation = 0.3;
          let finActif = 0.55;
          if (c.action) {
            const a = ATTAQUES[c.action.id];
            const total = a.demarrage + a.actif + a.recuperation;
            progression = Math.min(1, c.action.t / total);
            finPreparation = a.demarrage / total;
            finActif = (a.demarrage + a.actif) / total;
          }
          const cible = poseCible({
            etat,
            temps: horloge + (c.cote === "B" ? 1.3 : 0), // les deux ne respirent pas en meme temps
            coup: c.action ? familleDuCoup(c.action.id) : undefined,
            progression,
            finPreparation,
            finActif,
            perso: c.perso,
          });
          if (!r.petrifie) appliquerPose(os, cible, dt, vitessePose(etat), r.modele.hauteurBassin);
          r.vrille = 0;
          r.hauteur = 0;
          if (c.action) {
            const a = ATTAQUES[c.action.id];
            if (c.action.id === "tourbillon") r.vrille = Math.min(1, Math.max(0, (c.action.t - a.demarrage) / a.actif)) * Math.PI * 4;
            if (c.action.id === "balayette" || c.action.id === "retourne")
              r.vrille = Math.min(1, c.action.t / (a.demarrage + (c.action.id === "balayette" ? a.actif : 0))) * Math.PI * 2;
          }
        }
      }

      // Orientation : de profil face a l'adversaire ; de face pour saluer la victoire.
      const orientation = c.etat === "victoire" ? 0 : (c.sens * Math.PI) / 2;
      r.tourne += (orientation - r.tourne) * (1 - Math.exp(-14 * dt));
      racine.rotation.y = r.tourne + r.vrille * c.sens;

      // Au sol, le corps couche deborde sous les dalles : on le remonte
      // d'autant qu'il a bascule (modele de secours).
      const bascule = !r.anime && os.corps ? Math.max(0, -Math.sin(os.corps.rotation.x)) : 0;
      let y = c.y + r.hauteur + bascule * 0.24;
      // La brume souleve doucement sa victime avant de l'effacer.
      if (combat.phase === "grace" && combat.grace?.id === "brume" && combat.grace.victime === c) {
        y += Math.min(0.4, Math.max(0, combat.grace.t - 0.8) * 0.3);
      }
      racine.position.set(c.x, y, 0);

      // Visible ? Pas pendant le pas de brume, ni une fois parti en gravats ou en fumee.
      let visible = !c.cache;
      if (c.etat === "attaque" && c.action?.id === "pasDeBrume") {
        const t = c.action.t;
        visible = t < 0.1 || t > 0.3;
      }
      if (c.etat === "furie" && combat.furie?.auteur === c && c.perso.id === "brume") {
        // Cauchemar : elle n'apparait qu'au moment de frapper.
        const f = combat.furie;
        visible = f.coups >= TEMPS_FURIE.length || Math.abs(f.t - TEMPS_FURIE[f.coups]) < 0.12;
      }
      if (r.flash > 0) {
        r.flash -= dt;
        if (!r.anime) visible = visible && (Math.floor(r.flash * 45) % 2 === 0 || r.flash <= 0);
      }
      racine.visible = visible && !r.disparu;

      // L'ombre reste au sol et retrecit quand on saute.
      ombre.visible = racine.visible;
      ombre.position.set(c.x, 0.01, 0);
      ombre.scale.setScalar(Math.max(0.45, 1 - c.y * 0.18));
    }

    // ============================================================ la boucle
    function tick() {
      const maintenant = performance.now();
      // Plafonne : apres un changement d'onglet, un delta enorme ferait
      // traverser l'arene d'un coup.
      const dtReel = Math.min((maintenant - derniere) / 1000, 0.1);
      derniere = maintenant;

      if (optionsRef.current.pause) {
        fraiches.clear();
        renderer.render(scene, camera);
        return;
      }

      // Ralenti du K.O. : tout le monde (regles, animations, particules)
      // vit au tiers de sa vitesse pendant un instant.
      let dt = dtReel;
      if (ralenti > 0) {
        ralenti -= dtReel;
        dt = dtReel * 0.35;
      }
      horloge += dt;

      const solo = optionsRef.current.contreOrdinateur;
      const cmdA = lire(solo ? TOUCHES_A_SOLO : TOUCHES_A_DUO);
      let cmdB: Commande;
      if (ordi) {
        cmdB = ordi.commande(combat);
        for (const k of FRAICHES) if (attenteOrdi[k]) cmdB[k] = true;
        if (attenteOrdi.ordre && !cmdB.ordre) cmdB.ordre = attenteOrdi.ordre;
      } else cmdB = lire(TOUCHES_B);

      // Arret sur image : le moteur ne compte pas cette image. Les touches
      // pressees restent alors en attente pour la suivante.
      const compte = combat.etape(dt, cmdA, cmdB);
      if (compte) {
        fraiches.clear();
        attenteOrdi = {};
      } else if (ordi) {
        for (const k of FRAICHES) if (cmdB[k]) attenteOrdi[k] = true;
        if (cmdB.ordre) attenteOrdi.ordre = cmdB.ordre;
      }
      for (const e of combat.vider()) traiter(e);

      majGrace();
      for (const r of rendus) animer(r, dt, !compte);
      majProjectiles(dt);

      // La barre pleine se voit : quelques etincelles montent du combattant.
      auraT -= dt;
      if (auraT <= 0) {
        auraT = 0.14;
        for (const c of combat.combattants) {
          if (c.energie >= ENERGIE_MAX && combat.phase === "combat" && !c.cache) aura(c, c.perso.accent, 1);
        }
      }

      // Particules, eclairs, ondes, gravats.
      for (let i = particules.length - 1; i >= 0; i--) {
        const p = particules[i];
        p.vie -= dtReel;
        p.mesh.position.x += p.vx * dtReel;
        p.mesh.position.y += p.vy * dtReel;
        p.mesh.position.z += p.vz * dtReel;
        p.vy -= p.gravite * dtReel;
        if (p.croissance) p.mesh.scale.multiplyScalar(1 + p.croissance * dtReel);
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (p.vie / p.vieMax) * p.opacite);
        if (p.vie <= 0) {
          scene.remove(p.mesh);
          (p.mesh.material as THREE.Material).dispose();
          particules.splice(i, 1);
        }
      }
      for (let i = traits.length - 1; i >= 0; i--) {
        const t = traits[i];
        t.vie -= dtReel;
        t.mat.opacity = Math.max(0, t.vie / t.vieMax) * (0.7 + Math.random() * 0.3);
        if (t.vie <= 0) {
          scene.remove(t.groupe);
          t.mat.dispose();
          traits.splice(i, 1);
        }
      }
      for (let i = ondes3d.length - 1; i >= 0; i--) {
        const o = ondes3d[i];
        o.vie -= dtReel;
        const u = 1 - o.vie / o.vieMax;
        o.mesh.scale.setScalar(o.de + (o.vers - o.de) * u);
        o.mat.opacity = Math.max(0, 1 - u) * 0.8;
        if (o.vie <= 0) {
          scene.remove(o.mesh);
          o.mat.dispose();
          ondes3d.splice(i, 1);
        }
      }
      for (const g of gravats) {
        if (g.pose) continue;
        g.vy -= 18 * dtReel;
        g.mesh.position.x += g.vx * dtReel;
        g.mesh.position.y += g.vy * dtReel;
        g.mesh.rotation.x += g.vr * dtReel;
        const demi = g.mesh.scale.y / 2;
        if (g.mesh.position.y <= demi) {
          g.mesh.position.y = demi;
          if (Math.abs(g.vy) < 2) g.pose = true;
          g.vy = -g.vy * 0.3;
          g.vx *= 0.5;
          g.vr *= 0.5;
        }
      }
      if (etoile) {
        etoile.t += dtReel;
        const s = Math.max(0, Math.sin(Math.min(1, etoile.t / 0.8) * Math.PI)) * 1.6;
        etoile.mesh.scale.setScalar(s);
        etoile.mesh.rotation.z += dtReel * 4;
      }

      // Les braseros respirent, l'embleme aussi ; la foudre eclaire le ciel.
      const pulse = 1 + Math.sin(horloge * 7) * 0.12;
      for (const f of feux) f.scale.setScalar(pulse);
      flamme.scale.y = 1.35 + Math.sin(horloge * 5) * 0.1;
      if (eclairage > 0) eclairage -= dtReel;
      ciel.intensity = 2.0 + Math.max(0, eclairage) * 14;

      // La camera suit le milieu des deux, basse et de cote, et recule quand
      // ils s'eloignent : on doit toujours voir les deux combattants.
      const { a, b } = combat;
      const milieu = (a.x + b.x) / 2;
      const distance = Math.abs(a.x - b.x);
      const tombe = ralenti > 0 ? combat.combattants.find((c) => c.etat === "ko") : undefined;
      let visee = milieu * 0.85;
      // Sur un ecran etroit (fenetre reduite, tablette), on recule assez pour
      // garder les deux combattants dans l'image.
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const pourVoir = (distance / 2 + 1.6) / Math.max(0.2, tanH);
      let recul = THREE.MathUtils.clamp(Math.max(8 + distance * 0.55, pourVoir), 9, 26);
      let hauteurCam = 2.4;
      let regardY = 1.3;
      let vitesseCam = 4;
      if (combat.phase === "grace" && combat.grace) {
        // Le coup de grace : plus pres, et la camera tourne doucement.
        const g = combat.grace;
        visee = (g.auteur.x + g.victime.x) / 2 + Math.sin(g.t * 0.7) * 0.8;
        recul = g.id === "lame" && g.t > 1.6 ? 11 : 7.2;
        hauteurCam = g.id === "lame" && g.t > 1.6 ? 3.2 : 2;
        regardY = g.id === "lame" && g.t > 1.6 ? Math.min(6, g.victime.y + 1) : 1.2;
        vitesseCam = 3;
      } else if (combat.furie) {
        // La furie : au plus pres de la victime.
        visee = combat.furie.victime.x * 0.7 + combat.furie.auteur.x * 0.3;
        recul = 6.2;
        hauteurCam = 1.9;
        regardY = 1.2;
        vitesseCam = 6;
      } else if (tombe) {
        // Au ralenti du K.O., la camera plonge vers celui qui tombe.
        visee = tombe.x;
        recul = 5.2;
        hauteurCam = 1.6;
        regardY = 0.9;
        vitesseCam = 6;
      } else if (combat.phase === "acheve") {
        recul = Math.max(8, recul - 1.5);
      }
      const suivi = 1 - Math.exp(-vitesseCam * dtReel);
      camera.position.x += (visee - camera.position.x) * suivi;
      camera.position.y += (hauteurCam - camera.position.y) * suivi;
      camera.position.z += (recul - camera.position.z) * (1 - Math.exp(-(vitesseCam - 1) * dtReel));
      // Petit tremblement sur les gros impacts : on SENT le coup.
      if (tremblement > 0) {
        tremblement -= dtReel;
        camera.position.x += (Math.random() - 0.5) * tremblement * 0.5;
        camera.position.y += (Math.random() - 0.5) * tremblement * 0.5;
      }
      camera.lookAt(visee, regardY, 0);
      // Le brouillard suit la camera : de loin, les combattants ne s'y noient pas.
      const brume = scene.fog as THREE.Fog;
      brume.near = camera.position.z + 7;
      brume.far = camera.position.z + 33;

      publier();
      renderer.render(scene, camera);
    }

    // Cadence fixe (regle de la maison) : 16 ms, delta calcule a la main.
    const minuteur = window.setInterval(tick, 16);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      detruit = true;
      window.clearInterval(minuteur);
      for (const r of rendus) r.anime?.dispose();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      for (const p of particules) (p.mesh.material as THREE.Material).dispose();
      for (const t of traits) t.mat.dispose();
      for (const o of ondes3d) o.mat.dispose();
      for (const id of [...projVisuels.keys()]) retirerProjectile(id);
      rayon?.mat.dispose();
      etoile?.mat.dispose();
      for (const x of aJeter) x.dispose();
      audio.ctx?.close().catch(() => {});
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [persoA, persoB]);

  return <div ref={hote} className="absolute inset-0" />;
}
