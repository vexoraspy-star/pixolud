"use client";

import { useRef } from "react";
import {
  buildManor,
  roomAt,
  CLUE_SPOTS,
  CODE_LENGTH,
  DOLL_SPOTS,
  LOCKED_DOORS,
  LOCKED_RELIC_SPOT,
  PICKUP_SPOTS,
  SEALS,
  type KeyId,
} from "@/lib/manor";
import { NOISE_RADIUS, type NoiseKind } from "@/lib/manorNoise";
import { sightRange } from "@/lib/manorAI";
import { ITEM_DEFS, KEY_NAMES, type UsableItem } from "@/lib/manorInventory";

/**
 * Guide du Manoir Maudit : la fiche qu'on ouvre depuis un coin du lobby, ou
 * en pleine partie avec « ? » (ou H). Les chiffres viennent directement des
 * modules du jeu : si on change un rayon de bruit ou une cachette, le guide
 * ne ment pas.
 */

/** Meme echelle que la boussole du jeu (CELL_SIZE de HorrorScene) : une case = 1,7 m. */
const METERS_PER_CELL = 1.7;

const ACCENT = "#c08a3e";
const INK = "#f0dcae";
const ACT = "#a07a44";

function meters(cells: number): string {
  return `${(cells * METERS_PER_CELL).toFixed(1).replace(".", ",")} m`;
}

const NOISE_LABELS: Record<NoiseKind, string> = {
  accroupi: "Marcher accroupi",
  respiration: "Respirer dans une cachette, quand elle est tout près",
  lampe: "Allumer ou éteindre la lampe",
  ramassage: "Ramasser un objet",
  pas: "Marcher",
  armoire: "Entrer dans une armoire ou en sortir",
  sel: "Jeter du sel",
  porte: "Ouvrir une porte fermée à clé",
  haletement: "Être à bout de souffle",
  course: "Courir",
  piece: "Une pièce lancée qui retombe",
  "boite-a-musique": "Une boîte à musique posée",
  voix: "Parler au micro",
};

// La voix n'existe que dans les Backrooms : pas de ligne dans le guide du Manoir.
const NOISES = (Object.keys(NOISE_RADIUS) as NoiseKind[])
  .filter((kind) => kind !== "voix")
  .map((kind) => ({ kind, radius: NOISE_RADIUS[kind], label: NOISE_LABELS[kind] }))
  .sort((a, b) => a.radius - b.radius);
const LOUDEST = NOISES[NOISES.length - 1].radius;

const SIGHT = [
  { label: "Lampe allumée", cells: sightRange({ flashlightOn: true, crouched: false, behind: false }) },
  { label: "Lampe éteinte", cells: sightRange({ flashlightOn: false, crouched: false, behind: false }) },
  { label: "Lampe éteinte et accroupi", cells: sightRange({ flashlightOn: false, crouched: true, behind: false }) },
];

const ROOMS = buildManor().rooms;
const roomName = (x: number, y: number) => roomAt(ROOMS, x, y)?.name ?? "?";

const KEY_TRAIL = PICKUP_SPOTS.filter((s) => s.kind.startsWith("cle-")).map((s) => {
  const key = s.kind as KeyId;
  return {
    key,
    foundIn: roomName(s.x, s.y),
    opens: LOCKED_DOORS.find((d) => d.key === key)?.label ?? "?",
  };
});

const CONTROLS: { action: string; keys: string[][]; touch: string }[] = [
  { action: "Se déplacer", keys: [["Z", "Q", "S", "D"], ["flèches"]], touch: "Croix à gauche" },
  { action: "Regarder", keys: [["souris"]], touch: "Glisser le doigt" },
  { action: "Courir", keys: [["Maj"]], touch: "🏃 maintenu" },
  { action: "S'accroupir", keys: [["C"]], touch: "🧎" },
  { action: "Lampe", keys: [["F"]], touch: "🔦" },
  { action: "Ramasser, ouvrir, se cacher", keys: [["E"]], touch: "E" },
  { action: "Choisir un objet", keys: [["1"], ["…"], ["5"], ["molette"]], touch: "Toucher la case" },
  { action: "Utiliser l'objet en main", keys: [["clic"], ["G"]], touch: "✋" },
  { action: "Tes poches : objets, clés, pages", keys: [["Tab"]], touch: "🎒" },
  { action: "Retenir ton souffle (caché)", keys: [["Espace"]], touch: "🤐 maintenu" },
  { action: "Ouvrir ce guide", keys: [["H"]], touch: "?" },
];

const ACTS: { act: string; title: string; text: string }[] = [
  {
    act: "Acte I",
    title: "Les plaques gravées",
    text: `${CODE_LENGTH} chiffres sont gravés sur des plaques dans le manoir. Approche-toi d'une plaque : le chiffre est noté tout seul dans ton carnet.`,
  },
  {
    act: "Acte II",
    title: "La serrure à code",
    text: "Compose les chiffres, dans l'ordre, sur la porte noire de la cave (E devant la porte).",
  },
  {
    act: "Acte III",
    title: "Les cinq reliques",
    text: "Elles sont réparties dans le manoir, jamais dans la cave. L'une est derrière une porte fermée à clé. Chaque relique la rend plus rapide et éteint une bougie. Quand tu les as toutes, dépose-les sur l'autel de la cave.",
  },
  {
    act: "Acte IV",
    title: "Le rituel",
    text: "Quelques secondes où les reliques s'élèvent. Elle t'attend sur le seuil, sans bouger.",
  },
  {
    act: "Acte V",
    title: "Les trois sceaux",
    text: "Une trappe apparaît au fond de la cave, scellée. Trois sceaux lumineux se brisent quand tu les touches. Elle te chasse et sait où tu es — sauf si tu te caches.",
  },
  {
    act: "Acte VI",
    title: "Quarante-cinq secondes",
    text: "La trappe s'ouvre lentement. Tiens 45 secondes sans te faire attraper. On ne peut plus se cacher. Dans les dernières secondes, la boussole montre la trappe.",
  },
  {
    act: "Acte VII",
    title: "Elle est derrière toi",
    text: "La trappe est ouverte : cours-y. Elle est plus rapide que toi.",
  },
];

const SECTIONS = [
  { id: "but", label: "Le but" },
  { id: "commandes", label: "Commandes" },
  { id: "deroule", label: "Déroulé" },
  { id: "elle", label: "Elle" },
  { id: "cachettes", label: "Se cacher" },
  { id: "objets", label: "Objets" },
  { id: "bloque", label: "Bloqué ?" },
  { id: "problemes", label: "Problèmes" },
];

function Kbd({ children }: { children: string }) {
  const long = children.length > 2;
  return (
    <kbd
      className={`inline-flex h-6 items-center justify-center font-mono text-[0.7rem] font-semibold ${
        long ? "px-1.5" : "w-6"
      }`}
      style={{
        color: INK,
        background: "#1a1310",
        border: "1px solid #3a2e24",
        borderBottomWidth: 2,
        borderRadius: 3,
      }}
    >
      {children}
    </kbd>
  );
}

function SectionTitle({ id, eyebrow, children }: { id: string; eyebrow: string; children: string }) {
  return (
    <header id={id} className="scroll-mt-3">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.3em]" style={{ color: ACT }}>
        {eyebrow}
      </p>
      <h3 className="mt-1 font-serif text-xl leading-tight text-balance sm:text-2xl" style={{ color: INK }}>
        {children}
      </h3>
    </header>
  );
}

export default function HorrorGuide({ onClose, inGame = false }: { onClose: () => void; inGame?: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  function jump(id: string) {
    const body = bodyRef.current;
    const target = body?.querySelector<HTMLElement>(`#${id}`);
    if (!body || !target) return;
    // Defilement du seul panneau : scrollIntoView ferait bouger tout le jeu derriere.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    body.scrollTo({ top: target.offsetTop - 12, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div
      className="absolute inset-0 z-[60] flex items-stretch justify-center bg-black/80 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Guide du Manoir Maudit"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden text-zinc-300"
        style={{
          background: "linear-gradient(160deg, rgba(20,14,11,0.98), rgba(7,5,4,0.98))",
          borderLeft: `2px solid ${ACCENT}`,
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.85), 0 0 40px rgba(192,138,62,0.12)",
        }}
      >
        {/* En-tete fixe : titre, fermeture, sommaire */}
        <div className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.62rem] font-black uppercase tracking-[0.35em]" style={{ color: ACT }}>
                Le Manoir Maudit
              </p>
              <h2 className="mt-1 font-serif text-2xl leading-none sm:text-3xl" style={{ color: INK }}>
                Guide du manoir
              </h2>
              {inGame && (
                <p className="mt-1.5 text-xs italic text-zinc-500">
                  La partie est en pause pendant que tu lis.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: ACCENT }}
            >
              {inGame ? "Reprendre (H)" : "Fermer"}
            </button>
          </div>
          <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-0.5" aria-label="Sommaire du guide">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="shrink-0 whitespace-nowrap px-2.5 py-1 text-xs font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 focus-visible:outline focus-visible:outline-1"
                style={{ outlineColor: ACCENT }}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-10 pb-10">
            {/* --- Le but --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="but" eyebrow="En deux mots">
                Sortir vivant du manoir
              </SectionTitle>
              <p className="max-w-[65ch] text-sm leading-relaxed">
                Tu es enfermé dans un manoir de {ROOMS.length} pièces sur deux étages. Relève le code
                gravé dans les murs, ouvre la cave, rassemble cinq reliques et accomplis le rituel.
                Il faudra ensuite briser trois sceaux, tenir quarante-cinq secondes et fuir par la
                trappe.
              </p>
              <p className="max-w-[65ch] text-sm leading-relaxed">
                Quelque chose vit ici. <span className="text-red-300">Elle ne sait pas où tu es : elle t&apos;entend.</span>{" "}
                Chaque bruit que tu fais peut l&apos;attirer.
              </p>
              <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                {[
                  ["Joueurs", "Solo"],
                  ["Durée", "20 à 35 min"],
                  ["Matériel", "Clavier et souris conseillés"],
                  ["Son", "Casque recommandé"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-600">{k}</dt>
                    <dd className="mt-0.5 text-zinc-200">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="max-w-[65ch] text-xs leading-relaxed text-zinc-500">
                Le son est placé à gauche ou à droite : avec un casque, tu entends de quel côté elle
                marche. « Histoire » lance une cinématique avant la partie, « Partie rapide » te met
                directement dans le manoir.
              </p>
            </section>

            {/* --- Commandes --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="commandes" eyebrow="Au clavier et au doigt">
                Commandes
              </SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[0.6rem] uppercase tracking-[0.2em] text-zinc-600">
                      <th className="pb-2 pr-4 font-bold">Action</th>
                      <th className="pb-2 pr-4 font-bold">Clavier</th>
                      <th className="pb-2 font-bold">Tactile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONTROLS.map((c) => (
                      <tr key={c.action} className="border-t border-white/[0.06]">
                        <td className="py-2 pr-4 text-zinc-200">{c.action}</td>
                        <td className="py-2 pr-4">
                          <span className="flex flex-wrap items-center gap-1">
                            {c.keys.map((group, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && <span className="px-0.5 text-[0.65rem] text-zinc-600">ou</span>}
                                {group.map((k) => (
                                  <Kbd key={k}>{k}</Kbd>
                                ))}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-zinc-400">{c.touch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="max-w-[65ch] text-xs leading-relaxed text-zinc-500">
                Clique dans l&apos;image pour que la souris tourne la vue, <Kbd>Échap</Kbd> pour la
                libérer. Clavier QWERTY, sensibilité, luminosité et plein écran : roue dentée en haut à
                droite.
              </p>
            </section>

            {/* --- Deroule --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="deroule" eyebrow="Sept actes">
                Le déroulé d&apos;une partie
              </SectionTitle>
              <ol className="flex flex-col">
                {ACTS.map((a, i) => (
                  <li key={a.act} className="grid grid-cols-[4.5rem_1fr] gap-3">
                    <div className="relative flex justify-end pt-0.5">
                      <span
                        className="font-serif text-xs font-bold uppercase tracking-wider"
                        style={{ color: i >= 4 ? "#f87171" : ACT }}
                      >
                        {a.act}
                      </span>
                    </div>
                    <div
                      className="border-l pb-5 pl-4"
                      style={{ borderColor: i >= 4 ? "rgba(248,113,113,0.35)" : "rgba(192,138,62,0.3)" }}
                    >
                      <p className="font-serif text-base leading-tight" style={{ color: INK }}>
                        {a.title}
                      </p>
                      <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-zinc-400">{a.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="max-w-[65ch] text-xs leading-relaxed text-zinc-500">
                Elle se réveille quand tu prends la première relique — ou si tu traînes plus d&apos;une
                minute et quart. Quête facultative : cinq poupées de porcelaine sont cachées. Les
                trouver toutes te rend 10 % plus rapide et te protège une fois d&apos;une capture.
              </p>
            </section>

            {/* --- Elle --- */}
            <section className="flex flex-col gap-4">
              <SectionTitle id="elle" eyebrow="Ce qu'elle perçoit">
                Elle t&apos;entend, et elle voit
              </SectionTitle>
              <p className="max-w-[65ch] text-sm leading-relaxed">
                Elle patrouille. Quand elle entend un bruit, elle va voir d&apos;où il vient et fouille
                les alentours. Quand elle te voit, elle te poursuit. Si elle te perd de vue, elle
                cherche là où tu étais, puis repart. Chaque mur entre vous réduit la portée d&apos;un
                bruit d&apos;environ 40 %.
              </p>

              <div>
                <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Jusqu&apos;où elle entend, sans mur
                </p>
                <ul className="flex flex-col gap-1.5">
                  {NOISES.map((n) => {
                    const loud = n.radius >= 7;
                    const soft = n.radius < 3;
                    return (
                      <li key={n.kind} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_3.6rem] items-center gap-3 text-xs">
                        <span className="text-zinc-300">{n.label}</span>
                        <span className="h-1.5 bg-white/[0.06]">
                          <span
                            className="block h-full"
                            style={{
                              width: `${(n.radius / LOUDEST) * 100}%`,
                              background: loud ? "#dc2626" : soft ? "#78716c" : ACCENT,
                            }}
                          />
                        </span>
                        <span className="text-right font-mono tabular-nums text-zinc-400">{meters(n.radius)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  Jusqu&apos;où elle te voit
                </p>
                <ul className="flex flex-col gap-1.5">
                  {SIGHT.map((s) => (
                    <li key={s.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_3.6rem] items-center gap-3 text-xs">
                      <span className="text-zinc-300">{s.label}</span>
                      <span className="h-1.5 bg-white/[0.06]">
                        <span className="block h-full" style={{ width: `${(s.cells / SIGHT[0].cells) * 100}%`, background: "#a8a29e" }} />
                      </span>
                      <span className="text-right font-mono tabular-nums text-zinc-400">{meters(s.cells)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 max-w-[65ch] text-xs leading-relaxed text-zinc-500">
                  Dans son dos, elle voit moitié moins loin. Tout contre elle, elle te sent quoi que tu
                  fasses. Avec quatre ou cinq reliques volées, elle court plus vite que toi quand tu
                  marches : coupe ta lampe, casse sa ligne de vue, cache-toi.
                </p>
              </div>
            </section>

            {/* --- Cachettes --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="cachettes" eyebrow="Armoires et lits">
                Se cacher
              </SectionTitle>
              <ul className="flex max-w-[65ch] flex-col gap-2 text-sm leading-relaxed">
                <li>
                  <span style={{ color: INK }}>Où :</span> dans les armoires (tu regardes par la fente
                  entre les battants) et sous les lits. Approche-toi et appuie sur <Kbd>E</Kbd>.
                </li>
                <li>
                  <span style={{ color: INK }}>Ta respiration :</span> quand elle rôde tout près, elle
                  peut t&apos;entendre respirer. Maintiens <Kbd>Espace</Kbd> pour retenir ton souffle, six
                  secondes au plus. Si tu tiens trop longtemps, tu reprends ton souffle d&apos;un coup… et
                  ça s&apos;entend.
                </li>
                <li className="text-red-300">
                  Si elle t&apos;a vu entrer, la cachette ne sert à rien : elle vient t&apos;en sortir.
                  Sors et cours.
                </li>
                <li className="text-zinc-400">
                  On peut encore se cacher pendant les sceaux (Acte V), plus pendant les 45 secondes ni
                  pendant la fuite.
                </li>
              </ul>
            </section>

            {/* --- Objets --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="objets" eyebrow="Cinq emplacements">
                Objets, clés et pages
              </SectionTitle>
              <div className="flex flex-col divide-y divide-white/[0.06]">
                {(Object.keys(ITEM_DEFS) as UsableItem[]).map((id) => {
                  const item = ITEM_DEFS[id];
                  return (
                    <div key={id} className="grid grid-cols-[2rem_1fr] gap-3 py-2.5">
                      <span className="text-xl leading-none" aria-hidden="true">
                        {item.emoji}
                      </span>
                      <div>
                        <p className="text-sm text-zinc-100">
                          {item.name}{" "}
                          <span className="text-xs text-zinc-500">
                            · {item.verb.toLowerCase()} · jusqu&apos;à {item.stack} par emplacement
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[2rem_1fr] gap-3 py-2.5">
                  <span className="text-xl leading-none" aria-hidden="true">
                    🗝️
                  </span>
                  <div>
                    <p className="text-sm text-zinc-100">Clés</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {LOCKED_DOORS.length} portes sont fermées à clé, reconnaissables à leur cadenas doré.
                      Les clés ne prennent pas de place dans tes poches.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[2rem_1fr] gap-3 py-2.5">
                  <span className="text-xl leading-none" aria-hidden="true">
                    📜
                  </span>
                  <div>
                    <p className="text-sm text-zinc-100">Pages de journal</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      Elles racontent l&apos;histoire, et certaines disent où chercher. Tu peux les relire
                      dans tes poches (<Kbd>Tab</Kbd>).
                    </p>
                  </div>
                </div>
              </div>
              <p className="max-w-[65ch] text-xs leading-relaxed text-zinc-500">
                La lampe tient une minute et demie allumée et se recharge en 45 secondes éteinte. Tu
                peux courir environ quatre secondes d&apos;affilée ; à bout de souffle, tu halètes.
                Utiliser un objet : choisis-le avec <Kbd>1</Kbd>–<Kbd>5</Kbd> ou la molette, puis clic
                ou <Kbd>G</Kbd>.
              </p>
            </section>

            {/* --- Bloque ? (spoilers) --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="bloque" eyebrow="Attention, ça dévoile tout">
                Tu es bloqué ?
              </SectionTitle>
              <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-400">
                Ouvre seulement la partie qui te manque.
              </p>
              <div className="flex flex-col gap-2">
                {[
                  {
                    q: "Où sont les plaques du code ?",
                    a: `${CLUE_SPOTS.map((c) => c.room).join(", ")}. Le chiffre de chaque plaque va à sa position dans le code, dans cet ordre.`,
                  },
                  {
                    q: "Quelle clé ouvre quelle porte ?",
                    a: KEY_TRAIL.map((k) => `${KEY_NAMES[k.key].name} : dans la pièce « ${k.foundIn} », ouvre « ${k.opens} ».`).join(" "),
                  },
                  {
                    q: "Il me manque une relique",
                    a: `L'une d'elles est toujours dans la ${LOCKED_RELIC_SPOT.room}, fermée à clé. Les autres changent de place à chaque partie, jamais dans la cave ni derrière une autre porte fermée.`,
                  },
                  {
                    q: "Où sont les trois sceaux ?",
                    a: `${SEALS.map((s) => s.room).join(", ")}. La boussole sous le viseur montre le plus proche.`,
                  },
                  {
                    q: "Où sont les poupées ?",
                    a: `${DOLL_SPOTS.map((d) => d.room).join(", ")}. Celle du Bureau du docteur est derrière deux portes fermées à clé.`,
                  },
                ].map((item) => (
                  <details key={item.q} className="group border border-white/[0.08] bg-black/30 open:border-[#c08a3e]/40">
                    <summary
                      className="cursor-pointer list-none px-3 py-2 text-sm text-zinc-200 focus-visible:outline focus-visible:outline-1 [&::-webkit-details-marker]:hidden"
                      style={{ outlineColor: ACCENT }}
                    >
                      <span className="mr-2 inline-block text-xs transition group-open:rotate-90" style={{ color: ACCENT }}>
                        ▸
                      </span>
                      {item.q}
                    </summary>
                    <p className="max-w-[65ch] px-3 pb-3 pl-8 text-sm leading-relaxed text-zinc-400">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>

            {/* --- Problemes --- */}
            <section className="flex flex-col gap-3">
              <SectionTitle id="problemes" eyebrow="Si quelque chose cloche">
                Problèmes courants
              </SectionTitle>
              <dl className="flex max-w-[65ch] flex-col gap-3 text-sm">
                {[
                  [
                    "Le jeu s'est mis en pause",
                    "Il se met en pause dès que tu changes d'onglet, pour qu'elle ne t'attrape pas pendant ce temps. Reviens sur l'onglet, ou clique sur « Reprendre ».",
                  ],
                  [
                    "La souris ne tourne plus la vue",
                    "Clique dans l'image pour la capturer à nouveau.",
                  ],
                  [
                    "Écran « L'image s'est éteinte »",
                    "Le navigateur a repris la carte graphique (veille, trop d'onglets 3D). Attends quelques secondes ; sinon recharge la page — la partie recommence.",
                  ],
                  [
                    "Trop sombre, ou mauvais clavier",
                    "Roue dentée en haut à droite : luminosité, AZERTY ou QWERTY, sensibilité de la souris.",
                  ],
                  [
                    "Ça saccade",
                    "Le jeu baisse sa résolution tout seul quand l'ordinateur peine. Ferme les autres onglets et le plein écran si besoin.",
                  ],
                  [
                    "J'ai quitté la page",
                    "Les parties ne sont pas sauvegardées : il faut recommencer, et le code de la cave change à chaque tentative.",
                  ],
                ].map(([problem, fix]) => (
                  <div key={problem}>
                    <dt className="text-zinc-100">{problem}</dt>
                    <dd className="mt-0.5 leading-relaxed text-zinc-400">{fix}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
