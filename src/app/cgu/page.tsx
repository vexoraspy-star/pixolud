export default function CGUPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
        Conditions Générales d&apos;Utilisation (CGU)
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Dernière mise à jour : 3 septembre 2026
      </p>

      <div className="mt-8">
        <Section title="1. Objet">
          <p>
            Les présentes CGU définissent les règles d&apos;utilisation de
            Pixolud (ci-après « la Plateforme »), un service communautaire
            permettant de créer, publier, découvrir et jouer à des mini-jeux
            en 2D. En créant un compte ou en utilisant la Plateforme, tu
            acceptes sans réserve les présentes conditions.
          </p>
        </Section>

        <Section title="2. Compte utilisateur">
          <p>
            La création d&apos;un compte nécessite un pseudo, une adresse
            email valide et un mot de passe. Tu es responsable de la
            confidentialité de tes identifiants et de toute activité
            effectuée depuis ton compte. Un compte est réservé à un seul
            utilisateur ; les comptes doivent correspondre à des personnes
            réelles (pas de robots ni de comptes générés en masse).
          </p>
        </Section>

        <Section title="3. Contenu interdit">
          <p>
            Il est strictement interdit de publier, via un jeu, un
            commentaire, un pseudo, un avatar ou tout autre contenu, des
            éléments comprenant :
          </p>
          <ul>
            <li>
              de la <strong>violence extrême ou gratuite</strong> (contenu
              gore, actes de cruauté mis en scène de façon réaliste et
              choquante) ;
            </li>
            <li>
              du <strong>contenu haineux</strong> ou discriminatoire (racisme,
              sexisme, homophobie, incitation à la haine envers un groupe ou
              une personne) ;
            </li>
            <li>
              du contenu à caractère sexuel impliquant des mineurs, ou plus
              largement tout contenu pornographique ;
            </li>
            <li>
              de la <strong>triche</strong> : exploitation de failles pour
              fausser les classements, scripts ou bots automatisant le jeu,
              manipulation artificielle des vues/notes/commentaires ;
            </li>
            <li>
              du <strong>plagiat</strong> : republier un jeu, des sprites, des
              niveaux ou des textes créés par quelqu&apos;un d&apos;autre sans
              autorisation ni attribution ;
            </li>
            <li>
              du harcèlement, des menaces, de la diffamation ou toute atteinte
              à la vie privée d&apos;autrui (doxxing) ;
            </li>
            <li>
              des liens ou contenus malveillants (virus, hameçonnage, spam
              publicitaire).
            </li>
          </ul>
        </Section>

        <Section title="4. Règles de modération">
          <p>
            La Plateforme se réserve le droit de retirer tout contenu
            contrevenant aux présentes CGU, sans préavis. Selon la gravité, la
            modération peut :
          </p>
          <ul>
            <li>retirer ou masquer un jeu, un commentaire ou un avatar ;</li>
            <li>adresser un avertissement au compte concerné ;</li>
            <li>
              suspendre temporairement le compte (7 à 30 jours selon la
              gravité) ;
            </li>
            <li>
              bannir définitivement le compte en cas de récidive ou de faute
              grave (contenu illégal, haine, contenu impliquant des mineurs).
            </li>
          </ul>
          <p>
            Tout utilisateur peut signaler un contenu via le bouton « Signaler
            » présent sur chaque jeu, profil ou commentaire. Les signalements
            sont examinés par l&apos;équipe de modération. Un utilisateur
            banni peut contester la décision en écrivant à l&apos;adresse de
            contact du site.
          </p>
        </Section>

        <Section title="5. Droits d'auteur sur les créations">
          <p>
            Chaque créateur conserve la propriété intellectuelle des jeux
            qu&apos;il publie sur la Plateforme. En publiant un jeu, tu
            accordes à Pixolud une licence non exclusive, mondiale et
            gratuite pour héberger, afficher, distribuer et permettre à
            d&apos;autres utilisateurs de jouer à ton jeu au sein de la
            Plateforme.
          </p>
          <p>
            Tu garantis détenir tous les droits nécessaires sur les éléments
            que tu importes (sprites, images, sons, textes). Toute création
            utilisant des ressources dont tu n&apos;as pas les droits
            (plagiat, contenu protégé par le droit d&apos;auteur d&apos;un
            tiers) pourra être retirée sans préavis.
          </p>
        </Section>

        <Section title="6. Conduite des utilisateurs">
          <p>Sur la Plateforme, chaque utilisateur s&apos;engage à :</p>
          <ul>
            <li>faire preuve de respect envers les autres membres ;</li>
            <li>
              ne pas usurper l&apos;identité d&apos;une autre personne ou
              organisation ;
            </li>
            <li>
              ne pas tenter de contourner les mesures de sécurité ou de
              modération de la Plateforme ;
            </li>
            <li>
              signaler tout contenu ou comportement qui lui semble
              contrevenir aux présentes règles.
            </li>
          </ul>
        </Section>

        <Section title="7. Suspension et résiliation">
          <p>
            Tu peux supprimer ton compte à tout moment depuis les paramètres.
            Pixolud peut suspendre ou résilier un compte en cas de violation
            des présentes CGU, conformément aux règles de modération
            décrites ci-dessus.
          </p>
        </Section>

        <Section title="8. Évolution des CGU">
          <p>
            Ces CGU peuvent être modifiées pour refléter l&apos;évolution du
            service ou de la réglementation. Les utilisateurs seront informés
            de tout changement substantiel.
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
