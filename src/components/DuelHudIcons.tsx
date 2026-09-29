import type { WeaponId } from "@/lib/duelWeapons";
import type { KnifeId } from "@/lib/duelKnives";

/**
 * Silhouettes de l'interface du Duel : armes, grenades, vie, armure.
 *
 * Toutes dessinees a la main pour Pixolud, en profil, bouche du canon a
 * droite (vers la victime dans le fil des eliminations). Aucune ne reprend
 * une icone existante : ce sont des formes generiques (crosse, carcasse,
 * chargeur, lunette) assemblees en chemins SVG. Une seule couleur
 * (`currentColor`) : le HUD choisit la teinte, l'icone ne fait que la forme.
 *
 * Hauteur de reference 40 ; la largeur `w` varie avec l'arme, pour qu'un
 * pistolet reste petit a cote d'un fusil de precision a la meme hauteur.
 */
export type HudIconId =
  | WeaponId
  | "karambit"
  | "grenade"
  | "fumigene"
  | "zone"
  | "tete"
  | "vie"
  | "armure"
  | "viseur"
  | "balle"
  | "materiaux"
  | "parachute";

interface IconShape {
  /** Largeur de la boite, pour une hauteur de 40. */
  w: number;
  /** Surfaces pleines (regle evenodd : un sous-chemin interieur fait un trou). */
  d: string[];
  /** Traits fins (corde de l'arbalete, suspentes). */
  s?: string[];
}

const ICONS: Record<HudIconId, IconShape> = {
  pistolet: {
    w: 62,
    d: [
      "M6 8 H55 L57 10 V17 H6 Z",
      "M7 6 H12 V8 H7 Z",
      "M51 6.5 H54 V8 H51 Z",
      "M8 17 H56 V21 H42 V27 Q42 29 40 29 H31 Q29 29 28.6 27 L28 23 H22 L20 21 H8 Z M30.6 21 H39.6 V25.4 Q39.6 26.8 38.2 26.8 H32 Q30.8 26.8 30.7 25.4 Z",
      "M33 21 H34.6 L35.2 25 H33.8 Z",
      "M8 17 H23 L18.5 36 Q18 38 15.5 38 H5 Q2.5 38 3 35.5 Z",
    ],
  },
  revolver: {
    w: 70,
    d: [
      "M32 9 H64 V15 H32 Z",
      "M58 9 L60 6.5 H63 V9 Z",
      "M34 15 H56 V18 H34 Z",
      "M14 8 H33 V11 H14 Z",
      "M17 10 H32 Q34 10 34 12 V20 Q34 22 32 22 H17 Q15 22 15 20 V12 Q15 10 17 10 Z M19 13 H30 V14 H19 Z M19 18 H30 V19 H19 Z",
      "M11 10 H15 V23 H34 V25 H11 Z",
      "M9.5 6 L13 8.5 L14 12 L10.5 12 Z",
      "M18 24 H31 Q31 31 24.5 31 Q18 31 18 24 Z M20.5 25 H28.5 Q28.5 28.5 24.5 28.5 Q20.5 28.5 20.5 25 Z",
      "M23.5 24 H25 L24.6 28 H23.8 Z",
      "M10 11 H17 L16 24 Q12 30 12.5 35.5 Q12.8 38.5 9.5 38.5 H5 Q2 38.5 2.8 35 Q5.5 24 10 11 Z",
    ],
  },
  pm: {
    w: 70,
    d: [
      "M12 9 H52 Q54 9 54 11 V20 H12 Z",
      "M54 12.5 H62 V16.5 H54 Z",
      "M49 6 H52 V9 H49 Z",
      "M14 6.5 H18 V9 H14 Z",
      "M30 7 H36 V9 H30 Z",
      "M1 10 H12 V12.5 H4 V18.5 H12 V21 H1 Z",
      "M0 9 H3 V22 H0 Z",
      "M26 20 H35 L34.5 31 H26.5 Z",
      "M27 31 H34 V39 H27 Z",
      "M35 20 H44 Q44 26 40 26 H35 Z M36.5 20 H42 Q42 24.2 39.5 24.2 H36.5 Z",
    ],
  },
  mitraillette: {
    w: 92,
    d: [
      "M4 11 H24 V13.5 H7 V19.5 H24 V22 H4 Z",
      "M1 9 H5 V25 Q5 26 4 26 H1 Z",
      "M24 9 H66 V20 H24 Z",
      "M26 6 H31 V9 H26 Z",
      "M62 5.5 H66 V9 H62 Z",
      "M52 10 H74 Q76 10 76 12 V20 Q76 22 74 22 H52 Z",
      "M76 13 H86 V17 H76 Z",
      "M84 12 H89 V18 H84 Z",
      "M30 20 H39 L36 33 Q35.5 35 33.5 35 H29.5 Q27.5 35 28 33 Z",
      "M39 20 H47 Q47 25.5 43 25.5 H39 Z M40.5 20 H45.3 Q45.3 23.8 43 23.8 H40.5 Z",
      "M50 20 H57 L59 37 H52 Z",
    ],
  },
  fusil: {
    w: 126,
    d: [
      "M2 11 L26 12 V21 L8 27 Q4 28 2 28 Z",
      "M26 10 H66 V21 H26 Z",
      "M30 8 H42 V10 H30 Z",
      "M66 11 H92 Q94 11 94 13 V18 Q94 20 92 20 H66 Z",
      "M66 8.5 H96 V11 H66 Z",
      "M96 6 H99.5 V15 H96 Z",
      "M94 13 H116 V16 H94 Z",
      "M113 11.5 H123 V17.5 H113 Z",
      "M35 21 H43 L40 34 Q39.5 36 37.5 36 H33.5 Q31.5 36 32 34 Z",
      "M43 21 H51 Q51 26.5 47 26.5 H43 Z M44.5 21 H49.3 Q49.3 24.8 47 24.8 H44.5 Z",
      "M53 21 H61 Q62.5 30 67.5 36.5 L59.5 39.5 Q54.5 31 53 21 Z",
    ],
  },
  rafale: {
    w: 112,
    d: [
      "M3 10 H74 V21 H44 L41 25 H14 L6 27 Q3 27 3 25 Z",
      "M1 10 H4 V27 H1 Z",
      "M30 5 H58 V7.5 H55 V10 H33 V7.5 H30 Z",
      "M28 4 H33 V8 H28 Z",
      "M55 4 H60 V8 H55 Z",
      "M74 11 H88 Q90 11 90 13 V19 Q90 21 88 21 H74 Z",
      "M90 13.5 H102 V16.5 H90 Z",
      "M99 12 H108 V18 H99 Z",
      "M54 21 H62 L59 34 Q58.5 36 56.5 36 H52.5 Q50.5 36 51 34 Z",
      "M62 21 H72 Q72 27 67 27 H62 Z M63.5 21 H70.3 Q70.3 25.3 67 25.3 H63.5 Z",
      "M30 21 H38 L39.5 36 H31.5 Z",
    ],
  },
  carabine: {
    w: 130,
    d: [
      "M2 10 L30 12 V21 L10 26 H2 Z",
      "M10 8.5 H26 V12 H10 Z",
      "M30 11 H72 V21 H30 Z",
      "M36 4.5 H64 V8 H36 Z",
      "M31 3 H38 V9.5 H31 Z",
      "M60 2 H70 Q71 2 71 3 V9.5 H60 Z",
      "M47 2 H52 V4.5 H47 Z",
      "M40 8 H44 V11 H40 Z",
      "M56 8 H60 V11 H56 Z",
      "M72 12 H100 Q102 12 102 14 V18 Q102 20 100 20 H72 Z",
      "M102 14 H122 V16.5 H102 Z",
      "M119 12.5 H127 V18 H119 Z",
      "M40 21 H48 L45 34 Q44.5 36 42.5 36 H38.5 Q36.5 36 37 34 Z",
      "M48 21 H56 Q56 26.5 52 26.5 H48 Z M49.5 21 H54.3 Q54.3 24.8 52 24.8 H49.5 Z",
      "M58 21 H66 V32 Q66 33 65 33 H59 Q58 33 58 32 Z",
    ],
  },
  sniper: {
    w: 156,
    d: [
      "M2 9 Q8 9 14 11 L46 13 V22 H40 L34 31 Q33 33 30.5 33 H27 Q25 33 25.5 31 L28 23 H16 L4 29 Q2 29.5 2 27 Z",
      "M14 8 H32 V12 L14 11 Z",
      "M46 12 H84 V21 H46 Z",
      "M50 20 H54 L52 25.5 Q51.5 27.5 49.5 27.5 Q47.5 27.5 48 25.5 Z",
      "M66 21 H76 V27 H66 Z",
      "M38 22 H46 Q46 27 42 27 H38 Z M39.5 22 H44.3 Q44.3 25.3 42 25.3 H39.5 Z",
      "M54 5 H96 V9.5 H54 Z",
      "M48 3.5 H56 V10.5 H48 Z",
      "M92 1.5 H104 Q105 1.5 105 2.5 V10.5 H92 Z",
      "M70 2 H76 V5 H70 Z",
      "M60 9.5 H64 V12 H60 Z",
      "M84 9.5 H88 V12 H84 Z",
      "M84 13 H112 Q114 13 114 15 V19 Q114 21 112 21 H84 Z",
      "M114 14.5 H144 V17 H114 Z",
      "M140 12.5 H152 V19 H140 Z",
      "M104 21 H107 L100 37 H97 Z",
      "M107 21 H110 L116 37 H113 Z",
    ],
  },
  mitrailleuse: {
    w: 142,
    d: [
      "M2 11 L28 12 V23 L8 28 Q4 29 2 29 Z",
      "M28 9 H76 V22 H28 Z",
      "M34 6 H68 V9 H34 Z",
      "M82 4 H98 V11 H95 V7 H85 V11 H82 Z",
      "M76 11 H114 V19 H76 Z M80 13.5 H83 V16.5 H80 Z M86 13.5 H89 V16.5 H86 Z M92 13.5 H95 V16.5 H92 Z M98 13.5 H101 V16.5 H98 Z M104 13.5 H107 V16.5 H104 Z",
      "M114 13.5 H134 V16.5 H114 Z",
      "M130 12 H139 V18 H130 Z",
      "M36 22 H44 L41 35 Q40.5 37 38.5 37 H34.5 Q32.5 37 33 35 Z",
      "M44 22 H52 Q52 27.5 48 27.5 H44 Z M45.5 22 H50.3 Q50.3 25.8 48 25.8 H45.5 Z",
      "M54 22 H74 V35 Q74 38 71 38 H57 Q54 38 54 35 Z",
      "M106 19 H109 L101 37 H98 Z",
      "M109 19 H112 L119 37 H116 Z",
    ],
  },
  pompe: {
    w: 130,
    d: [
      "M2 11 L30 12 V20 L22 21 L8 28 Q4 29 2 29 Z",
      "M30 10 H58 V20 H30 Z",
      "M58 10 H124 V13.5 H58 Z",
      "M120 8.5 H122.5 V10 H120 Z",
      "M58 14.5 H114 V18.5 H58 Z",
      "M112 14 H116 V19 H112 Z",
      "M70 13.5 H96 Q98 13.5 98 15.5 V19.5 Q98 21.5 96 21.5 H70 Q68 21.5 68 19.5 V15.5 Q68 13.5 70 13.5 Z M73 15.5 H74 V19.5 H73 Z M77 15.5 H78 V19.5 H77 Z M81 15.5 H82 V19.5 H81 Z M85 15.5 H86 V19.5 H85 Z M89 15.5 H90 V19.5 H89 Z M93 15.5 H94 V19.5 H93 Z",
      "M36 20 H46 Q46 25.5 41 25.5 H36 Z M37.5 20 H44.3 Q44.3 23.8 41 23.8 H37.5 Z",
    ],
  },
  double: {
    w: 126,
    d: [
      "M2 14 Q12 12.5 32 12 V20 Q24 21 16 25 L5 30 Q2 30.5 2 28 Z",
      "M32 11 H46 V21 Q46 22 45 22 H33 Q32 22 32 21 Z",
      "M37 9 L40 11 H37 Z",
      "M41 9 L44 11 H41 Z",
      "M46 10 H120 V13.4 H46 Z",
      "M46 14.2 H120 V17.6 H46 Z",
      "M117 8.5 H119.5 V10 H117 Z",
      "M52 17.6 H84 Q86 17.6 86 19.5 V20.5 Q86 22 84 22 H54 Q52 22 52 20.5 Z",
      "M34 22 H44 Q44 27.5 39 27.5 H34 Z M35.5 22 H42.3 Q42.3 25.8 39 25.8 H35.5 Z",
    ],
  },
  arbalete: {
    w: 112,
    d: [
      "M2 13 H42 V21 L28 22 L10 28 H2 Z",
      "M30 21 H38 L35 34 Q34.5 36 32.5 36 H28.5 Q26.5 36 27 34 Z",
      "M38 21 H45 Q45 26 42 26 H38 Z M39.5 21 H43.5 Q43.5 24.4 42 24.4 H39.5 Z",
      "M42 14 H98 V19 H42 Z",
      "M50 8 H68 V11 H50 Z",
      "M54 11 H57 V14 H54 Z",
      "M62 11 H65 V14 H62 Z",
      "M90 12 H97 V21 H90 Z",
      "M92 13 Q97 7 94 1 L96.5 0.5 Q100.5 8 95.5 14 Z",
      "M92 20 Q97 26 94 33 L96.5 33.5 Q100.5 26 95.5 19 Z",
      "M52 12.5 H104 V14 H52 Z",
      "M104 11.2 L110 13.25 L104 15.3 Z",
      "M52 10.5 L57 12.5 H52 Z",
      "M98 19 H105 Q106.5 19 106.5 20.5 V27 Q106.5 28.5 105 28.5 H98 Z M99.8 20.8 H104.7 V26.7 H99.8 Z",
    ],
    s: ["M95 1.5 L55 16.5 L95 32.5"],
  },
  roquettes: {
    w: 136,
    d: [
      "M12 10 H112 V20 H12 Z",
      "M2 8 L12 10 V20 L2 22 Z",
      "M112 11 H116 Q124 11 132 15 Q124 19 116 19 H112 Z",
      "M58 5 H70 V10 H58 Z M61 6.5 H67 V8.5 H61 Z",
      "M54 20 H62 L59 33 Q58.5 35 56.5 35 H52.5 Q50.5 35 51 33 Z",
      "M62 20 H69 Q69 25 65.5 25 H62 Z M63.5 20 H67.5 Q67.5 23.4 65.5 23.4 H63.5 Z",
      "M80 20 H87 L86 31 Q85.8 33 83.8 33 H81 Q79 33 79 31 Z",
      "M26 20 H42 V24 Q42 25 41 25 H27 Q26 25 26 24 Z",
      "M20 9.5 H23 V20.5 H20 Z",
      "M100 9.5 H103 V20.5 H100 Z",
    ],
  },
  // « poings » : l'identifiant historique du couteau (voir duelWeapons).
  poings: {
    w: 78,
    d: [
      "M2 16.5 H5 V23.5 H2 Q1 23.5 1 22.5 V17.5 Q1 16.5 2 16.5 Z",
      "M5 16.5 Q16 15 28 16 V24 Q16 25 5 23.5 Z",
      "M28 12 H31.5 V28 H28 Z",
      "M31.5 15.5 H62 L76 19 Q68 24.5 56 24.5 H31.5 Z M36 18.2 H56 V19.6 H36 Z",
    ],
  },
  karambit: {
    w: 64,
    d: [
      "M2 20 A7 7 0 1 0 16 20 A7 7 0 1 0 2 20 Z M5 20 A4 4 0 1 1 13 20 A4 4 0 1 1 5 20 Z",
      "M14 16 H34 Q37 16 37 19 V22 Q37 25 34 25 H14 Z",
      "M36 16.5 Q50 13 60 26 Q61 28.5 59 28 Q50 20 36 24 Z",
    ],
  },
  grenade: {
    w: 34,
    d: [
      "M6.5 25 A10.5 12 0 1 0 27.5 25 A10.5 12 0 1 0 6.5 25 Z M8 21 H26 V22 H8 Z M8 28 H26 V29 H8 Z",
      "M13 9 H21 V14 H13 Z",
      "M21 9 H24 Q28 10 28 14 V22 H26 V14 Q26 11.5 23 11.5 H21 Z",
      "M5 7 A4 4 0 1 0 13 7 A4 4 0 1 0 5 7 Z M6.6 7 A2.4 2.4 0 1 1 11.4 7 A2.4 2.4 0 1 1 6.6 7 Z",
      "M12 8.5 H14 V10 H12 Z",
    ],
  },
  fumigene: {
    w: 30,
    d: [
      "M6 12 H24 V36 Q24 38 22 38 H8 Q6 38 6 36 Z M8 20 H22 V21.5 H8 Z M8 30 H22 V31.5 H8 Z",
      "M9 7 H21 V12 H9 Z",
      "M21 7.5 H23 Q26.5 8.5 26.5 12 V26 H24.8 V12 Q24.8 10 22.5 10 H21 Z",
      "M3.5 5 A3.5 3.5 0 1 0 10.5 5 A3.5 3.5 0 1 0 3.5 5 Z M5 5 A2 2 0 1 1 9 5 A2 2 0 1 1 5 5 Z",
    ],
  },
  zone: {
    w: 40,
    d: [
      "M5 20 A15 15 0 1 0 35 20 A15 15 0 1 0 5 20 Z M9 20 A11 11 0 1 1 31 20 A11 11 0 1 1 9 20 Z",
      "M16.5 20 A3.5 3.5 0 1 0 23.5 20 A3.5 3.5 0 1 0 16.5 20 Z",
      "M20 10 L17 5.5 H23 Z",
      "M20 30 L17 34.5 H23 Z",
      "M10 20 L5.5 17 V23 Z",
      "M30 20 L34.5 17 V23 Z",
    ],
  },
  tete: {
    w: 40,
    d: [
      "M7 20 A13 13 0 1 0 33 20 A13 13 0 1 0 7 20 Z M9.2 20 A10.8 10.8 0 1 1 30.8 20 A10.8 10.8 0 1 1 9.2 20 Z",
      "M19 1 H21 V8 H19 Z",
      "M19 32 H21 V39 H19 Z",
      "M1 19 H8 V21 H1 Z",
      "M32 19 H39 V21 H32 Z",
      "M15 16.5 A5 5 0 1 0 25 16.5 A5 5 0 1 0 15 16.5 Z",
      "M12.5 29 Q13 22.5 20 22.5 Q27 22.5 27.5 29 Z",
    ],
  },
  vie: {
    w: 40,
    d: ["M15 5 H25 V15 H35 V25 H25 V35 H15 V25 H5 V15 H15 Z"],
  },
  armure: {
    w: 40,
    d: ["M20 3 L34 8 V18 Q34 30 20 37 Q6 30 6 18 V8 Z M20 7.5 L30 11 V18 Q30 27 20 32.5 Z"],
  },
  viseur: {
    w: 40,
    d: [
      "M7 20 A13 13 0 1 0 33 20 A13 13 0 1 0 7 20 Z M9.2 20 A10.8 10.8 0 1 1 30.8 20 A10.8 10.8 0 1 1 9.2 20 Z",
      "M19 2 H21 V14 H19 Z",
      "M19 26 H21 V38 H19 Z",
      "M2 19 H14 V21 H2 Z",
      "M26 19 H38 V21 H26 Z",
      "M18.5 20 A1.5 1.5 0 1 0 21.5 20 A1.5 1.5 0 1 0 18.5 20 Z",
    ],
  },
  balle: {
    w: 24,
    d: ["M6 15 Q6 6 12 2 Q18 6 18 15 Z", "M5 16.5 H19 V34 H5 Z", "M4 35 H20 V38 H4 Z"],
  },
  materiaux: {
    w: 40,
    d: ["M3 7 H37 V14 H3 Z M9 10 H11 V11 H9 Z", "M3 16.5 H37 V23.5 H3 Z", "M3 26 H37 V33 H3 Z M29 29 H31 V30 H29 Z"],
  },
  parachute: {
    w: 40,
    d: [
      "M3 17 Q20 1 37 17 Q32 14 27.7 17 Q24 14 20 17 Q16 14 12.3 17 Q8 14 3 17 Z",
      "M17 30 H23 V38 H17 Z",
    ],
    s: ["M4 17 L18 31 M20 17 V30 M36 17 L22 31"],
  },
};

/** Largeur d'une icone rendue a la hauteur `height` (pixels). */
export function hudIconWidth(id: HudIconId, height: number): number {
  return (ICONS[id].w * height) / 40;
}

/** Une silhouette pleine, a la couleur du texte autour (`currentColor`). */
export function HudIcon({
  id,
  height = 20,
  className = "",
  title,
}: {
  id: HudIconId;
  height?: number;
  className?: string;
  /** Texte lu par les lecteurs d'ecran ; absent, l'icone est decorative. */
  title?: string;
}) {
  const shape = ICONS[id] ?? ICONS.poings;
  return (
    <svg
      viewBox={`0 0 ${shape.w} 40`}
      height={height}
      width={(shape.w * height) / 40}
      fill="currentColor"
      fillRule="evenodd"
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {shape.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {shape.s?.map((d, i) => (
        <path key={`s${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={1.1} />
      ))}
    </svg>
  );
}

/** L'icone d'une arme ; le couteau prend la forme du modele du casier. */
export function weaponIconId(weapon: WeaponId, knife?: KnifeId): HudIconId {
  if (weapon === "poings" && knife === "karambit") return "karambit";
  return weapon;
}
