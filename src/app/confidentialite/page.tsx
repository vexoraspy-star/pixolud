import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { CONTACT_EMAIL, DATA_REGION, HOSTS, PUBLISHER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Pixolud",
  description: "Quelles données Pixolud collecte, pourquoi, combien de temps, et comment exercer tes droits.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      eyebrow="Vie privée"
      title="Politique de confidentialité"
      intro="Cette page explique, simplement, quelles informations Pixolud garde sur toi, pourquoi, pendant combien de temps, et comment les récupérer ou les effacer."
      highlights={[
        { icon: "📝", text: "Pour jouer, rien n'est demandé. Pour publier un jeu, il faut un compte." },
        { icon: "🙅", text: "Aucune publicité, aucun traceur, aucune vente de données." },
        { icon: "🗑️", text: "Tu peux tout effacer toi-même depuis tes Paramètres, en un clic." },
        { icon: "📦", text: "Tu peux télécharger toutes tes données en un fichier." },
      ]}
      sections={[
        {
          id: "responsable",
          title: "Qui est responsable",
          body: (
            <p>
              Le responsable du traitement est <strong>{PUBLISHER}</strong>, éditeur du site
              (voir les <a href="/mentions-legales">mentions légales</a>). Pixolud est un projet personnel, sans société,
              sans publicité et sans revente de données.
            </p>
          ),
        },
        {
          id: "donnees",
          title: "Ce que nous collectons",
          body: (
            <>
              <p>
                <strong>Sans compte</strong>, tu peux jouer librement : aucune information personnelle n&apos;est demandée.
                Ton navigateur reçoit seulement un numéro au hasard (« Joueur 482193 ») pour t&apos;afficher un nom dans les
                parties à plusieurs, ainsi que les sauvegardes de tes parties, qui restent sur ton appareil.
              </p>
              <p>
                <strong>Avec un compte</strong>, nous conservons :
              </p>
              <ul>
                <li>
                  <strong>le nécessaire au compte</strong> : adresse e-mail, pseudo, mot de passe (jamais en clair, uniquement
                  sous forme hachée), date d&apos;inscription et de dernière connexion ;
                </li>
                <li>
                  <strong>ce que tu écris ou publies</strong> : bio, avatar, mini-jeux, commentaires, notes, signalements ;
                </li>
                <li>
                  <strong>la modération</strong> : avertissements reçus, suspension éventuelle et son motif ;
                </li>
                <li>
                  <strong>des compteurs simples</strong> : nombre de parties jouées sur un jeu. Nous ne suivons pas ta
                  navigation page par page.
                </li>
              </ul>
              <p>
                Nos hébergeurs enregistrent en plus, pour la sécurité, des journaux techniques contenant notamment ton adresse
                IP et la date de tes visites.
              </p>
            </>
          ),
        },
        {
          id: "pourquoi",
          title: "Pourquoi, et sur quelle base légale",
          body: (
            <ul>
              <li>
                <strong>Faire fonctionner le service</strong> (compte, publication, parties à plusieurs) : exécution du
                contrat qui nous lie, c&apos;est-à-dire les <a href="/cgu">CGU</a>.
              </li>
              <li>
                <strong>Sécurité et modération</strong> (signalements, avertissements, suspensions, journaux) : notre intérêt
                légitime à garder un site sain pour un public jeune.
              </li>
              <li>
                <strong>E-mails liés au compte</strong> (confirmation, mot de passe oublié) : exécution du contrat.
              </li>
              <li>
                <strong>Obligations légales</strong> : conservation de certaines données en cas de demande d&apos;une autorité.
              </li>
            </ul>
          ),
        },
        {
          id: "duree",
          title: "Combien de temps",
          body: (
            <ul>
              <li>
                <strong>Compte et contenus</strong> : tant que le compte existe. À sa suppression, compte, jeux, commentaires
                et notes sont effacés immédiatement.
              </li>
              <li>
                <strong>Compte inactif</strong> : après 3 ans sans connexion, le compte peut être supprimé après un e-mail
                de prévenance.
              </li>
              <li>
                <strong>Décisions de modération</strong> (avertissement, suspension) : jusqu&apos;à 1 an après la fin de la
                sanction.
              </li>
              <li>
                <strong>Journaux techniques des hébergeurs</strong> : selon leurs propres durées, en général quelques
                semaines à un an.
              </li>
            </ul>
          ),
        },
        {
          id: "qui-voit",
          title: "Qui voit quoi",
          body: (
            <>
              <p>
                <strong>Public</strong> : ton pseudo, ton avatar, ta bio, tes jeux publiés, tes commentaires, ton badge
                certifié et, le cas échéant, le nombre d&apos;avertissements reçus.
              </p>
              <p>
                <strong>Toi et l&apos;équipe seulement</strong> : ton adresse e-mail, ta date de dernière connexion, le détail
                des mesures de modération.
              </p>
              <p>
                <strong>Nos prestataires techniques</strong>, qui hébergent le site et la base de données :{" "}
                {HOSTS.map((h) => h.name).join(", ")}. Données hébergées dans la région : {DATA_REGION}. Ces sociétés étant
                américaines ou singapouriennes, un transfert hors Union européenne est possible ; il est encadré par les
                clauses contractuelles types de la Commission européenne.
              </p>
              <p>Nous ne vendons ni ne louons aucune donnée, et n&apos;affichons aucune publicité.</p>
            </>
          ),
        },
        {
          id: "droits",
          title: "Tes droits, et comment les exercer",
          body: (
            <>
              <p>Le RGPD te donne le droit d&apos;accéder à tes données, de les corriger, de les effacer, de les récupérer et de t&apos;opposer à certains traitements.</p>
              <ul>
                <li>
                  <strong>Les récupérer</strong> : bouton « Télécharger mes données » dans tes{" "}
                  <a href="/parametres">Paramètres</a> (fichier JSON).
                </li>
                <li>
                  <strong>Les corriger</strong> : pseudo, bio et avatar se modifient dans les Paramètres.
                </li>
                <li>
                  <strong>Tout effacer</strong> : bouton « Supprimer mon compte » dans les Paramètres. C&apos;est immédiat et
                  définitif.
                </li>
                <li>
                  <strong>Nous écrire</strong> pour toute autre demande (voir ci-dessous).
                </li>
              </ul>
              <p>
                Si une réponse ne te satisfait pas, tu peux saisir la CNIL : <a href="https://www.cnil.fr/fr/plaintes">cnil.fr/fr/plaintes</a>.
              </p>
            </>
          ),
        },
        {
          id: "mineurs",
          title: "Les enfants",
          body: (
            <>
              <p>
                Pixolud s&apos;adresse à un public jeune. En France, un enfant de moins de 15 ans ne peut pas consentir seul au
                traitement de ses données : la création d&apos;un compte doit être faite avec l&apos;accord d&apos;un parent ou du
                responsable légal.
              </p>
              <p>
                Un parent peut demander à tout moment la suppression du compte de son enfant, sans justification, en nous
                écrivant.
              </p>
              <p>Conseil : n&apos;écris jamais ton nom complet, ton adresse, ton école ou ton numéro de téléphone dans ton pseudo, ta bio ou un jeu.</p>
            </>
          ),
        },
        {
          id: "securite",
          title: "Sécurité",
          body: (
            <p>
              Les mots de passe sont hachés par notre prestataire d&apos;authentification, les échanges passent par HTTPS, et la
              base de données applique des règles d&apos;accès par ligne : chacun ne peut modifier que ses propres contenus. En
              cas de fuite de données présentant un risque, nous préviendrons les personnes concernées et la CNIL dans les
              72 heures.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              Le site n&apos;utilise que des cookies nécessaires à son fonctionnement, sans publicité ni traceur. Le détail se
              trouve sur la page <a href="/cookies">Cookies</a>.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Nous contacter",
          body: <ContactLine email={CONTACT_EMAIL} />,
        },
      ]}
    />
  );
}
