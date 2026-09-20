import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Pixolud",
  description: "Les règles du jeu sur Pixolud : compte, contenus autorisés, modération, droits sur tes créations.",
};

export default function CguPage() {
  return (
    <LegalPage
      eyebrow="Règles du site"
      title="Conditions générales d'utilisation"
      intro="Les règles à connaître pour utiliser Pixolud. En créant un compte ou en jouant, tu acceptes ces conditions."
      highlights={[
        { icon: "🎂", text: "Moins de 15 ans : l'accord d'un parent est nécessaire pour créer un compte." },
        { icon: "🎨", text: "Tes créations restent à toi. Tu nous autorises seulement à les afficher." },
        { icon: "🚫", text: "Contenu haineux, violent, sexuel ou volé : interdit, et retiré." },
        { icon: "🆓", text: "Le service est gratuit et fourni tel quel, sans garantie de disponibilité." },
      ]}
      sections={[
        {
          id: "objet",
          title: "Objet",
          body: (
            <p>
              Pixolud est une plateforme gratuite qui permet de créer, publier et jouer à des mini-jeux, sans écrire de code,
              et de jouer à des jeux 3D édités par l&apos;équipe. Ces conditions décrivent les règles d&apos;utilisation du
              site. Elles s&apos;appliquent à tous : visiteurs sans compte comme membres inscrits.
            </p>
          ),
        },
        {
          id: "age",
          title: "Âge et accord des parents",
          body: (
            <>
              <p>
                Jouer est possible sans compte et sans condition d&apos;âge. Pour créer un compte, si tu as{" "}
                <strong>moins de 15 ans</strong>, tu dois avoir l&apos;accord d&apos;un de tes parents ou de ton responsable
                légal : c&apos;est la règle en France pour les données personnelles des mineurs.
              </p>
              <p>
                Un parent peut à tout moment demander la suppression du compte de son enfant en nous écrivant. Elle est faite
                sans discussion et sans délai.
              </p>
            </>
          ),
        },
        {
          id: "compte",
          title: "Ton compte",
          body: (
            <ul>
              <li>Un compte par personne. Les informations données doivent être exactes.</li>
              <li>Ton mot de passe est personnel : ne le partage avec personne, pas même avec un ami de confiance.</li>
              <li>Tu es responsable de ce qui est publié depuis ton compte.</li>
              <li>
                Tu peux supprimer ton compte à tout moment depuis tes <a href="/parametres">Paramètres</a>. Tes jeux, tes
                commentaires et tes notes sont alors effacés.
              </li>
            </ul>
          ),
        },
        {
          id: "interdit",
          title: "Ce qui est interdit",
          body: (
            <>
              <ul>
                <li>les contenus haineux, racistes, sexistes, homophobes, ou qui harcèlent quelqu&apos;un ;</li>
                <li>les contenus sexuels, ou très violents ;</li>
                <li>les contenus qui ne t&apos;appartiennent pas : images, musiques, personnages ou jeux copiés ;</li>
                <li>les informations personnelles, les tiennes ou celles des autres (nom complet, adresse, téléphone, école) ;</li>
                <li>les arnaques, les faux concours, les liens piégés, la publicité ;</li>
                <li>tricher pour gonfler ses statistiques, ou gêner volontairement le fonctionnement du site.</li>
              </ul>
              <p>
                Un contenu qui enfreint ces règles peut être retiré sans préavis, et le compte concerné suspendu.
              </p>
            </>
          ),
        },
        {
          id: "moderation",
          title: "Modération et sanctions",
          body: (
            <>
              <p>
                L&apos;équipe peut avertir un joueur, retirer un jeu du catalogue, supprimer un commentaire, suspendre un
                compte pour une durée limitée ou définitive, et supprimer un compte en cas de faute grave ou répétée.
              </p>
              <p>
                Un avertissement s&apos;affiche à l&apos;écran du joueur concerné et reste visible sur son profil. Une
                suspension empêche la connexion et la publication ; son motif est indiqué.
              </p>
              <p>
                Tu peux contester une décision en nous écrivant : elle sera réexaminée par un humain, et levée si elle était
                injustifiée.
              </p>
            </>
          ),
        },
        {
          id: "creations",
          title: "Tes créations",
          body: (
            <>
              <p>
                Les mini-jeux que tu crées <strong>restent ta propriété</strong>. En les publiant, tu accordes à Pixolud une
                autorisation gratuite et non exclusive de les héberger, de les afficher et de les faire jouer sur le site,
                tant qu&apos;ils y sont publiés.
              </p>
              <p>
                Tu peux dépublier ou supprimer un jeu à tout moment. Les jeux 3D édités par l&apos;équipe, le code et
                l&apos;habillage du site ne sont pas réutilisables sans autorisation.
              </p>
            </>
          ),
        },
        {
          id: "gratuite",
          title: "Gratuité et paliers",
          body: (
            <p>
              Le site est gratuit. Les paliers Standard et Max présentés sur la page <a href="/premium">Premium</a> ne sont
              pas vendus aujourd&apos;hui : aucun paiement n&apos;est possible. Les règles qui s&apos;appliqueront le jour où
              une offre payante existera sont décrites sur la page <a href="/remboursement">Paiements et remboursement</a>.
            </p>
          ),
        },
        {
          id: "responsabilite",
          title: "Responsabilité",
          body: (
            <>
              <p>
                Pixolud est un projet personnel fourni « tel quel » : le service peut être interrompu, modifié ou arrêté, et
                des bugs peuvent exister. Nous faisons de notre mieux pour conserver les jeux et les comptes, sans pouvoir
                garantir l&apos;absence totale de perte de données. Pense à exporter tes créations importantes.
              </p>
              <p>
                Les jeux publiés par les joueurs sont sous leur responsabilité. Un contenu qui poserait problème peut être
                signalé depuis la page <a href="/signalement">Signaler un contenu</a> ; il sera examiné rapidement.
              </p>
            </>
          ),
        },
        {
          id: "evolution",
          title: "Évolution des règles",
          body: (
            <p>
              Ces conditions peuvent évoluer avec le site. La date de mise à jour est indiquée en haut de cette page. En cas
              de changement important, l&apos;information sera affichée sur le site.
            </p>
          ),
        },
        {
          id: "droit",
          title: "Droit applicable et contact",
          body: (
            <>
              <p>
                Ces conditions sont soumises au droit français. En cas de désaccord, une solution amiable sera recherchée
                d&apos;abord ; à défaut, les tribunaux français sont compétents. Un consommateur peut aussi recourir
                gratuitement à un médiateur de la consommation.
              </p>
              <ContactLine email={CONTACT_EMAIL} />
            </>
          ),
        },
      ]}
    />
  );
}
