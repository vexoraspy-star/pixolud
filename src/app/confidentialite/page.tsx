export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Dernière mise à jour : 3 septembre 2026
      </p>

      <div className="mt-8">
        <Section title="1. Données collectées">
          <p>Lors de l&apos;utilisation de Pixolud, nous collectons :</p>
          <ul>
            <li>
              <strong>Données de compte</strong> : pseudo, adresse email, mot
              de passe (stocké de façon chiffrée/hachée, jamais en clair) ;
            </li>
            <li>
              <strong>Données de profil</strong> : avatar, bio, si tu choisis
              de les renseigner ;
            </li>
            <li>
              <strong>Contenus créés</strong> : jeux, niveaux, sprites
              importés, commentaires, notes ;
            </li>
            <li>
              <strong>Données d&apos;usage</strong> : jeux joués, temps de
              jeu, interactions avec la Plateforme, à des fins statistiques et
              d&apos;amélioration du service.
            </li>
          </ul>
        </Section>

        <Section title="2. Finalités du traitement">
          <p>Ces données sont utilisées pour :</p>
          <ul>
            <li>créer et gérer ton compte utilisateur ;</li>
            <li>permettre la publication et la découverte de mini-jeux ;</li>
            <li>assurer la modération et la sécurité de la Plateforme ;</li>
            <li>
              t&apos;envoyer des emails liés à ton compte (confirmation,
              réinitialisation de mot de passe) ;
            </li>
            <li>améliorer le fonctionnement du service (statistiques agrégées).</li>
          </ul>
          <p>
            Nous ne vendons jamais tes données personnelles à des tiers et ne
            les utilisons pas à des fins publicitaires sans ton consentement
            explicite.
          </p>
        </Section>

        <Section title="3. Base légale et conservation">
          <p>
            Le traitement de tes données repose sur l&apos;exécution du
            contrat qui te lie à Pixolud (fourniture du service) et, le cas
            échéant, sur ton consentement. Les données de compte sont
            conservées tant que ton compte est actif, puis supprimées ou
            anonymisées dans un délai raisonnable après la suppression du
            compte, sauf obligation légale de conservation plus longue.
          </p>
        </Section>

        <Section title="4. Tes droits">
          <p>
            Conformément au Règlement Général sur la Protection des Données
            (RGPD), tu disposes des droits suivants sur tes données
            personnelles :
          </p>
          <ul>
            <li>droit d&apos;accès et de rectification ;</li>
            <li>droit à l&apos;effacement (« droit à l&apos;oubli ») ;</li>
            <li>droit à la portabilité de tes données ;</li>
            <li>droit d&apos;opposition et de limitation du traitement ;</li>
            <li>
              droit de retirer ton consentement à tout moment lorsque le
              traitement en dépend.
            </li>
          </ul>
          <p>
            Tu peux exercer ces droits directement depuis la page{" "}
            <strong>Paramètres</strong> de ton compte, ou en contactant
            l&apos;équipe de Pixolud.
          </p>
        </Section>

        <Section title="5. Partage des données">
          <p>
            Certaines données peuvent être traitées par des prestataires
            techniques (hébergement, base de données, envoi d&apos;emails)
            strictement nécessaires au fonctionnement de la Plateforme, dans
            le respect de la réglementation applicable. Ton pseudo, ton
            avatar, ta bio et les jeux que tu publies sont visibles
            publiquement par tous les visiteurs de la Plateforme.
          </p>
        </Section>

        <Section title="6. Cookies">
          <p>
            Pixolud utilise des cookies strictement nécessaires au
            fonctionnement du service (maintien de ta session de connexion).
            Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé
            sans ton consentement préalable.
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles
            raisonnables pour protéger tes données contre l&apos;accès non
            autorisé, la perte ou l&apos;altération, notamment le chiffrement
            des mots de passe et un contrôle d&apos;accès aux données
            sensibles.
          </p>
        </Section>

        <Section title="8. Contact">
          <p>
            Pour toute question relative à cette politique de confidentialité
            ou pour exercer tes droits, tu peux contacter l&apos;équipe de
            Pixolud via la page de contact du site.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-600 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-zinc-800 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 dark:text-zinc-300 dark:[&_strong]:text-zinc-100">
        {children}
      </div>
    </section>
  );
}
