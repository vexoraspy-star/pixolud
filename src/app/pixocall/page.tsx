import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PixoCallRoom from "@/components/PixoCallRoom";
import { MAX_PARTICIPANTS } from "@/lib/pixocall";

export const metadata: Metadata = {
  title: "PixoCall — parler en direct sur Pixolud",
  description:
    "Le salon vocal de Pixolud : parle avec tes amis pendant que vous jouez, sans installer quoi que ce soit.",
};

export default async function PixoCallPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/pixocall");

  const { data: profil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return (
    <div className="portal-container portal-page">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">Nouveau mode</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">PixoCall 🎙️</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--portal-muted)]">
          Le salon vocal de Pixolud. Tu crées un salon, tu envoies le code à tes amis, et vous parlez pendant que vous
          jouez — sans rien installer, directement dans le navigateur.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-[var(--portal-muted)]">Chargement…</p>}>
          <PixoCallRoom
            moi={{
              userId: user.id,
              pseudo: String(profil?.pseudo ?? "Joueur"),
              avatarUrl: (profil?.avatar_url as string | null) ?? null,
              frame: String(profil?.frame ?? "aucun"),
            }}
          />
        </Suspense>

        <section className="mt-10 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
          <h2 className="text-sm font-bold">Comment ça marche, et ce que ça ne fait pas</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--portal-muted)]">
            <li>
              🔒 <b>Ta voix ne passe par aucun serveur.</b> Les ordinateurs se parlent directement entre eux. Pixolud
              ne sert qu&apos;à vous présenter : rien n&apos;est enregistré, rien n&apos;est stocké, et personne ne
              peut réécouter une conversation.
            </li>
            <li>
              👥 <b>{MAX_PARTICIPANTS} personnes maximum.</b> Chacun envoie sa voix à tous les autres : au-delà, une
              connexion ordinaire ne suit plus et tout le monde grésille.
            </li>
            <li>
              📶 <b>Certains réseaux bloquent.</b> Dans un collège, une entreprise ou derrière certaines box, la
              liaison directe peut échouer. Il faudrait un serveur relais, qui coûte cher au mois — ce n&apos;est pas
              au programme d&apos;un site gratuit. Dans ce cas, essayez depuis une autre connexion.
            </li>
            <li>
              🎧 <b>Mets un casque.</b> Sans casque, ton micro réentend les autres et ça siffle.
            </li>
            <li>
              🙈 <b>Un salon disparaît quand le dernier part.</b> Le code ne sert plus à rien ensuite.
            </li>
          </ul>
          <p className="mt-4 text-xs text-[var(--portal-muted)]">
            Un souci avec quelqu&apos;un dans un salon ? Coupe-le avec le bouton 🔊, quitte le salon, et
            <Link href="/signalement" className="ml-1 text-[var(--portal-accent)] underline">signale-le à l&apos;équipe</Link>.
          </p>
        </section>

        <p className="mt-6 text-xs text-[var(--portal-muted)]">
          Avant une partie, tu peux vérifier que tu es bien entendu avec le testeur de micro de tes{" "}
          <Link href="/parametres" className="text-[var(--portal-accent)] underline">paramètres</Link>.
        </p>
      </div>
    </div>
  );
}
