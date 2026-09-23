"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  ARENE,
  COLOSSES,
  COUPS,
  DIFFICULTES,
  DUREE_ROUND,
  ECART_MIN,
  ENERGIE_MAX,
  ETOURDISSEMENT,
  GRAVITE,
  REPIT,
  SAUT,
  VITESSE,
  VITESSE_ONDE,
  colosseOmbre,
  degatsDe,
  type Colosse,
  type ColosseId,
  type CoupId,
  type Difficulte,
} from "@/lib/colosses";
import { construireColosse, type ModeleColosse } from "@/lib/colossesModeles";
import { appliquerPose, poseCible, vitessePose, type EtatAnim } from "@/lib/colossesPoses";
import {
  creerAudio,
  sonBloc,
  sonGong,
  sonKo,
  sonPied,
  sonPoing,
  sonSaut,
  sonSol,
  sonSpecial,
  type ColossesAudio,
} from "@/lib/colossesAudio";

/**
 * Colosses : la scene et le moteur de combat.
 *
 * Vue de cote, deux combattants sur une ligne, comme tous les jeux de combat
 * depuis quarante ans : la profondeur ne sert qu'au decor. Toute la difficulte
 * est ailleurs — dans les FENETRES DE TEMPS. Un coup se voit partir
 * (preparation), touche (actif), puis laisse sans defense (recuperation).
 * C'est ce qui permet de bloquer, d'esquiver et de punir ; sans ca, le jeu se
 * resume a marteler un bouton.
 *
 * Les corps sont construits dans colossesModeles.ts et les gestes decrits dans
 * colossesPoses.ts. Ce fichier s'occupe des regles, du decor et du deroulement
 * d'un round : annonce, combat, K.O., pose de victoire.
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
  /** Message affiche en grand au centre ("Round 1", "K.O. !", "Égalité"...). */
  annonce: string;
  /** Rempli quand le match est fini : "A" ou "B". */
  vainqueur: "A" | "B" | null;
}

export interface ColossesOptions {
  /** Faux = deux joueurs sur le meme clavier. */
  contreOrdinateur: boolean;
  difficulte: Difficulte;
  volume: number;
  /** Le joueur B est le reflet sombre de son personnage (fin du tournoi). */
  boss?: boolean;
}

/**
 * Le deroulement d'un round. « finRound » dure trois secondes : le perdant
 * tombe, le gagnant leve le poing, puis on enchaine. Couper directement au
 * round suivant privait le joueur du seul moment ou il savoure.
 */
type Phase = "annonce" | "combat" | "finRound" | "fini";

/** Un combattant, cote moteur. */
interface Lutteur {
  cote: "A" | "B";
  perso: Colosse;
  modele: ModeleColosse;
  x: number;
  y: number;
  vy: number;
  /** +1 regarde a droite, -1 a gauche. */
  sens: 1 | -1;
  vie: number;
  energie: number;
  accroupi: boolean;
  bloque: boolean;
  /** Direction de marche de l'image en cours : choisit marche ou recul. */
  marche: number;
  /** Coup en cours, avec le temps ecoule depuis son debut. */
  coup: { id: CoupId; t: number; touche: boolean } | null;
  /** Temps restant sonne : on ne peut rien faire. */
  sonne: number;
  /** Temps pendant lequel on ne peut plus etre touche (voir REPIT). */
  repit: number;
  /** Temps restant dans la pose « touche » (la tete part en arriere). */
  encaisse: number;
  ko: boolean;
  victoire: boolean;
  /** Clignotement quand on est touche. */
  flash: number;
  /** Orientation lissee du corps (le tourbillon s'y ajoute). */
  tourne: number;
}

/** L'onde de choc d'Eclair : un projectile qui traverse l'arene. */
interface Onde {
  x: number;
  y: number;
  sens: 1 | -1;
  auteur: Lutteur;
  groupe: THREE.Group;
  materiaux: THREE.Material[];
  vie: number;
  /** L'ordinateur a deja decide quoi faire face a cette onde. */
  jugee: boolean;
}

interface Touches {
  gauche: string[];
  droite: string[];
  saut: string[];
  bas: string[];
  poing: string[];
  pied: string[];
  special: string[];
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
  special: ["h"],
};

/** Joueur 1, a deux sur le clavier : la main gauche seulement. */
const TOUCHES_A_DUO: Touches = {
  gauche: ["q", "a"],
  droite: ["d"],
  saut: ["z", "w"],
  bas: ["s"],
  poing: ["f"],
  pied: ["g"],
  special: ["h"],
};

/** Joueur 2 (ou l'ordinateur) : les fleches et la main droite. */
const TOUCHES_B: Touches = {
  gauche: ["arrowleft"],
  droite: ["arrowright"],
  saut: ["arrowup"],
  bas: ["arrowdown"],
  poing: ["o"],
  pied: ["p"],
  special: ["m"],
};

export default function ColossesScene({
  persoA,
  persoB,
  options,
  onEtat,
  onFin,
}: {
  persoA: ColosseId;
  persoB: ColosseId;
  options: ColossesOptions;
  onEtat: (e: ColossesEtat) => void;
  onFin: (vainqueur: "A" | "B") => void;
}) {
  const hote = useRef<HTMLDivElement>(null);
  // Les callbacks changent a chaque rendu React : on les garde dans des refs
  // pour que la boucle de jeu n'ait pas besoin d'etre recreee.
  const etatRef = useRef(onEtat);
  const finRef = useRef(onFin);
  const optionsRef = useRef(options);
  useEffect(() => {
    etatRef.current = onEtat;
    finRef.current = onFin;
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
    scene.add(new THREE.HemisphereLight(0xb4c4ff, 0x1c1226, 2.0));
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

    // ========================================================= combattants
    function nouveauLutteur(cote: "A" | "B", id: ColosseId): Lutteur {
      const perso = cote === "B" && optionsRef.current.boss ? colosseOmbre(id) : COLOSSES[id];
      const modele = construireColosse(perso, garder);
      scene.add(modele.racine);
      scene.add(modele.ombre);
      const sens = cote === "A" ? 1 : -1;
      return {
        cote,
        perso,
        modele,
        x: cote === "A" ? -2.6 : 2.6,
        y: 0,
        vy: 0,
        sens,
        vie: perso.vie,
        energie: 0,
        accroupi: false,
        bloque: false,
        marche: 0,
        coup: null,
        sonne: 0,
        repit: 0,
        encaisse: 0,
        ko: false,
        victoire: false,
        flash: 0,
        tourne: (sens * Math.PI) / 2,
      };
    }

    const a = nouveauLutteur("A", persoA);
    const b = nouveauLutteur("B", persoB);
    const lutteurs = [a, b];

    // ============================================================= effets
    const etincelleGeo = garder(new THREE.SphereGeometry(0.08, 5, 4));
    const etincelles: { mesh: THREE.Mesh; vie: number; vx: number; vy: number }[] = [];
    function eclats(x: number, y: number, couleur: number, combien: number) {
      for (let i = 0; i < combien; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true });
        const m = new THREE.Mesh(etincelleGeo, mat);
        m.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, 0.4);
        scene.add(m);
        etincelles.push({ mesh: m, vie: 0.38, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 5 + 1 });
      }
    }

    const ondeGeo = garder(new THREE.SphereGeometry(0.3, 14, 10));
    const ondeHaloGeo = garder(new THREE.SphereGeometry(0.52, 14, 10));
    const ondes: Onde[] = [];
    function lancerOnde(l: Lutteur) {
      const coeur = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const aura = new THREE.MeshBasicMaterial({ color: l.perso.accent, transparent: true, opacity: 0.5 });
      const groupe = new THREE.Group();
      groupe.add(new THREE.Mesh(ondeGeo, coeur));
      groupe.add(new THREE.Mesh(ondeHaloGeo, aura));
      const onde: Onde = {
        x: l.x + l.sens * 0.9,
        y: l.y + 1.4,
        sens: l.sens,
        auteur: l,
        groupe,
        materiaux: [coeur, aura],
        vie: 2.2,
        jugee: false,
      };
      groupe.position.set(onde.x, onde.y, 0.2);
      scene.add(groupe);
      ondes.push(onde);
    }
    function retirerOnde(i: number) {
      const o = ondes[i];
      scene.remove(o.groupe);
      for (const m of o.materiaux) m.dispose();
      ondes.splice(i, 1);
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

    // =========================================================== la partie
    const audio: ColossesAudio = creerAudio(optionsRef.current.volume);
    let phase: Phase = "annonce";
    let annonce = "";
    let temps = DUREE_ROUND;
    let roundsA = 0;
    let roundsB = 0;
    let round = 1;
    let horloge = 0;
    /** Temps passe dans la phase courante. */
    let chrono = 0;
    let derniere = performance.now();
    let cerveau = 0; // minuteur de reflexion de l'ordinateur
    let intentionOrdi = 0;
    /** Temps avant que l'ordinateur ne se permette une nouvelle attaque. */
    let attenteCoup = 0;
    let gagnantRound: "A" | "B" | null = null;
    let vainqueurMatch: "A" | "B" | null = null;
    let tremblement = 0;
    /**
     * Arret sur image a l'impact : quelques centiemes de seconde ou tout se
     * fige. Invisible a l'oeil, mais c'est ce qui donne du POIDS a un coup —
     * sans lui, les poings traversent les corps comme du vent.
     */
    let gel = 0;

    function publier() {
      etatRef.current({
        vieA: Math.max(0, a.vie),
        vieB: Math.max(0, b.vie),
        energieA: a.energie,
        energieB: b.energie,
        roundsA,
        roundsB,
        round,
        temps: Math.max(0, Math.ceil(temps)),
        annonce,
        vainqueur: vainqueurMatch,
      });
    }

    function nouveauRound() {
      for (const l of lutteurs) {
        l.vie = l.perso.vie;
        l.energie = 0;
        l.x = l.cote === "A" ? -2.6 : 2.6;
        l.y = 0;
        l.vy = 0;
        l.coup = null;
        l.sonne = 0;
        l.repit = 0;
        l.encaisse = 0;
        l.ko = false;
        l.victoire = false;
        l.flash = 0;
        l.accroupi = false;
        l.bloque = false;
      }
      for (let i = ondes.length - 1; i >= 0; i--) retirerOnde(i);
      temps = DUREE_ROUND;
      phase = "annonce";
      chrono = 0;
      annonce = `Round ${round}`;
      sonGong(audio);
    }

    /** Un round se termine : le perdant tombe, puis le gagnant savoure. */
    function finDeRound(gagnant: "A" | "B" | null, parKo: boolean) {
      gagnantRound = gagnant;
      if (gagnant === "A") roundsA++;
      if (gagnant === "B") roundsB++;
      phase = "finRound";
      chrono = 0;
      annonce = parKo ? "K.O. !" : gagnant === null ? "Égalité" : "Temps écoulé";
      for (const l of lutteurs) {
        l.coup = null;
        l.bloque = false;
        l.accroupi = false;
        l.sonne = 0;
        if (parKo && l.vie <= 0) l.ko = true;
        else l.encaisse = 0;
      }
      tremblement = parKo ? 0.45 : 0;
      gel = parKo ? 0.35 : 0;
      sonKo(audio);
    }

    /** Lance un coup si le combattant est libre de le faire. */
    function frapper(l: Lutteur, id: CoupId) {
      if (l.coup || l.sonne > 0 || phase !== "combat") return;
      if (id === "special" && l.energie < ENERGIE_MAX) return;
      if (id === "special") {
        l.energie = 0;
        sonSpecial(audio);
        // Le corps s'illumine au depart : l'adversaire doit le voir venir.
        eclats(l.x, l.y + 1.3, l.perso.accent, 12);
      }
      l.coup = { id, t: 0, touche: false };
    }

    /**
     * Un coup arrive sur la cible : degats, recul, effets.
     * `sens` est la direction de la poussee (celle de l'onde, pour un projectile).
     */
    function encaisser(attaquant: Lutteur, cible: Lutteur, id: CoupId, sens: 1 | -1, projectile = false) {
      // Respiration : on ne remet pas un coup a quelqu'un qui vient d'en
      // prendre un. Le coup part quand meme (on le voit), il ne compte pas.
      if (cible.repit > 0 || cible.ko) return;
      const coup = COUPS[id];
      // On bloque en tenant la direction OPPOSEE a l'adversaire, sans attaquer.
      const bloque = cible.bloque && !cible.coup && cible.y <= 0.05;
      const degats = degatsDe(coup, attaquant.perso, bloque);
      cible.vie -= degats;
      cible.sonne = bloque ? 0.12 : degats * ETOURDISSEMENT;
      cible.repit = bloque ? 0.12 : REPIT;
      cible.encaisse = bloque ? 0 : 0.3;
      cible.flash = bloque ? 0.05 : 0.14;
      // Les deux reculent : l'attaquant doit revenir, donc il ne peut pas
      // rester colle a marteler le meme bouton.
      cible.x = THREE.MathUtils.clamp(cible.x + coup.poussee * (bloque ? 0.4 : 1) * sens * 0.55, -ARENE, ARENE);
      if (!projectile) attaquant.x -= coup.poussee * 0.12 * sens;
      attaquant.energie = Math.min(ENERGIE_MAX, attaquant.energie + Math.max(0, coup.energie));
      if (!bloque) cible.energie = Math.min(ENERGIE_MAX, cible.energie + Math.max(0, coup.energie) * 0.5);
      gel = bloque ? 0.03 : id === "special" ? 0.12 : 0.06;

      const hauteurImpact = cible.y + (cible.accroupi ? 0.9 : 1.5);
      const xImpact = cible.x - sens * 0.3;
      if (bloque) {
        sonBloc(audio);
        eclats(xImpact, hauteurImpact, 0x9fd8ff, 6);
      } else {
        if (id === "poing") sonPoing(audio);
        else if (id === "pied") sonPied(audio);
        const special = id === "special";
        eclats(xImpact, hauteurImpact, special ? attaquant.perso.accent : 0xffd98a, special ? 26 : 10);
        if (special) tremblement = 0.28;
      }

      // L'uppercut envoie en l'air : c'est ce qui le rend spectaculaire.
      if (id === "special" && attaquant.perso.special === "uppercut" && !bloque) {
        cible.vy = 8.5;
      }
    }

    /** Le coup touche-t-il ? Distance, hauteur, et garde de l'adversaire. */
    function resoudre(attaquant: Lutteur, cible: Lutteur) {
      const c = attaquant.coup;
      if (!c || c.touche) return;

      // L'onde part au lieu de frapper au corps a corps.
      if (c.id === "special" && attaquant.perso.special === "onde") {
        c.touche = true;
        lancerOnde(attaquant);
        return;
      }

      const coup = COUPS[c.id];
      const special = c.id === "special";
      const portee = coup.portee * (special && attaquant.perso.special === "charge" ? 1.6 : 1);
      const distance = Math.abs(cible.x - attaquant.x);
      // Le tourbillon frappe des deux cotes : il n'a pas besoin d'etre face.
      const devant =
        (special && attaquant.perso.special === "tourbillon") ||
        Math.sign(cible.x - attaquant.x) === attaquant.sens;
      if (!devant || distance > portee + 0.35) return;

      // Un coup haut passe au-dessus d'un adversaire accroupi ; un coup bas
      // ne touche pas quelqu'un en l'air. C'est ce qui rend l'esquive utile.
      if (coup.hauteur === "haut" && cible.accroupi) return;
      if (coup.hauteur === "bas" && cible.y > 0.6) return;
      if (cible.y > 1.6 && !special) return;

      c.touche = true;
      encaisser(attaquant, cible, c.id, cible.x >= attaquant.x ? 1 : -1);
    }

    /**
     * L'ordinateur.
     *
     * Il ne lit pas l'avenir : il regarde la distance et decide, avec un
     * temps de reaction et une cadence minimale entre deux attaques. Un
     * adversaire qui reagit instantanement n'est pas difficile, il est injuste.
     */
    function jouerOrdinateur(moi: Lutteur, autre: Lutteur, dt: number) {
      const reglage = DIFFICULTES[optionsRef.current.difficulte];
      cerveau -= dt;
      attenteCoup -= dt;
      const distance = Math.abs(autre.x - moi.x);
      const versLui = Math.sign(autre.x - moi.x);

      // Une onde arrive : il decide UNE fois s'il saute, sinon il tente la
      // garde. Redecider a chaque image lui donnerait des reflexes surhumains.
      for (const o of ondes) {
        if (o.auteur !== autre || o.jugee) continue;
        const approche = Math.sign(moi.x - o.x) === o.sens;
        if (!approche || Math.abs(o.x - moi.x) > 3.4) continue;
        o.jugee = true;
        if (moi.y <= 0.02 && moi.sonne <= 0 && Math.random() < reglage.garde) {
          moi.vy = SAUT;
          sonSaut(audio);
        }
      }

      // Garde : quand l'autre prepare un coup et qu'on est a portee.
      const menace =
        (autre.coup && !autre.coup.touche && distance < 2.4) ||
        ondes.some((o) => o.auteur === autre && Math.abs(o.x - moi.x) < 2.5);
      moi.bloque = Boolean(menace) && Math.random() < reglage.garde;
      if (moi.bloque) return;

      if (cerveau > 0) return;
      cerveau = reglage.reaction + Math.random() * 0.18;

      if (moi.sonne > 0 || moi.coup) return;

      // Il ne frappe pas quelqu'un qui est encore sonne : sans cette regle,
      // il enchaine et on regarde son personnage tomber sans rien pouvoir
      // faire. Un adversaire dur doit etre dur, pas injouable.
      const libre = autre.sonne <= 0 && autre.repit <= 0;
      const peutFrapper = libre && attenteCoup <= 0;
      // L'onde d'Eclair se lance de loin : c'est tout son interet.
      const aDistance = moi.perso.special === "onde";

      if (distance > 2.4) {
        intentionOrdi = versLui;
        if (peutFrapper && moi.energie >= ENERGIE_MAX && Math.random() < (aDistance ? 0.7 : 0.4)) {
          frapper(moi, "special");
          attenteCoup = reglage.cadence;
        }
      } else if (distance < 1.1) {
        intentionOrdi = Math.random() < 0.3 ? -versLui : 0;
        if (peutFrapper && Math.random() < reglage.agressivite) {
          frapper(moi, Math.random() < 0.6 ? "poing" : "pied");
          attenteCoup = reglage.cadence;
        }
      } else {
        intentionOrdi = Math.random() < 0.7 ? versLui : 0;
        if (peutFrapper && Math.random() < reglage.agressivite) {
          if (moi.energie >= ENERGIE_MAX && Math.random() < 0.5) frapper(moi, "special");
          else frapper(moi, Math.random() < 0.5 ? "poing" : "pied");
          attenteCoup = reglage.cadence;
        }
      }
      // De temps en temps, un saut pour surprendre.
      if (moi.y <= 0.02 && !moi.coup && Math.random() < 0.05) {
        moi.vy = SAUT;
        sonSaut(audio);
      }
    }

    /** Deplacements et actions d'un combattant, a partir de ses touches. */
    function commander(l: Lutteur, t: Touches, dt: number, ordinateur: boolean) {
      const autre = l === a ? b : a;
      l.sens = autre.x >= l.x ? 1 : -1;
      l.marche = 0;

      if (l.repit > 0) l.repit -= dt;
      if (l.encaisse > 0) l.encaisse -= dt;

      if (l.sonne > 0) {
        l.sonne -= dt;
        l.bloque = false;
        return;
      }

      let direction = 0;
      if (ordinateur) {
        direction = intentionOrdi;
      } else {
        if (enfoncee(t.gauche)) direction -= 1;
        if (enfoncee(t.droite)) direction += 1;
        l.accroupi = enfoncee(t.bas) && l.y <= 0.02;
        // Bloquer, c'est reculer sans frapper : la regle de tous les jeux du
        // genre, et elle s'apprend en trois secondes.
        l.bloque = direction !== 0 && Math.sign(direction) === -l.sens && !l.coup;
        if (pressee(t.poing)) frapper(l, "poing");
        if (pressee(t.pied)) frapper(l, "pied");
        if (pressee(t.special)) frapper(l, "special");
        if (pressee(t.saut) && l.y <= 0.02) {
          l.vy = SAUT;
          sonSaut(audio);
        }
      }

      // Pendant un coup, on ne se deplace plus : sinon on frappe en reculant.
      if (!l.coup && !l.accroupi) {
        const vitesse = VITESSE * l.perso.vitesse * (l.bloque ? 0.45 : 1);
        l.x += direction * vitesse * dt;
        l.marche = direction;
      }

      // Charge : le special de Roc propulse vers l'avant.
      if (l.coup?.id === "special" && l.perso.special === "charge" && l.coup.t < 0.34) {
        l.x += l.sens * 12 * dt;
      }

      l.x = THREE.MathUtils.clamp(l.x, -ARENE, ARENE);
    }

    function avancerCoup(l: Lutteur, dt: number) {
      if (!l.coup) return;
      const coup = COUPS[l.coup.id];
      const facteur = 1 / (0.75 + l.perso.vitesse * 0.25);
      l.coup.t += dt / facteur;
      const total = coup.preparation + coup.actif + coup.recuperation;
      if (l.coup.t >= coup.preparation && l.coup.t <= coup.preparation + coup.actif) {
        resoudre(l, l === a ? b : a);
      }
      if (l.coup && l.coup.t >= total) l.coup = null;
    }

    /** L'animation a jouer, selon ce que fait le combattant. */
    function etatAnim(l: Lutteur): EtatAnim {
      if (l.ko) return "ko";
      if (l.victoire) return "victoire";
      if (l.coup) return "coup";
      if (l.encaisse > 0) return "touche";
      if (l.y > 0.05) return "saut";
      if (l.accroupi) return "accroupi";
      if (l.bloque) return "bloc";
      if (l.marche !== 0) return Math.sign(l.marche) === l.sens ? "marche" : "recul";
      return "garde";
    }

    /** Pose le squelette et place le personnage dans l'arene. */
    function animer(l: Lutteur, dt: number) {
      const etat = etatAnim(l);
      let progression = 0;
      let finPreparation = 0.3;
      let finActif = 0.55;
      if (l.coup) {
        const c = COUPS[l.coup.id];
        const total = c.preparation + c.actif + c.recuperation;
        progression = Math.min(1, l.coup.t / total);
        finPreparation = c.preparation / total;
        finActif = (c.preparation + c.actif) / total;
      }
      const cible = poseCible({
        etat,
        temps: horloge + (l.cote === "B" ? 1.3 : 0), // les deux ne respirent pas en meme temps
        coup: l.coup?.id,
        progression,
        finPreparation,
        finActif,
        perso: l.perso,
      });
      appliquerPose(l.modele.os, cible, dt, vitessePose(etat), l.modele.hauteurBassin);

      const { racine, ombre, os } = l.modele;

      // Orientation : de profil face a l'adversaire ; de face pour saluer la
      // victoire. Le tourbillon ajoute deux tours complets pendant le coup,
      // qui retombent pile sur l'orientation de depart.
      const orientation = l.victoire ? 0 : (l.sens * Math.PI) / 2;
      l.tourne += (orientation - l.tourne) * (1 - Math.exp(-14 * dt));
      const vrille =
        l.coup?.id === "special" && l.perso.special === "tourbillon" ? progression * Math.PI * 4 : 0;
      racine.rotation.y = l.tourne + vrille;

      // Au sol, le corps couche deborde sous les dalles : on le remonte
      // d'autant qu'il a bascule.
      const bascule = os.corps ? Math.max(0, -Math.sin(os.corps.rotation.x)) : 0;
      racine.position.set(l.x, l.y + bascule * 0.24, 0);

      // L'ombre reste au sol et retrecit quand on saute.
      ombre.position.set(l.x, 0.01, 0);
      ombre.scale.setScalar(Math.max(0.45, 1 - l.y * 0.18));

      // Clignotement quand on encaisse.
      if (l.flash > 0) {
        l.flash -= dt;
        racine.visible = Math.floor(l.flash * 45) % 2 === 0 || l.flash <= 0;
      } else {
        racine.visible = true;
      }
    }

    // ============================================================ la boucle
    function tick() {
      const maintenant = performance.now();
      // Plafonne : apres un changement d'onglet, un delta enorme ferait
      // traverser l'arene d'un coup.
      const dt = Math.min((maintenant - derniere) / 1000, 0.1);
      derniere = maintenant;
      horloge += dt;

      // Arret sur image : on dessine, mais le temps du combat ne s'ecoule
      // pas. Les touches pressees pendant ce temps restent en attente.
      if (gel > 0) {
        gel -= dt;
        renderer.render(scene, camera);
        return;
      }
      chrono += dt;

      // --- Le deroulement du round ---
      if (phase === "annonce") {
        annonce = chrono < 1.2 ? `Round ${round}` : "Combattez !";
        if (chrono >= 2) {
          phase = "combat";
          annonce = "";
        }
      } else if (phase === "finRound") {
        if (chrono > 1.2 && gagnantRound) {
          const g = gagnantRound === "A" ? a : b;
          g.victoire = true;
          annonce = `${g.perso.nom} gagne le round`;
        }
        if (chrono >= 3.2) {
          if (roundsA >= 2 || roundsB >= 2) {
            vainqueurMatch = roundsA >= 2 ? "A" : "B";
            phase = "fini";
            const v = vainqueurMatch === "A" ? a : b;
            v.victoire = true;
            annonce = `${v.perso.nom} l'emporte !`;
            publier();
            finRef.current(vainqueurMatch);
          } else {
            round++;
            nouveauRound();
          }
        }
      }

      if (phase === "combat") {
        temps -= dt;

        const touchesJoueur1 = optionsRef.current.contreOrdinateur ? TOUCHES_A_SOLO : TOUCHES_A_DUO;
        commander(a, touchesJoueur1, dt, false);
        if (optionsRef.current.contreOrdinateur) {
          jouerOrdinateur(b, a, dt);
          commander(b, TOUCHES_B, dt, true);
        } else {
          commander(b, TOUCHES_B, dt, false);
        }

        for (const l of lutteurs) avancerCoup(l, dt);

        // Les deux corps ne se traversent pas (sauf par-dessus, en sautant).
        const ecart = b.x - a.x;
        if (Math.abs(ecart) < ECART_MIN && a.y < 1.2 && b.y < 1.2) {
          const correction = (ECART_MIN - Math.abs(ecart)) / 2;
          const signe = ecart >= 0 ? 1 : -1;
          a.x = THREE.MathUtils.clamp(a.x - correction * signe, -ARENE, ARENE);
          b.x = THREE.MathUtils.clamp(b.x + correction * signe, -ARENE, ARENE);
        }
      }

      // Gravite : elle continue apres le K.O., pour que le corps retombe.
      for (const l of lutteurs) {
        if (l.y > 0 || l.vy !== 0) {
          l.vy -= GRAVITE * dt;
          l.y += l.vy * dt;
          if (l.y <= 0) {
            if (l.vy < -2) sonSol(audio);
            l.y = 0;
            l.vy = 0;
          }
        }
      }

      // Les ondes voyagent, et touchent ce qu'elles rencontrent.
      for (let i = ondes.length - 1; i >= 0; i--) {
        const o = ondes[i];
        o.x += o.sens * VITESSE_ONDE * dt;
        o.vie -= dt;
        o.groupe.position.set(o.x, o.y + Math.sin(horloge * 20) * 0.05, 0.2);
        o.groupe.scale.setScalar(1 + Math.sin(horloge * 30) * 0.12);
        const cible = o.auteur === a ? b : a;
        // On l'evite en sautant par-dessus, ou en se baissant dessous.
        const touche =
          phase === "combat" && Math.abs(cible.x - o.x) < 0.7 && cible.y < 1.3 && !cible.accroupi;
        if (touche) {
          encaisser(o.auteur, cible, "special", o.sens, true);
          eclats(o.x, o.y, o.auteur.perso.accent, 18);
        }
        if (touche || o.vie <= 0 || Math.abs(o.x) > ARENE + 3) retirerOnde(i);
      }

      if (phase === "combat") {
        if (a.vie <= 0 || b.vie <= 0) {
          finDeRound(a.vie <= 0 && b.vie <= 0 ? null : a.vie <= 0 ? "B" : "A", true);
        } else if (temps <= 0) {
          finDeRound(a.vie === b.vie ? null : a.vie > b.vie ? "A" : "B", false);
        }
      }

      for (const l of lutteurs) animer(l, dt);

      // Etincelles.
      for (let i = etincelles.length - 1; i >= 0; i--) {
        const e = etincelles[i];
        e.vie -= dt;
        e.mesh.position.x += e.vx * dt;
        e.mesh.position.y += e.vy * dt;
        e.vy -= 14 * dt;
        (e.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, e.vie / 0.38);
        if (e.vie <= 0) {
          scene.remove(e.mesh);
          (e.mesh.material as THREE.Material).dispose();
          etincelles.splice(i, 1);
        }
      }

      // Les braseros respirent, l'embleme aussi.
      const pulse = 1 + Math.sin(horloge * 7) * 0.12;
      for (const f of feux) f.scale.setScalar(pulse);
      flamme.scale.y = 1.35 + Math.sin(horloge * 5) * 0.1;

      // La camera suit le milieu des deux, basse et de cote, et recule quand
      // ils s'eloignent : on doit toujours voir les deux combattants.
      const milieu = (a.x + b.x) / 2;
      const distance = Math.abs(a.x - b.x);
      const recul = THREE.MathUtils.clamp(8 + distance * 0.55, 9, 15.5);
      const suivi = 1 - Math.exp(-4 * dt);
      const visee = milieu * 0.85;
      camera.position.x += (visee - camera.position.x) * suivi;
      camera.position.y += (2.4 - camera.position.y) * suivi;
      camera.position.z += (recul - camera.position.z) * (1 - Math.exp(-3 * dt));
      // Petit tremblement sur les gros impacts : on SENT le coup.
      if (tremblement > 0) {
        tremblement -= dt;
        camera.position.x += (Math.random() - 0.5) * tremblement * 0.5;
        camera.position.y += (Math.random() - 0.5) * tremblement * 0.5;
      }
      camera.lookAt(visee, 1.3, 0);

      publier();
      fraiches.clear();
      renderer.render(scene, camera);
    }

    // Cadence fixe (regle de la maison) : 16 ms, delta calcule a la main.
    nouveauRound();
    const minuteur = window.setInterval(tick, 16);

    function onResize() {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.clearInterval(minuteur);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      for (const e of etincelles) (e.mesh.material as THREE.Material).dispose();
      for (const o of ondes) for (const m of o.materiaux) m.dispose();
      for (const x of aJeter) x.dispose();
      audio.ctx?.close().catch(() => {});
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [persoA, persoB]);

  return <div ref={hote} className="absolute inset-0" />;
}
