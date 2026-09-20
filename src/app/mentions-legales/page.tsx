import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { CONTACT_EMAIL, HOSTS, PUBLISHER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales — Pixolud",
  description: "Qui édite Pixolud, qui l'héberge, et comment nous contacter.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      eyebrow="Informations légales"
      title="Mentions légales"
      intro="Qui publie ce site, qui l'héberge, et comment nous joindre. Ces informations sont obligatoires pour tout site accessible au public en France (loi pour la confiance dans l'économie numérique)."
      highlights={[
        { icon: "🧑‍💻", text: "Pixolud est un projet personnel, sans société ni publicité." },
        { icon: "🇫🇷", text: "Le site est publié depuis la France et suit le droit français et européen." },
        { icon: "✉️", text: "Une seule adresse pour tout : questions, données personnelles, signalements." },
        { icon: "🛠️", text: "Hébergement du site et des comptes par Vercel et Supabase." },
      ]}
      sections={[
        {
          id: "editeur",
          title: "Éditeur du site",
          body: (
            <>
              <p>
                <strong>{PUBLISHER}</strong>, personne physique, éditeur non professionnel du site Pixolud
                (<a href="https://pixolud.vercel.app">pixolud.vercel.app</a>).
              </p>
              <p>
                Conformément à l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin 2004, un éditeur non professionnel peut
                ne pas publier son adresse personnelle : celle-ci est conservée par l&apos;hébergeur, qui la communiquera aux
                autorités si elles la demandent.
              </p>
              <p>Directeur de la publication : {PUBLISHER}.</p>
            </>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: <ContactLine email={CONTACT_EMAIL} />,
        },
        {
          id: "hebergement",
          title: "Hébergement",
          body: (
            <ul>
              {HOSTS.map((h) => (
                <li key={h.name}>
                  <strong>{h.name}</strong> — {h.role}. {h.address}. <a href={h.site}>{h.site}</a>
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: "propriete",
          title: "Propriété intellectuelle",
          body: (
            <>
              <p>
                Le nom Pixolud, le code du site, les textes, les dessins, les sons et les jeux 3D édités par l&apos;équipe sont
                la propriété de l&apos;éditeur. Les modèles 3D animés proviennent de sources sous licence CC0 (domaine public),
                listées dans le fichier <code>public/models/LICENCES.txt</code> du projet.
              </p>
              <p>
                Les mini-jeux créés par les joueurs restent la propriété de leurs auteurs. En les publiant, l&apos;auteur
                autorise Pixolud à les afficher et à les faire jouer sur le site.
              </p>
            </>
          ),
        },
        {
          id: "signalement",
          title: "Signaler un contenu",
          body: (
            <p>
              Un contenu choquant, illégal ou qui ne respecte pas les règles peut être signalé depuis la page{" "}
              <a href="/signalement">Signaler un contenu</a>, ou depuis le bouton présent sur chaque jeu et chaque profil.
              Les signalements sont traités par l&apos;équipe, qui peut retirer le contenu et suspendre le compte concerné.
            </p>
          ),
        },
      ]}
    />
  );
}
