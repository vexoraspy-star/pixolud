/**
 * Mode admin du Duel : les triches classiques des jeux de tir, pour tester
 * le jeu et s'amuser. Reserve aux comptes admin (drapeau lu cote serveur),
 * et jamais en ligne contre une vraie personne. Une partie ou une triche a
 * servi ne rapporte ni pieces ni experience.
 */

export interface DuelCheats {
  /** Le viseur se colle a la tete la plus proche en vue, en tirant ou en visant. */
  aimbot: boolean;
  /** Tire tout seul des qu'un ennemi passe sous le reticule. */
  triggerbot: boolean;
  /** Vision a travers les murs : silhouettes, noms, vie et distance. */
  esp: boolean;
  /** Les objets au sol visibles a travers les murs. */
  lootEsp: boolean;
  /** Aucun degat recu. */
  god: boolean;
  /** Le chargeur ne se vide jamais. */
  infiniteAmmo: boolean;
  /** Ni recul ni dispersion. */
  noRecoil: boolean;
  /** Cadence de tir multipliee par quatre. */
  rapidFire: boolean;
  /** Un tir, un mort. */
  oneShot: boolean;
  /** Vitesse de deplacement doublee. */
  speed: boolean;
  /** Traverser les murs. */
  noclip: boolean;
  /** Les bots ne te voient plus. */
  invisible: boolean;
  /** Les bots ne bougent plus et ne tirent plus. */
  freezeBots: boolean;
  /** Tous les combattants sur la mini-carte. */
  radarAll: boolean;
  /** La zone ne fait plus de degats. */
  noZone: boolean;
  /** Toutes les armes a la demande : touches 1 a 9. */
  allWeapons: boolean;
}

export const NO_CHEATS: DuelCheats = {
  aimbot: false,
  triggerbot: false,
  esp: false,
  lootEsp: false,
  god: false,
  infiniteAmmo: false,
  noRecoil: false,
  rapidFire: false,
  oneShot: false,
  speed: false,
  noclip: false,
  invisible: false,
  freezeBots: false,
  radarAll: false,
  noZone: false,
  allWeapons: false,
};

export const CHEAT_LIST: { id: keyof DuelCheats; label: string; hint: string; group: "Visée" | "Vision" | "Survie" | "Mouvement" | "Partie" }[] = [
  { id: "aimbot", label: "Aimbot", hint: "Vise la tête la plus proche en tirant", group: "Visée" },
  { id: "triggerbot", label: "Triggerbot", hint: "Tire dès qu'un ennemi est sous le réticule", group: "Visée" },
  { id: "noRecoil", label: "Sans recul", hint: "Ni recul ni dispersion", group: "Visée" },
  { id: "rapidFire", label: "Tir rapide", hint: "Cadence × 4", group: "Visée" },
  { id: "oneShot", label: "Un coup, un mort", hint: "Dégâts énormes", group: "Visée" },
  { id: "allWeapons", label: "Toutes les armes", hint: "Touches 1 à 9", group: "Visée" },
  { id: "esp", label: "X-ray joueurs", hint: "À travers les murs : nom, vie, distance", group: "Vision" },
  { id: "lootEsp", label: "X-ray objets", hint: "Armes et soins à travers les murs", group: "Vision" },
  { id: "radarAll", label: "Radar complet", hint: "Tout le monde sur la mini-carte", group: "Vision" },
  { id: "god", label: "Invincible", hint: "Aucun dégât", group: "Survie" },
  { id: "infiniteAmmo", label: "Munitions infinies", hint: "Jamais de rechargement", group: "Survie" },
  { id: "noZone", label: "Zone inoffensive", hint: "La zone ne blesse plus", group: "Survie" },
  { id: "invisible", label: "Invisible", hint: "Les bots ne te voient pas", group: "Survie" },
  { id: "speed", label: "Vitesse × 2", hint: "Déplacement doublé", group: "Mouvement" },
  { id: "noclip", label: "Traverser les murs", hint: "Noclip", group: "Mouvement" },
  { id: "freezeBots", label: "Geler les bots", hint: "Ils ne bougent ni ne tirent", group: "Partie" },
];

export function anyCheat(c: DuelCheats): boolean {
  return Object.values(c).some(Boolean);
}
