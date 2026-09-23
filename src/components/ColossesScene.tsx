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
  degatsDe,
  type Colosse,
  type ColosseId,
  type CoupId,
  type Difficulte,
} from "@/lib/colosses";
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
  temps: number;
  /** Message affiche en grand au centre ("Round 1", "K.O.", "Égalité"...). */
  annonce: string;
  /** Rempli quand le match est fini : "A" ou "B". */
  vainqueur: "A" | "B" | null;
}

export interface ColossesOptions {
  /** Faux = deux joueurs sur le meme clavier. */
  contreOrdinateur: boolean;
  difficulte: Difficulte;
  volume: number;
}

type Phase = "annonce" | "combat" | "fini";

/** Un combattant, cote moteur. */
interface Lutteur {
  cote: "A" | "B";
  perso: Colosse;
  x: number;
  y: number;
  vy: number;
  /** +1 regarde a droite, -1 a gauche. */
  sens: 1 | -1;
  vie: number;
  energie: number;
  accroupi: boolean;
  bloque: boolean;
  /** Coup en cours, avec le temps ecoule depuis son debut. */
  coup: { id: CoupId; t: number; touche: boolean } | null;
  /** Temps restant sonne : on ne peut rien faire. */
  sonne: number;
  /** Temps pendant lequel on ne peut plus etre touche (voir REPIT). */
  repit: number;
  /** Groupe 3D et ses membres, pour les animations. */
  groupe: THREE.Group;
  os: Record<string, THREE.Object3D>;
  /** Clignotement quand on est touche. */
  flash: number;
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
    scene.background = new THREE.Color(0x0b1020);
    scene.fog = new THREE.Fog(0x0b1020, 22, 48);

    const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Lumieres : quatre, pas plus (regle de la maison) ---
    scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x1a1024, 2.2));
    const cle = new THREE.DirectionalLight(0xfff0d0, 1.5);
    cle.position.set(4, 9, 8);
    scene.add(cle);
    const contre = new THREE.DirectionalLight(0x6ad8ff, 0.8);
    contre.position.set(-6, 5, -6);
    scene.add(contre);

    const aJeter: { dispose(): void }[] = [];
    function garder<T extends { dispose(): void }>(x: T): T {
      aJeter.push(x);
      return x;
    }

    // --- L'arene ---
    const solGeo = garder(new THREE.BoxGeometry(ARENE * 2 + 6, 1, 10));
    const solMat = garder(new THREE.MeshLambertMaterial({ color: 0x2b2438 }));
    const sol = new THREE.Mesh(solGeo, solMat);
    sol.position.y = -0.5;
    scene.add(sol);

    // Un damier discret pour donner une echelle : sans reperes au sol, on ne
    // voit plus a quelle distance on se trouve.
    const damierMat = garder(new THREE.MeshLambertMaterial({ color: 0x3a3150 }));
    const damierGeo = garder(new THREE.BoxGeometry(1.6, 1.02, 9.6));
    for (let i = -6; i <= 6; i += 2) {
      const dalle = new THREE.Mesh(damierGeo, damierMat);
      dalle.position.set(i * 1.6, -0.5, 0);
      scene.add(dalle);
    }

    // Fond : deux murs et des piliers, juste pour l'ambiance.
    const murMat = garder(new THREE.MeshLambertMaterial({ color: 0x1b1730 }));
    const mur = new THREE.Mesh(garder(new THREE.BoxGeometry(ARENE * 2 + 8, 12, 1)), murMat);
    mur.position.set(0, 5, -5);
    scene.add(mur);
    const pilierGeo = garder(new THREE.CylinderGeometry(0.6, 0.7, 12, 8));
    const pilierMat = garder(new THREE.MeshLambertMaterial({ color: 0x2a2444 }));
    for (const x of [-9, -4.5, 4.5, 9]) {
      const p = new THREE.Mesh(pilierGeo, pilierMat);
      p.position.set(x, 5.5, -4.2);
      scene.add(p);
    }
    // Deux braseros : les seules sources chaudes de l'image.
    const feuMat = garder(new THREE.MeshBasicMaterial({ color: 0xffa23c }));
    const feux: THREE.Mesh[] = [];
    for (const x of [-7.5, 7.5]) {
      const f = new THREE.Mesh(garder(new THREE.SphereGeometry(0.42, 8, 6)), feuMat);
      f.position.set(x, 1.6, -3.6);
      scene.add(f);
      feux.push(f);
      const l = new THREE.PointLight(0xff9a3c, 12, 14);
      l.position.copy(f.position);
      scene.add(l);
    }

    // --- Construction d'un combattant, en boites ---
    function construire(perso: Colosse): { groupe: THREE.Group; os: Record<string, THREE.Object3D> } {
      const groupe = new THREE.Group();
      const os: Record<string, THREE.Object3D> = {};

      const peau = garder(new THREE.MeshLambertMaterial({ color: perso.peau }));
      const armure = garder(new THREE.MeshLambertMaterial({ color: perso.armure }));
      const accent = garder(new THREE.MeshBasicMaterial({ color: perso.accent }));

      const boite = (l: number, h: number, p: number, m: THREE.Material) =>
        new THREE.Mesh(garder(new THREE.BoxGeometry(l, h, p)), m);

      // Le bassin porte tout : c'est lui qu'on deplace pour l'accroupissement.
      const bassin = new THREE.Group();
      bassin.position.y = 1.05;
      groupe.add(bassin);
      os.bassin = bassin;

      const torse = boite(0.78, 0.95, 0.46, armure);
      torse.position.y = 0.48;
      bassin.add(torse);
      os.torse = torse;

      const ceinture = boite(0.8, 0.16, 0.48, accent);
      ceinture.position.y = 0.02;
      bassin.add(ceinture);

      const tete = boite(0.46, 0.46, 0.44, peau);
      tete.position.y = 1.22;
      bassin.add(tete);
      os.tete = tete;
      // Le regard : deux points lumineux, qui suffisent a donner un visage.
      for (const dx of [-0.12, 0.12]) {
        const oeil = boite(0.07, 0.07, 0.04, accent);
        oeil.position.set(dx, 0.04, 0.23);
        tete.add(oeil);
      }

      // Bras : epaule -> avant-bras -> poing. Chaque articulation est un
      // groupe, pour pouvoir plier le bras pendant les coups.
      for (const cote of ["G", "D"] as const) {
        const signe = cote === "D" ? 1 : -1;
        const epaule = new THREE.Group();
        epaule.position.set(signe * 0.47, 0.82, 0);
        bassin.add(epaule);
        os[`epaule${cote}`] = epaule;

        const bras = boite(0.22, 0.44, 0.22, peau);
        bras.position.y = -0.22;
        epaule.add(bras);

        const coude = new THREE.Group();
        coude.position.y = -0.44;
        epaule.add(coude);
        os[`coude${cote}`] = coude;

        const avantBras = boite(0.2, 0.4, 0.2, peau);
        avantBras.position.y = -0.2;
        coude.add(avantBras);

        const poing = boite(0.26, 0.26, 0.26, armure);
        poing.position.y = -0.46;
        coude.add(poing);
        os[`poing${cote}`] = poing;
      }

      // Jambes : hanche -> genou -> pied.
      for (const cote of ["G", "D"] as const) {
        const signe = cote === "D" ? 1 : -1;
        const hanche = new THREE.Group();
        hanche.position.set(signe * 0.22, 0, 0);
        bassin.add(hanche);
        os[`hanche${cote}`] = hanche;

        const cuisse = boite(0.28, 0.5, 0.28, armure);
        cuisse.position.y = -0.25;
        hanche.add(cuisse);

        const genou = new THREE.Group();
        genou.position.y = -0.5;
        hanche.add(genou);
        os[`genou${cote}`] = genou;

        const mollet = boite(0.24, 0.46, 0.24, peau);
        mollet.position.y = -0.23;
        genou.add(mollet);

        const pied = boite(0.3, 0.16, 0.42, armure);
        pied.position.set(0, -0.5, 0.06);
        genou.add(pied);
        os[`pied${cote}`] = pied;
      }

      scene.add(groupe);
      return { groupe, os };
    }

    function nouveauLutteur(cote: "A" | "B", id: ColosseId): Lutteur {
      const perso = COLOSSES[id];
      const { groupe, os } = construire(perso);
      return {
        cote,
        perso,
        x: cote === "A" ? -3 : 3,
        y: 0,
        vy: 0,
        sens: cote === "A" ? 1 : -1,
        vie: perso.vie,
        energie: 0,
        accroupi: false,
        bloque: false,
        coup: null,
        sonne: 0,
        repit: 0,
        groupe,
        os,
        flash: 0,
      };
    }

    const a = nouveauLutteur("A", persoA);
    const b = nouveauLutteur("B", persoB);
    const lutteurs = [a, b];

    // --- Effets : etincelles a l'impact ---
    const etincelleMat = garder(new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    const etincelleGeo = garder(new THREE.SphereGeometry(0.09, 5, 4));
    const etincelles: { mesh: THREE.Mesh; vie: number; vx: number; vy: number }[] = [];
    function eclats(x: number, y: number, couleur: number, combien: number) {
      for (let i = 0; i < combien; i++) {
        const m = new THREE.Mesh(etincelleGeo, etincelleMat.clone());
        (m.material as THREE.MeshBasicMaterial).color.setHex(couleur);
        m.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, 0.3);
        scene.add(m);
        etincelles.push({
          mesh: m,
          vie: 0.35,
          vx: (Math.random() - 0.5) * 6,
          vy: Math.random() * 5 + 1,
        });
      }
    }

    // --- Entrees clavier ---
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

    // --- Etat de la partie ---
    const audio: ColossesAudio = creerAudio(optionsRef.current.volume);
    let phase: Phase = "annonce";
    let annonce = "Round 1";
    let annonceJusqua = 1.6;
    let temps = DUREE_ROUND;
    let roundsA = 0;
    let roundsB = 0;
    let round = 1;
    let horloge = 0;
    let derniere = performance.now();
    let cerveau = 0; // minuteur de reflexion de l'ordinateur

    function publier(vainqueur: "A" | "B" | null = null) {
      etatRef.current({
        vieA: Math.max(0, a.vie),
        vieB: Math.max(0, b.vie),
        energieA: a.energie,
        energieB: b.energie,
        roundsA,
        roundsB,
        temps: Math.max(0, Math.ceil(temps)),
        annonce: horloge < annonceJusqua ? annonce : "",
        vainqueur,
      });
    }

    function nouveauRound() {
      for (const l of lutteurs) {
        l.vie = l.perso.vie;
        l.energie = 0;
        l.x = l.cote === "A" ? -3 : 3;
        l.y = 0;
        l.vy = 0;
        l.coup = null;
        l.sonne = 0;
        l.repit = 0;
        l.flash = 0;
      }
      temps = DUREE_ROUND;
      phase = "annonce";
      annonce = `Round ${round}`;
      horloge = 0;
      annonceJusqua = 1.6;
      sonGong(audio);
      publier();
    }

    function finDeRound(gagnant: "A" | "B" | null) {
      if (gagnant === "A") roundsA++;
      if (gagnant === "B") roundsB++;
      annonce = gagnant === null ? "Égalité" : gagnant === "A" ? `${a.perso.nom} gagne le round` : `${b.perso.nom} gagne le round`;
      horloge = 0;
      annonceJusqua = 2.2;
      phase = "annonce";
      sonKo(audio);

      if (roundsA >= 2 || roundsB >= 2) {
        const vainqueur: "A" | "B" = roundsA >= 2 ? "A" : "B";
        phase = "fini";
        annonce = vainqueur === "A" ? `${a.perso.nom} l'emporte !` : `${b.perso.nom} l'emporte !`;
        annonceJusqua = 99;
        publier(vainqueur);
        finRef.current(vainqueur);
        return;
      }
      round++;
      publier();
    }

    /** Lance un coup si le combattant est libre de le faire. */
    function frapper(l: Lutteur, id: CoupId) {
      if (l.coup || l.sonne > 0 || phase !== "combat") return;
      if (id === "special" && l.energie < ENERGIE_MAX) return;
      if (id === "special") {
        l.energie = 0;
        sonSpecial(audio);
      }
      l.coup = { id, t: 0, touche: false };
    }

    /** Le coup touche-t-il ? Distance, hauteur, et garde de l'adversaire. */
    function resoudre(attaquant: Lutteur, cible: Lutteur) {
      const c = attaquant.coup;
      if (!c || c.touche) return;
      const coup = COUPS[c.id];
      const portee = coup.portee * (c.id === "special" && attaquant.perso.special === "charge" ? 1.6 : 1);
      const distance = Math.abs(cible.x - attaquant.x);
      const devant = Math.sign(cible.x - attaquant.x) === attaquant.sens;
      if (!devant || distance > portee + 0.35) return;

      // Un coup haut passe au-dessus d'un adversaire accroupi ; un coup bas
      // ne touche pas quelqu'un en l'air. C'est ce qui rend l'esquive utile.
      if (coup.hauteur === "haut" && cible.accroupi) return;
      if (coup.hauteur === "bas" && cible.y > 0.6) return;
      if (cible.y > 1.6 && c.id !== "special") return;

      // Respiration : on ne remet pas un coup a quelqu'un qui vient d'en
      // prendre un. Le coup part quand meme (on le voit), il ne compte pas.
      if (cible.repit > 0) {
        c.touche = true;
        return;
      }

      c.touche = true;
      // On bloque en tenant la direction OPPOSEE a l'adversaire, sans attaquer.
      const bloque = cible.bloque && !cible.coup && cible.y <= 0.05;
      const degats = degatsDe(coup, attaquant.perso, bloque);
      cible.vie -= degats;
      cible.sonne = bloque ? 0.12 : degats * ETOURDISSEMENT;
      cible.repit = bloque ? 0.12 : REPIT;
      // Les deux reculent : l'attaquant doit revenir, donc il ne peut pas
      // rester colle a marteler le meme bouton.
      attaquant.x -= coup.poussee * 0.12 * attaquant.sens;
      cible.flash = bloque ? 0.06 : 0.16;
      cible.x += coup.poussee * (bloque ? 0.4 : 1) * attaquant.sens * 0.55;
      attaquant.energie = Math.min(ENERGIE_MAX, attaquant.energie + coup.energie);
      if (!bloque) cible.energie = Math.min(ENERGIE_MAX, cible.energie + coup.energie * 0.5);

      const hauteurImpact = cible.y + (cible.accroupi ? 0.8 : 1.4);
      if (bloque) {
        sonBloc(audio);
        eclats(cible.x, hauteurImpact, 0x9fd8ff, 5);
      } else {
        if (c.id === "poing") sonPoing(audio);
        else if (c.id === "pied") sonPied(audio);
        eclats(cible.x, hauteurImpact, c.id === "special" ? attaquant.perso.accent : 0xffd98a, c.id === "special" ? 22 : 9);
      }

      // L'uppercut envoie en l'air : c'est ce qui le rend spectaculaire.
      if (c.id === "special" && attaquant.perso.special === "uppercut" && !bloque) {
        cible.vy = 8;
      }
    }

    /**
     * L'ordinateur.
     *
     * Il ne lit pas l'avenir : il regarde la distance et decide, avec un
     * temps de reaction. Un adversaire qui reagit instantanement n'est pas
     * difficile, il est injuste.
     */
    function jouerOrdinateur(moi: Lutteur, autre: Lutteur, dt: number) {
      const reglage = DIFFICULTES[optionsRef.current.difficulte];
      cerveau -= dt;
      attenteCoup -= dt;
      const distance = Math.abs(autre.x - moi.x);
      const versLui = Math.sign(autre.x - moi.x);

      // Garde : quand l'autre prepare un coup et qu'on est a portee.
      const menace = autre.coup && !autre.coup.touche && distance < 2.2;
      moi.bloque = Boolean(menace) && Math.random() < reglage.garde;
      if (moi.bloque) return;

      if (cerveau > 0) return;
      cerveau = reglage.reaction + Math.random() * 0.18;

      if (moi.sonne > 0 || moi.coup) return;

      // Il ne frappe pas quelqu'un qui est encore sonne : sans cette regle,
      // il enchaine et on regarde son personnage mourir sans rien pouvoir
      // faire. Un adversaire dur doit etre dur, pas injouable.
      const libre = autre.sonne <= 0 && autre.repit <= 0;
      const peutFrapper = libre && attenteCoup <= 0;

      if (distance > 2.4) {
        // Trop loin : on approche, ou on lance le special s'il est pret.
        intentionOrdi = versLui;
        if (peutFrapper && moi.energie >= ENERGIE_MAX && Math.random() < 0.4) {
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
    }
    let intentionOrdi = 0;
    /** Temps avant que l'ordinateur ne se permette une nouvelle attaque. */
    let attenteCoup = 0;

    /** Deplacements et actions d'un combattant, a partir de ses touches. */
    function commander(l: Lutteur, t: Touches, dt: number, ordinateur: boolean) {
      const autre = l === a ? b : a;
      l.sens = autre.x >= l.x ? 1 : -1;

      if (l.repit > 0) l.repit -= dt;

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
      }

      // Charge : le special de Roc propulse vers l'avant.
      if (l.coup?.id === "special" && l.perso.special === "charge" && l.coup.t < 0.3) {
        l.x += l.sens * 11 * dt;
      }

      l.x = THREE.MathUtils.clamp(l.x, -ARENE, ARENE);
    }

    function avancerCoup(l: Lutteur, dt: number) {
      if (!l.coup) return;
      const coup = COUPS[l.coup.id];
      const facteur = 1 / (0.75 + l.perso.vitesse * 0.25);
      l.coup.t += dt / facteur;
      const total = coup.preparation + coup.actif + coup.recuperation;
      const debutActif = coup.preparation;
      const finActif = coup.preparation + coup.actif;
      if (l.coup.t >= debutActif && l.coup.t <= finActif) {
        resoudre(l, l === a ? b : a);
      }
      if (l.coup.t >= total) l.coup = null;
    }

    /** Pose le squelette selon ce que fait le combattant. */
    function animer(l: Lutteur, dt: number) {
      const { os } = l;
      const bassin = os.bassin;
      const marche = horloge * 9;

      // Repos : une garde haute, le corps legerement de biais.
      let epauleD = -0.5;
      let coudeD = -1.5;
      let epauleG = -0.35;
      let coudeG = -1.2;
      let hancheD = 0.1;
      let hancheG = -0.1;
      let genouD = 0;
      let genouG = 0;
      let torseInclinaison = 0.04;

      if (l.coup) {
        const coup = COUPS[l.coup.id];
        const total = coup.preparation + coup.actif + coup.recuperation;
        const p = Math.min(1, l.coup.t / total);
        // Une cloche : le coup part, touche au sommet, puis revient.
        const sortie = Math.sin(Math.min(1, l.coup.t / (coup.preparation + coup.actif)) * Math.PI);
        if (l.coup.id === "poing") {
          epauleD = -1.6 * sortie - 0.5 * (1 - sortie);
          coudeD = -0.1 * sortie - 1.5 * (1 - sortie);
          torseInclinaison = 0.04 + sortie * 0.25;
        } else if (l.coup.id === "pied") {
          hancheD = -1.5 * sortie + 0.1;
          genouD = 0.3 * (1 - sortie);
          epauleG = -1.1 * sortie - 0.35;
          torseInclinaison = 0.04 - sortie * 0.3;
        } else {
          // Le special : les deux bras, et une pose qui se voit de loin.
          epauleD = -2.2 * sortie - 0.5;
          epauleG = -2.2 * sortie - 0.35;
          coudeD = -0.2;
          coudeG = -0.2;
          torseInclinaison = 0.04 - sortie * 0.2;
          if (l.perso.special === "tourbillon") l.groupe.rotation.y += dt * 18 * sortie;
        }
        if (p > 0.98 && l.perso.special === "tourbillon") l.groupe.rotation.y = 0;
      } else if (l.sonne > 0) {
        // Sonne : la tete part en arriere, les bras retombent.
        epauleD = 0.4;
        epauleG = 0.4;
        coudeD = -0.3;
        coudeG = -0.3;
        torseInclinaison = -0.4;
      } else if (Math.abs(l.y) > 0.05) {
        hancheD = -0.8;
        hancheG = -0.4;
        genouD = 1.1;
        genouG = 0.6;
      } else if (l.bloque) {
        epauleD = -1.9;
        epauleG = -1.9;
        coudeD = -1.9;
        coudeG = -1.9;
        torseInclinaison = 0.2;
      }

      // Marche : les jambes balancent quand on bouge au sol.
      const bouge = !l.coup && l.sonne <= 0 && Math.abs(l.y) < 0.05;
      if (bouge) {
        hancheD += Math.sin(marche) * 0.25;
        hancheG += Math.sin(marche + Math.PI) * 0.25;
      }

      os.epauleD.rotation.x = epauleD;
      os.coudeD.rotation.x = coudeD;
      os.epauleG.rotation.x = epauleG;
      os.coudeG.rotation.x = coudeG;
      os.hancheD.rotation.x = hancheD;
      os.hancheG.rotation.x = hancheG;
      os.genouD.rotation.x = genouD;
      os.genouG.rotation.x = genouG;
      os.torse.rotation.x = torseInclinaison;
      os.tete.rotation.x = l.sonne > 0 ? -0.5 : 0;

      // Accroupi : le bassin descend, les genoux plient.
      const cible = l.accroupi ? 0.62 : 1.05;
      bassin.position.y += (cible - bassin.position.y) * Math.min(1, dt * 14);
      if (l.accroupi) {
        os.hancheD.rotation.x = -0.9;
        os.hancheG.rotation.x = -0.9;
        os.genouD.rotation.x = 1.6;
        os.genouG.rotation.x = 1.6;
      }

      l.groupe.position.set(l.x, l.y, 0);
      // Le personnage regarde toujours son adversaire.
      const cibleRot = l.sens === 1 ? Math.PI / 2 : -Math.PI / 2;
      if (l.perso.special !== "tourbillon" || !l.coup || l.coup.id !== "special") {
        l.groupe.rotation.y += (cibleRot - l.groupe.rotation.y) * Math.min(1, dt * 12);
      }

      // Clignotement rouge quand on encaisse.
      if (l.flash > 0) {
        l.flash -= dt;
        const visible = Math.floor(l.flash * 40) % 2 === 0;
        l.groupe.visible = visible || l.flash <= 0;
      } else {
        l.groupe.visible = true;
      }
    }

    // --- La boucle ---
    function tick() {
      const maintenant = performance.now();
      // Plafonne : apres un changement d'onglet, un delta enorme ferait
      // traverser l'arene d'un coup.
      const dt = Math.min((maintenant - derniere) / 1000, 0.1);
      derniere = maintenant;
      horloge += dt;

      if (phase === "annonce" && horloge >= annonceJusqua) {
        phase = "combat";
        publier();
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

        for (const l of lutteurs) {
          // Gravite.
          if (l.y > 0 || l.vy !== 0) {
            l.vy -= GRAVITE * dt;
            l.y += l.vy * dt;
            if (l.y <= 0) {
              if (l.vy < -2) sonSol(audio);
              l.y = 0;
              l.vy = 0;
            }
          }
          avancerCoup(l, dt);
        }

        // Les deux corps ne se traversent pas.
        const ecart = b.x - a.x;
        if (Math.abs(ecart) < ECART_MIN) {
          const correction = (ECART_MIN - Math.abs(ecart)) / 2;
          const signe = ecart >= 0 ? 1 : -1;
          a.x -= correction * signe;
          b.x += correction * signe;
          a.x = THREE.MathUtils.clamp(a.x, -ARENE, ARENE);
          b.x = THREE.MathUtils.clamp(b.x, -ARENE, ARENE);
        }

        if (a.vie <= 0 || b.vie <= 0) {
          finDeRound(a.vie <= 0 && b.vie <= 0 ? null : a.vie <= 0 ? "B" : "A");
        } else if (temps <= 0) {
          finDeRound(a.vie === b.vie ? null : a.vie > b.vie ? "A" : "B");
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
        (e.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, e.vie / 0.35);
        (e.mesh.material as THREE.MeshBasicMaterial).transparent = true;
        if (e.vie <= 0) {
          scene.remove(e.mesh);
          (e.mesh.material as THREE.Material).dispose();
          etincelles.splice(i, 1);
        }
      }

      // Les braseros respirent.
      const pulse = 1 + Math.sin(horloge * 6) * 0.12;
      for (const f of feux) f.scale.setScalar(pulse);

      // La camera suit le milieu des deux, et recule quand ils s'eloignent :
      // on doit toujours voir les deux combattants, c'est la regle d'or.
      const milieu = (a.x + b.x) / 2;
      const distance = Math.abs(a.x - b.x);
      const recul = THREE.MathUtils.clamp(8.5 + distance * 0.55, 9, 16);
      camera.position.x += (milieu * 0.6 - camera.position.x) * Math.min(1, dt * 4);
      camera.position.y += (2.9 - camera.position.y) * Math.min(1, dt * 4);
      camera.position.z += (recul - camera.position.z) * Math.min(1, dt * 3);
      camera.lookAt(milieu * 0.6, 1.5, 0);

      publier(phase === "fini" ? (roundsA >= 2 ? "A" : "B") : null);
      fraiches.clear();
      renderer.render(scene, camera);
    }

    // Cadence fixe (regle de la maison) : 16 ms, delta calcule a la main.
    const minuteur = window.setInterval(tick, 16);
    nouveauRound();

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
      for (const x of aJeter) x.dispose();
      audio.ctx?.close().catch(() => {});
      renderer.forceContextLoss();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [persoA, persoB]);

  return <div ref={hote} className="absolute inset-0" />;
}
