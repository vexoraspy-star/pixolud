import type { Articulation, Squelette } from "./colossesModeles";
import type { Colosse, CoupId } from "./colosses";

/**
 * Les animations de Colosses.
 *
 * Une animation, ici, c'est une suite de POSES CLES (la garde, l'armement du
 * coup, l'impact, le retour) entre lesquelles le corps glisse tout seul. On
 * ne pilote jamais un membre directement : on dit « vise cette pose », et
 * chaque articulation la rejoint a sa vitesse. C'est ce qui donne des gestes
 * qui ont du poids — un direct part vite et revient plus lentement, une
 * chute s'amortit — au lieu de positions qui sautent d'une image a l'autre.
 *
 * Reperes (dans l'espace du personnage, qui regarde vers +Z) :
 * - epaule / hanche en X negatif : le membre part vers l'avant ;
 * - coude en X negatif : l'avant-bras se replie vers le haut ;
 * - genou en X positif : la jambe se plie vers l'arriere ;
 * - torse en X positif : penche vers l'avant ; en Y negatif : l'epaule
 *   droite avance (c'est la rotation du buste sur un direct).
 */

type Angles = [number, number, number];

export interface Pose {
  angles: Partial<Record<Articulation, Angles>>;
  /** Decalage vertical du bassin (negatif = on plie les genoux). */
  bassin: number;
  /** Bascule du corps entier en arriere (K.O.), en radians. */
  chute: number;
}

export type EtatAnim =
  | "garde"
  | "marche"
  | "recul"
  | "saut"
  | "accroupi"
  | "bloc"
  | "coup"
  | "touche"
  | "ko"
  | "victoire";

export interface ContexteAnim {
  etat: EtatAnim;
  /** Horloge de la partie : sert a la respiration et aux cycles de marche. */
  temps: number;
  /** Pour un coup : lequel, et ou on en est (0 = depart, 1 = fin). */
  coup?: CoupId;
  progression?: number;
  /** Bornes des phases du coup, en fraction de sa duree totale. */
  finPreparation?: number;
  finActif?: number;
  perso: Colosse;
}

const pose = (angles: Pose["angles"], bassin = 0, chute = 0): Pose => ({ angles, bassin, chute });

/** Melange lineaire de deux poses : t = 0 donne a, t = 1 donne b. */
function melanger(a: Pose, b: Pose, t: number): Pose {
  const angles: Pose["angles"] = {};
  const cles = new Set([...Object.keys(a.angles), ...Object.keys(b.angles)]) as Set<Articulation>;
  for (const cle of cles) {
    const x = a.angles[cle] ?? [0, 0, 0];
    const y = b.angles[cle] ?? [0, 0, 0];
    angles[cle] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  }
  return { angles, bassin: a.bassin + (b.bassin - a.bassin) * t, chute: a.chute + (b.chute - a.chute) * t };
}

/** Une courbe douce : demarre et arrive sans a-coup. */
const doux = (t: number) => t * t * (3 - 2 * t);

// ------------------------------------------------------------ les postures

/**
 * La garde : de profil, genoux flechis, poings a hauteur du visage. Le corps
 * respire — un personnage parfaitement immobile a l'air d'une statue.
 */
function garde(temps: number): Pose {
  const souffle = Math.sin(temps * 2.4);
  return pose(
    {
      torse: [0.1 + souffle * 0.02, -0.28, 0],
      cou: [-0.06, 0.28, 0],
      epauleD: [-0.85, 0, 0.12],
      coudeD: [-1.75 - souffle * 0.05, 0, 0],
      epauleG: [-1.2, 0, -0.08],
      coudeG: [-1.45, 0, 0],
      hancheD: [-0.32, 0, 0.05],
      genouD: [0.42, 0, 0],
      hancheG: [0.22, 0, -0.05],
      genouG: [0.34, 0, 0],
      cape: [0.12 + souffle * 0.04, 0, 0],
    },
    -0.07 + souffle * 0.015,
  );
}

/** La marche : les jambes alternent, les bras gardent la garde. */
function marche(temps: number, recule: boolean): Pose {
  const base = garde(temps);
  const phase = temps * (recule ? 8 : 10);
  const pas = Math.sin(phase);
  const amplitude = recule ? 0.34 : 0.48;
  const b = base.angles;
  return pose(
    {
      ...b,
      torse: [recule ? -0.02 : 0.16, -0.24, 0],
      hancheD: [-0.3 + pas * amplitude, 0, 0.05],
      hancheG: [0.2 - pas * amplitude, 0, -0.05],
      genouD: [0.35 + Math.max(0, pas) * 0.7, 0, 0],
      genouG: [0.3 + Math.max(0, -pas) * 0.7, 0, 0],
      cape: [0.3 + Math.abs(pas) * 0.15, 0, 0],
    },
    -0.07 + Math.abs(Math.cos(phase)) * 0.05,
  );
}

function saut(): Pose {
  return pose(
    {
      torse: [0.2, -0.2, 0],
      cou: [0.1, 0.2, 0],
      epauleD: [-1.1, 0, 0.3],
      coudeD: [-1.5, 0, 0],
      epauleG: [-1.3, 0, -0.3],
      coudeG: [-1.4, 0, 0],
      hancheD: [-1.25, 0, 0],
      genouD: [1.6, 0, 0],
      hancheG: [-0.7, 0, 0],
      genouG: [1.2, 0, 0],
      cape: [0.8, 0, 0],
    },
    0.05,
  );
}

function accroupi(temps: number): Pose {
  const souffle = Math.sin(temps * 2.4);
  return pose(
    {
      torse: [0.42, -0.25, 0],
      cou: [-0.3, 0.25, 0],
      epauleD: [-0.9, 0, 0.15],
      coudeD: [-1.8, 0, 0],
      epauleG: [-1.2, 0, -0.1],
      coudeG: [-1.6, 0, 0],
      hancheD: [-1.35, 0, 0.1],
      genouD: [2.05, 0, 0],
      hancheG: [-0.9, 0, -0.1],
      genouG: [2.1, 0, 0],
      cape: [0.5, 0, 0],
    },
    -0.44 + souffle * 0.01,
  );
}

/** La garde fermee : avant-bras croises devant le visage, menton rentre. */
function bloc(): Pose {
  return pose(
    {
      torse: [0.26, -0.1, 0],
      cou: [0.2, 0.1, 0],
      epauleD: [-1.55, 0, 0.4],
      coudeD: [-2.25, 0, 0],
      epauleG: [-1.6, 0, -0.4],
      coudeG: [-2.2, 0, 0],
      hancheD: [-0.4, 0, 0.05],
      genouD: [0.6, 0, 0],
      hancheG: [0.25, 0, -0.05],
      genouG: [0.55, 0, 0],
      cape: [0.1, 0, 0],
    },
    -0.14,
  );
}

/** Touche : la tete part en arriere, les bras s'ouvrent, le buste recule. */
function touche(): Pose {
  return pose(
    {
      torse: [-0.45, 0.1, 0],
      cou: [-0.6, 0, 0],
      epauleD: [0.25, 0, 0.5],
      coudeD: [-0.6, 0, 0],
      epauleG: [0.1, 0, -0.6],
      coudeG: [-0.5, 0, 0],
      hancheD: [-0.1, 0, 0],
      genouD: [0.3, 0, 0],
      hancheG: [0.3, 0, 0],
      genouG: [0.15, 0, 0],
      cape: [0.6, 0, 0],
    },
    -0.05,
  );
}

/** K.O. : le corps bascule en arriere et reste au sol, bras en croix. */
function ko(): Pose {
  return pose(
    {
      torse: [-0.3, 0, 0],
      cou: [-0.5, 0.4, 0],
      epauleD: [-0.2, 0, 1.3],
      coudeD: [-0.3, 0, 0],
      epauleG: [-0.1, 0, -1.2],
      coudeG: [-0.4, 0, 0],
      hancheD: [-0.4, 0, 0.2],
      genouD: [0.6, 0, 0],
      hancheG: [-0.1, 0, -0.1],
      genouG: [0.3, 0, 0],
      cape: [1.2, 0, 0],
    },
    -0.72,
    -1.45,
  );
}

/** La victoire : un poing au ciel, l'autre sur la hanche. */
function victoire(temps: number): Pose {
  const souffle = Math.sin(temps * 3);
  return pose(
    {
      torse: [-0.08, 0.2, 0],
      cou: [-0.25, 0, 0],
      epauleD: [-3.05 + souffle * 0.06, 0, 0.1],
      coudeD: [-0.25, 0, 0],
      epauleG: [0.15, 0, -0.45],
      coudeG: [-1.5, 0, 0],
      hancheD: [-0.1, 0, 0.12],
      genouD: [0.1, 0, 0],
      hancheG: [0.1, 0, -0.12],
      genouG: [0.1, 0, 0],
      cape: [0.2 + souffle * 0.05, 0, 0],
    },
    -0.02,
  );
}

// -------------------------------------------------------------- les coups

/**
 * Chaque coup = trois poses : armement, impact, et le retour en garde.
 * L'armement doit SE VOIR : c'est lui qui permet a l'adversaire de lever la
 * garde a temps, et qui rend un coup puissant « lisible ».
 */
function posesCoup(coup: CoupId, perso: Colosse, temps: number): { armement: Pose; impact: Pose } {
  const g = garde(temps);
  if (coup === "poing") {
    return {
      armement: pose({ ...g.angles, torse: [0.08, 0.18, 0], epauleD: [-0.55, 0, 0.25], coudeD: [-2.1, 0, 0] }, -0.09),
      impact: pose(
        {
          ...g.angles,
          torse: [0.22, -0.62, 0],
          cou: [-0.02, 0.55, 0],
          epauleD: [-1.62, 0, 0.05],
          coudeD: [-0.06, 0, 0],
          epauleG: [-1.0, 0, -0.2],
          coudeG: [-1.9, 0, 0],
          hancheD: [-0.5, 0, 0.05],
          genouD: [0.55, 0, 0],
        },
        -0.11,
      ),
    };
  }
  if (coup === "pied") {
    return {
      armement: pose(
        {
          ...g.angles,
          torse: [-0.05, -0.2, 0],
          hancheD: [-1.3, 0, 0],
          genouD: [2.0, 0, 0],
          hancheG: [0.1, 0, 0],
          genouG: [0.4, 0, 0],
        },
        -0.02,
      ),
      impact: pose(
        {
          ...g.angles,
          torse: [-0.38, -0.15, 0],
          cou: [0.25, 0.2, 0],
          epauleD: [-0.4, 0, 0.9],
          coudeD: [-0.8, 0, 0],
          epauleG: [-0.6, 0, -0.9],
          coudeG: [-0.8, 0, 0],
          hancheD: [-1.6, 0, 0],
          genouD: [0.04, 0, 0],
          hancheG: [0.12, 0, 0],
          genouG: [0.3, 0, 0],
          cape: [0.6, 0, 0],
        },
        0,
      ),
    };
  }
  // Le coup special : une pose propre a chaque personnage.
  switch (perso.special) {
    case "uppercut":
      return {
        armement: pose({ ...g.angles, torse: [0.4, 0.1, 0], epauleD: [0.5, 0, 0.2], coudeD: [-1.9, 0, 0] }, -0.38),
        impact: pose(
          {
            ...g.angles,
            torse: [-0.25, -0.45, 0],
            cou: [-0.4, 0.3, 0],
            epauleD: [-2.95, 0, 0.05],
            coudeD: [-0.3, 0, 0],
            hancheD: [-0.2, 0, 0],
            genouD: [0.1, 0, 0],
            hancheG: [0.3, 0, 0],
            genouG: [0.6, 0, 0],
            cape: [0.9, 0, 0],
          },
          0.12,
        ),
      };
    case "charge":
      return {
        armement: pose({ ...g.angles, torse: [0.3, 0.3, 0], epauleD: [-0.3, 0, 0.5], coudeD: [-2.0, 0, 0] }, -0.2),
        impact: pose(
          {
            ...g.angles,
            torse: [0.62, -0.75, 0],
            cou: [0.3, 0.6, 0],
            epauleD: [-0.4, 0, 0.3],
            coudeD: [-2.2, 0, 0],
            epauleG: [-0.3, 0, -0.2],
            coudeG: [-2.1, 0, 0],
            hancheD: [-0.9, 0, 0],
            genouD: [0.9, 0, 0],
            hancheG: [0.6, 0, 0],
            genouG: [0.5, 0, 0],
          },
          -0.22,
        ),
      };
    case "onde":
      return {
        armement: pose(
          { ...g.angles, torse: [0.05, 0.4, 0], epauleD: [0.45, 0, 0.1], coudeD: [-1.7, 0, 0], epauleG: [0.4, 0, -0.1], coudeG: [-1.7, 0, 0] },
          -0.2,
        ),
        impact: pose(
          {
            ...g.angles,
            torse: [0.18, -0.1, 0],
            cou: [0, 0.1, 0],
            epauleD: [-1.58, 0, -0.05],
            coudeD: [-0.05, 0, 0],
            epauleG: [-1.58, 0, 0.05],
            coudeG: [-0.05, 0, 0],
            hancheD: [-0.55, 0, 0],
            genouD: [0.7, 0, 0],
          },
          -0.2,
        ),
      };
    case "tourbillon":
    default:
      return {
        armement: pose({ ...g.angles, torse: [0.1, 0.6, 0], epauleD: [-0.3, 0, 1.2], epauleG: [-0.3, 0, -1.2] }, -0.1),
        impact: pose(
          {
            ...g.angles,
            torse: [0.05, 0, 0],
            epauleD: [-0.1, 0, 1.52],
            coudeD: [-0.1, 0, 0],
            epauleG: [-0.1, 0, -1.52],
            coudeG: [-0.1, 0, 0],
            hancheD: [-0.4, 0, 0.3],
            genouD: [0.3, 0, 0],
            hancheG: [0.2, 0, -0.3],
            genouG: [0.3, 0, 0],
            cape: [1.3, 0, 0],
          },
          -0.05,
        ),
      };
  }
}

// ------------------------------------------------------------ l'ensemble

/** La pose a atteindre, selon ce que fait le personnage. */
export function poseCible(ctx: ContexteAnim): Pose {
  const { etat, temps, perso } = ctx;
  switch (etat) {
    case "marche":
      return marche(temps, false);
    case "recul":
      return marche(temps, true);
    case "saut":
      return saut();
    case "accroupi":
      return accroupi(temps);
    case "bloc":
      return bloc();
    case "touche":
      return touche();
    case "ko":
      return ko();
    case "victoire":
      return victoire(temps);
    case "coup": {
      const coup = ctx.coup ?? "poing";
      const p = ctx.progression ?? 0;
      const a = ctx.finPreparation ?? 0.3;
      const b = ctx.finActif ?? 0.55;
      const { armement, impact } = posesCoup(coup, perso, temps);
      const g = garde(temps);
      // Trois phases : on arme, on frappe, on revient en garde.
      if (p < a) return melanger(g, armement, doux(p / a));
      if (p < b) return melanger(armement, impact, doux((p - a) / (b - a)));
      return melanger(impact, g, doux((p - b) / (1 - b)));
    }
    case "garde":
    default:
      return garde(temps);
  }
}

/**
 * Vitesse a laquelle le corps rejoint la pose visee.
 *
 * Un coup doit etre VIF (sinon il a l'air mou), une chute doit etre franche,
 * et la garde peut etre plus paresseuse — c'est elle qui donne l'impression
 * de souplesse entre deux actions.
 */
export function vitessePose(etat: EtatAnim): number {
  switch (etat) {
    case "coup":
      return 30;
    case "touche":
      return 26;
    case "ko":
      return 7;
    case "saut":
    case "bloc":
      return 18;
    default:
      return 11;
  }
}

/** Fait glisser le squelette vers la pose visee, sans a-coup. */
export function appliquerPose(
  os: Squelette,
  cible: Pose,
  dt: number,
  vitesse: number,
  hauteurBassin: number,
): void {
  // Lissage exponentiel : independant de la cadence d'images.
  const f = 1 - Math.exp(-vitesse * dt);
  for (const [cle, angles] of Object.entries(cible.angles) as [Articulation, Angles][]) {
    const o = os[cle];
    if (!o || !angles) continue;
    o.rotation.x += (angles[0] - o.rotation.x) * f;
    o.rotation.y += (angles[1] - o.rotation.y) * f;
    o.rotation.z += (angles[2] - o.rotation.z) * f;
  }
  if (os.bassin) {
    const y = hauteurBassin + cible.bassin;
    os.bassin.position.y += (y - os.bassin.position.y) * f;
  }
  if (os.corps) {
    os.corps.rotation.x += (cible.chute - os.corps.rotation.x) * f;
  }
}
