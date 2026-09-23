import type { Metadata } from "next";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import { ScriptArtwork } from "@/components/ModeArtwork";
import ScriptDemo from "@/components/ScriptDemo";
import { getPublishedGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/server";
import { createDraft } from "@/app/editeur/actions";
import { API_DOC } from "@/lib/script";
import { TIERS, tierOf } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Game Script — programme ton propre jeu | Pixolud",
  description:
    "Écris ton jeu en quelques lignes de code, directement dans le navigateur : il tourne à côté de ton programme, et tu le publies quand il te plaît.",
};

/**
 * Le mode Game Script : sa page a lui.
 *
 * Les autres categories vivent dans l'atelier, parce qu'on remplit un
 * formulaire. Celle-ci est un mode a part entiere : on vient y jouer aux jeux
 * programmes par les autres, on essaie un exemple sans rien installer, et on
 * se lance. Le bouton « Creer mon jeu » reste colle en haut pendant qu'on
 * regarde la liste.
 */
export default async function GameScriptPage() {
  const jeux = (await getPublishedGames()).filter((g) => g.category === "Game Script");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tier = tierOf("free");
  let mesBrouillons: { id: string; title: string }[] = [];
  if (user) {
    const { data: profil } = await supabase.from("profiles").select("tier").eq("id", user.id).maybeSingle();
    tier = tierOf(profil?.tier);
    const { data } = await supabase
      .from("games")
      .select("id, title")
      .eq("author_id", user.id)
      .eq("category", "Game Script")
      .order("updated_at", { ascending: false })
      .limit(6);
    mesBrouillons = (data ?? []).map((g) => ({ id: String(g.id), title: String(g.title) }));
  }

  return (
    <div className="script-showcase portal-container portal-page">
      <div className="mx-auto max-w-6xl">
        {/* --- Presentation --- */}
        <div className="mode-hero script-hero">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">
              Le mode des bricoleurs
            </p>
            <h1 className="mt-2 text-5xl font-extrabold tracking-tight">
              Game Script<span className="mode-title-dot">.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--portal-muted)]">
              Ici, on ne remplit pas un formulaire : on <b>écrit son jeu</b>. Quelques lignes suffisent, le jeu tourne
              juste à côté de ton code, et tu le publies quand il te plaît. Pas d&apos;installation, pas de compte de
              développeur — un navigateur, et c&apos;est tout.
            </p>

            <div className="mode-tags">
              <span>Écris</span>
              <span>Essaie</span>
              <span>Partage</span>
            </div>
          </div>
          <ScriptArtwork />
        </div>

        {/* --- La barre d'action, collee en haut quand on descend --- */}
        <div className="script-bar">
          <form action={createDraft}>
            <input type="hidden" name="type" value="Game Script" />
            <button type="submit" className="portal-button">
              ⌨️ Créer mon jeu
            </button>
          </form>
          <span className="script-bar-note">
            {user
              ? `Palier ${TIERS[tier].label} : ${TIERS[tier].scriptMax.toLocaleString("fr-FR")} caractères de code par jeu.`
              : "Connecte-toi pour créer le tien — jouer ne demande aucun compte."}
          </span>
          {mesBrouillons.length > 0 && (
            <details className="script-mine">
              <summary>Mes jeux programmés ({mesBrouillons.length})</summary>
              <ul>
                {mesBrouillons.map((g) => (
                  <li key={g.id}>
                    <Link href={`/editeur/${g.id}`}>{g.title}</Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* --- Essayer tout de suite --- */}
        <section className="mode-section mt-10">
          <h2 className="text-2xl font-bold">Essaie, puis regarde le code</h2>
          <p className="mt-2 text-sm text-[var(--portal-muted)]">
            Ces trois jeux tournent ici même, et leur code tient sur un écran. C&apos;est exactement ce que tu
            obtiendras en cliquant sur « Créer mon jeu ».
          </p>
          <ScriptDemo />
        </section>

        {/* --- Les jeux des joueurs --- */}
        <section className="mode-section mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold">Les jeux de la communauté</h2>
            <span className="text-xs text-[var(--portal-muted)]">
              {jeux.length} jeu{jeux.length > 1 ? "x" : ""} programmé{jeux.length > 1 ? "s" : ""}
            </span>
          </div>

          {jeux.length === 0 ? (
            <div className="mode-empty mt-5 rounded-2xl border border-dashed border-[var(--portal-line)] p-10 text-center">
              <p className="text-4xl" aria-hidden="true">⌨️</p>
              <p className="mt-3 text-sm font-semibold">Personne n&apos;a encore publié de jeu programmé.</p>
              <p className="mt-1 text-xs text-[var(--portal-muted)]">Le premier, ce sera peut-être toi.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jeux.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </section>

        {/* --- Ce qu'on a sous la main --- */}
        <section className="script-toolbox mt-12 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-6">
          <h2 className="text-xl font-bold">Ce que tu peux écrire</h2>
          <p className="mt-2 text-sm text-[var(--portal-muted)]">
            Trois fonctions au maximum — <code>demarrer()</code>, <code>jouer(dt)</code> et <code>dessiner()</code> —
            et une boîte à outils courte, pensée pour être retenue par cœur.
          </p>
          <ul className="script-api mt-4">
            {API_DOC.map((a) => (
              <li key={a.nom}>
                <code>{a.nom}</code>
                <span>{a.desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Rassurer sur la securite --- */}
        <section className="mode-guidance mt-8 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-6">
          <h2 className="text-xl font-bold">Jouer au jeu d&apos;un inconnu, sans risque</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--portal-muted)]">
            <li>🔒 Chaque jeu tourne dans un cadre isolé : il ne peut ni lire ton compte, ni tes cookies, ni rien enregistrer sur ton appareil.</li>
            <li>📵 Le réseau y est coupé : un jeu ne peut envoyer aucune donnée nulle part.</li>
            <li>🧯 Si un programme part en boucle et se fige, ferme simplement l&apos;onglet — le reste du site n&apos;est jamais touché.</li>
            <li>🚩 Un jeu déplacé ou méchant ? Le bouton « Signaler » de sa page prévient l&apos;équipe.</li>
          </ul>
        </section>

        <div className="mode-finale mt-10 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-8 text-center">
          <h2 className="text-2xl font-extrabold">Ton jeu commence par une ligne.</h2>
          <p className="mt-2 text-sm text-[var(--portal-muted)]">
            L&apos;exemple de départ est déjà jouable : change un chiffre, et il est à toi.
          </p>
          <form action={createDraft} className="mt-5">
            <input type="hidden" name="type" value="Game Script" />
            <button type="submit" className="portal-button">
              ⌨️ Créer mon jeu
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
