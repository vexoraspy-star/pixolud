import type { Metadata } from "next";
import Link from "next/link";
import GameArtwork from "@/components/GameArtwork";
import ShareButton from "@/components/ShareButton";
import { playableGames3D } from "@/lib/games3d";
import { getPublishedGames } from "@/lib/games";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pixolud.vercel.app";

export const metadata: Metadata = {
  title: "À propos de Pixolud — tout ce que tu peux faire ici",
  description:
    "Pixolud expliqué en entier : créer un mini-jeu sans coder, le publier, jouer aux cinq mondes 3D du navigateur (Cubes, Duel, Manoir Maudit, Backrooms, Labyrinthe), le multijoueur, la sécurité et la vie privée.",
  alternates: { canonical: "/a-propos" },
};

/** Ce qu'on peut faire, en trois etapes : c'est la promesse du site. */
const STEPS = [
  { n: "1", title: "Tu choisis", text: "Plateforme, puzzle, arcade, labyrinthe, quiz… l'éditeur s'adapte au type de jeu que tu veux faire." },
  { n: "2", title: "Tu construis", text: "Tu places tes éléments, tu testes dans la même page, tu corriges. Aucune ligne de code." },
  { n: "3", title: "Tu publies", text: "Ton jeu rejoint le catalogue avec son adresse. Un lien, et tes amis y jouent." },
];

const WORLDS: Record<string, string> = {
  cubes:
    "Un monde de blocs infini. En créatif, les blocs sont illimités et tu voles librement pour bâtir ce que tu veux. En survie, tu récoltes chaque bloc, tu creuses des grottes, tu montes un refuge avant la nuit et tu repousses les zombies. Ton monde se sauvegarde sur ton appareil, et tu peux l'exporter pour le garder.",
  "duel-1v1":
    "Un jeu de tir à la première personne : treize armes, du pistolet au lance-roquettes en passant par l'arbalète silencieuse, et sept modes. Une battle royale à 30 sur une île géante où tu atterris les mains vides et où la zone se referme. Un 1v1 construction où l'on bâtit ses murs en plein combat. Un duel en ligne avec un code de salon, un match à mort, une course à l'armement, un mode économie avec des manches, et un stand d'entraînement chronométré pour travailler sa visée.",
  "manoir-maudit":
    "Trente pièces sur deux étages, des portes fermées à clé, un code gravé dans les murs et cinq reliques à rassembler. La créature ne te voit pas : elle t'entend. Marche courbée, cache-toi dans les armoires, lance une pièce à l'autre bout du couloir pour l'attirer ailleurs.",
  backrooms:
    "Tu as traversé le sol par accident. Des couloirs jaunes à perte de vue, le bourdonnement des néons, et quatre niveaux à franchir : le Hall, la Zone habitable, la Tuyauterie, et un couloir où il ne reste plus qu'à courir. Les entités réagissent au bruit, et on peut y descendre à plusieurs.",
  "labyrinthe-legendaire":
    "Un vrai labyrinthe de pierre, différent à chaque partie, parcouru en vue à la première personne, avec trois difficultés et une mini-carte pour ne pas tourner en rond.",
};

export default async function AProposPage() {
  const games = await getPublishedGames();
  const worlds = playableGames3D();

  return (
    <div className="portal-container portal-page">
      {/* --- Promesse --- */}
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">À propos</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Ici, tu joues et tu crées.</h1>
        <p className="mt-4 text-base leading-7 text-[var(--portal-muted)]">
          La plupart des gens qui jouent ont un jour envie de faire leur propre jeu. Et presque tous abandonnent au même
          endroit : il faut apprendre à coder, installer un logiciel de trois gigas, suivre trois heures de tutoriel avant
          d&apos;afficher un carré à l&apos;écran. Pixolud fait l&apos;inverse : tu ouvres ton navigateur, et en quelques
          minutes ton jeu existe, il a une adresse, et tes amis y jouent en cliquant sur un lien.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/editeur" className="portal-button">
            Créer mon jeu
          </Link>
          <Link href="/catalogue" className="portal-button secondary">
            Voir le catalogue
          </Link>
          <ShareButton url={SITE_URL} title="Pixolud" text="Joue et crée tes mini-jeux gratuitement sur Pixolud :" />
        </div>
      </header>

      {/* --- Chiffres --- */}
      <ul className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: `${games.length}`, label: "jeux publiés" },
          { value: `${worlds.length}`, label: "mondes 3D" },
          { value: "0 €", label: "pour tout faire" },
          { value: "0", label: "publicité" },
        ].map((s) => (
          <li key={s.label} className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-4 text-center">
            <p className="text-3xl font-extrabold">{s.value}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--portal-muted)]">{s.label}</p>
          </li>
        ))}
      </ul>

      {/* --- Créer --- */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Créer un jeu, sans coder</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
          L&apos;éditeur est fait pour qu&apos;un débutant réussisse du premier coup. Chaque catégorie a le sien : un jeu de
          plateforme te propose des plateformes, des pièges et une arrivée ; un quiz te demande tes questions ; un labyrinthe
          se dessine case par case. Tant que ton jeu n&apos;est pas fini, il reste un brouillon que toi seul vois.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-[var(--portal-accent)] text-sm font-black text-white">
                {s.n}
              </span>
              <p className="mt-3 font-bold">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--portal-muted)]">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm leading-7 text-[var(--portal-muted)]">
          Un jeu publié rejoint le <Link href="/catalogue" className="text-[var(--portal-accent)] underline">catalogue</Link>{" "}
          avec sa vignette, sa catégorie et ton pseudo. Les autres peuvent le noter, le commenter, et voir le nombre de
          parties jouées. Certains jeux s&apos;ouvrent même en partie à plusieurs : tu crées un salon et tu envoies le code à
          un ami.
        </p>
      </section>

      {/* --- Les mondes 3D --- */}
      <section className="mt-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold">Cinq mondes 3D, sans rien installer</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            À côté des créations de la communauté, l&apos;équipe publie des jeux 3D complets qui tournent dans un simple
            onglet. Pas de téléchargement, pas de compte : tu cliques, tu joues.
          </p>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {worlds.map((g) => (
            <article key={g.slug} className="overflow-hidden rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)]">
              <div className="relative h-44 overflow-hidden">
                <GameArtwork kind={g.slug} cover={g.cover} />
              </div>
              <div className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--portal-accent)]">
                  {g.genre} · {g.players} · {g.duration}
                </p>
                <h3 className="mt-1 text-xl font-bold">{g.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">{WORLDS[g.slug] ?? g.description}</p>
                <Link href={`/mode-3d/${g.slug}`} className="portal-button small mt-4">
                  Jouer à {g.title}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --- Le reste --- */}
      <section className="mx-auto mt-16 max-w-3xl space-y-10">
        <div>
          <h2 className="text-2xl font-bold">Jouer à plusieurs</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            La section <Link href="/multijoueur" className="text-[var(--portal-accent)] underline">Multijoueur</Link> propose
            des parties rapides contre d&apos;autres joueurs : conquête de territoire, éclatement de bulles, échecs, chasse au
            trésor. Tout passe par un code de salon, sans installation : tu crées le salon, tu envoies le code à tes amis,
            et vous jouez. N&apos;importe quel jeu de la communauté peut aussi devenir une partie partagée, quand son auteur
            a activé le mode à plusieurs.
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Tu peux ajouter des amis par leur pseudo depuis la page{" "}
            <Link href="/amis" className="text-[var(--portal-accent)] underline">Mes amis</Link>, ou depuis le bouton
            « Amis » qui reste affiché dans le coin de l&apos;écran : la discussion s&apos;ouvre par-dessus le site, donc tu
            peux parler sans quitter ta partie. Un point vert indique qui est connecté en ce moment. Une{" "}
            <b>party</b> va plus loin : c&apos;est un salon de groupe, avec un chef — celui qui la crée — qui invite, renomme
            et exclut. Tout le monde y discute, même si chacun joue à un jeu différent. Et avant une partie à plusieurs, le
            testeur de micro des <Link href="/parametres" className="text-[var(--portal-accent)] underline">paramètres</Link>{" "}
            te dit en trois secondes si on t&apos;entend.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Retrouver ce qu&apos;on aime</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Le catalogue grossit vite. Une étoile sur la page d&apos;un jeu le range dans{" "}
            <Link href="/favoris" className="text-[var(--portal-accent)] underline">tes favoris</Link>, et tu le retrouves en
            deux clics depuis le menu de ton compte. Tu peux aussi noter les jeux sur cinq étoiles et laisser un commentaire :
            c&apos;est ce qui fait remonter les bons jeux et ce qui donne envie aux créateurs de continuer.
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Ton profil t&apos;appartient : photo, cadre d&apos;avatar, petite bio. Les cadres les plus voyants demandent un
            palier, mais aucun ne donne le moindre avantage en jeu — c&apos;est de la décoration, pas de la puissance. Et si
            tu aimes fouiller : plusieurs <b>codes secrets</b> sont cachés dans le site, à taper au clavier. Les indices sont
            dans tes paramètres, les codes eux-mêmes, à toi de les trouver.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Pensé pour un public jeune</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Le site est en français et traduit en six langues. Il s&apos;ouvre aussi bien sur téléphone que sur ordinateur, et
            s&apos;installe comme une application depuis le navigateur. Chaque jeu et chaque profil peut être signalé en un
            clic ; l&apos;équipe peut avertir, retirer un contenu ou suspendre un compte. Les règles sont écrites simplement
            dans les <Link href="/cgu" className="text-[var(--portal-accent)] underline">conditions d&apos;utilisation</Link>,
            et un compte pour un enfant de moins de 15 ans demande l&apos;accord d&apos;un parent.
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Le chat est modéré, mais pas stérilisé : on peut se chamailler, se traiter de nul et râler après une défaite —
            c&apos;est un site de jeu. Ce qui ne passe pas, en revanche, ne passe jamais : les insultes qui visent l&apos;origine,
            la religion, le handicap ou l&apos;orientation de quelqu&apos;un, les menaces qui sortent du jeu, et tout contenu
            sexuel sont bloqués avant même d&apos;être envoyés. Les numéros de téléphone, adresses et e-mails sont
            automatiquement masqués : personne n&apos;a besoin de tes coordonnées pour jouer avec toi.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Ta vie privée</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Aucune publicité, aucun traceur, aucune revente de données. Seuls des cookies nécessaires au fonctionnement sont
            utilisés, détaillés sur la page <Link href="/cookies" className="text-[var(--portal-accent)] underline">Cookies</Link>.
            Tu peux télécharger toutes tes données en un fichier, ou supprimer ton compte définitivement, depuis tes
            paramètres. Tout est expliqué dans la{" "}
            <Link href="/confidentialite" className="text-[var(--portal-accent)] underline">politique de confidentialité</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Gratuit</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Tout est gratuit : jouer, créer, publier, partager. Aucun paiement n&apos;est possible sur le site et aucune donnée
            bancaire n&apos;est demandée. Des paliers existent pour plus tard, mais rien n&apos;est vendu aujourd&apos;hui ; le
            détail est sur la page{" "}
            <Link href="/remboursement" className="text-[var(--portal-accent)] underline">Paiements et remboursement</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Derrière le site</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">
            Pixolud est un projet personnel, développé par une seule personne. Les textures, les sons et les illustrations sont
            faits maison ; les rares modèles 3D utilisés sont libres de droits. Le site continue d&apos;évoluer, jeu après jeu.
            Une idée, un bug, une remarque ? Écris par la page{" "}
            <Link href="/signalement" className="text-[var(--portal-accent)] underline">Signaler un contenu</Link>.
          </p>
        </div>
      </section>

      {/* --- Questions que tout le monde se pose --- */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Les questions qu&apos;on nous pose</h2>
        <div className="mt-5 divide-y divide-[var(--portal-line)] rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)]">
          {[
            {
              q: "Faut-il un compte pour jouer ?",
              r: "Non. On peut jouer à tout le catalogue sans compte : les visiteurs apparaissent simplement sous un numéro. Le compte sert à créer des jeux, garder ses favoris, ajouter des amis et discuter.",
            },
            {
              q: "Faut-il savoir programmer pour créer un jeu ?",
              r: "Non, jamais. On choisit une catégorie, on remplit un éditeur avec des clics et du texte, et on publie. Les seuls écrans où l'on voit du code sont les tutoriels Python — et là, c'est le jeu lui-même.",
            },
            {
              q: "Combien ça coûte ?",
              r: "Rien. Jouer, créer, publier et partager sont gratuits, et aucune donnée bancaire n'est demandée. Des paliers payants existeront plus tard pour publier davantage et débloquer des habillages, mais rien n'est vendu aujourd'hui.",
            },
            {
              q: "Puis-je créer un jeu en 3D ?",
              r: "Pas encore. Les mondes 3D (Manoir maudit, Backrooms, Duel, Cubes) sont faits par l'équipe, parce qu'ils demandent du code et de l'optimisation. Les créations des joueurs sont en 2D.",
            },
            {
              q: "Mon jeu n'est pas publiable, pourquoi ?",
              r: "Chaque catégorie a une condition minimale pour être jouable : un labyrinthe doit avoir un départ, une arrivée et un chemin entre les deux ; un quiz au moins une question complète. Le message affiché dans l'éditeur dit exactement ce qu'il manque.",
            },
            {
              q: "Qui voit mes brouillons ?",
              r: "Toi seul. Un jeu reste privé jusqu'au moment où tu appuies sur Publier, et tu peux le retirer du catalogue à tout moment.",
            },
            {
              q: "Sur quoi ça marche ?",
              r: "Sur n'importe quel navigateur récent, téléphone comme ordinateur. Rien à installer ; le site peut aussi s'ajouter à l'écran d'accueil comme une application.",
            },
            {
              q: "Comment signaler un problème ?",
              r: "Chaque jeu et chaque profil a un bouton de signalement, et la page « Signaler un contenu » accepte aussi les bugs et les idées. Les signalements arrivent directement dans le panneau de l'équipe.",
            },
          ].map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none text-sm font-bold">
                {f.q}
                <span aria-hidden="true" className="float-right text-[var(--portal-accent)] group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-muted)]">{f.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* --- Appel final --- */}
      <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-8 text-center">
        <h2 className="text-2xl font-extrabold">Ton premier jeu t&apos;attend.</h2>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">Gratuit, sans installation, et sans une ligne de code.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/editeur" className="portal-button">
            Créer un jeu
          </Link>
          <Link href="/mode-3d" className="portal-button secondary">
            Explorer les mondes 3D
          </Link>
        </div>
      </div>
    </div>
  );
}
