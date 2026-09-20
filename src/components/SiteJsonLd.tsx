/**
 * Donnees structurees (JSON-LD) : elles expliquent a Google ce qu'est le
 * site, et lui permettent d'afficher une barre de recherche Pixolud
 * directement dans ses resultats.
 */
export default function SiteJsonLd({ siteUrl }: { siteUrl: string }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#site`,
        name: "Pixolud",
        alternateName: "Pixolud — mini-jeux",
        url: siteUrl,
        inLanguage: "fr-FR",
        description:
          "Plateforme communautaire pour créer, publier et jouer à des mini-jeux 2D sans coder, et jouer à des jeux 3D dans le navigateur.",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/catalogue?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#org`,
        name: "Pixolud",
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-512`,
      },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

/** Une fiche de jeu, pour que Google la comprenne comme un jeu jouable. */
export function GameJsonLd({
  siteUrl,
  url,
  name,
  description,
  author,
  image,
  datePublished,
  plays,
}: {
  siteUrl: string;
  url: string;
  name: string;
  description: string;
  author?: string;
  image?: string;
  datePublished?: string;
  plays?: number;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name,
    description,
    url,
    inLanguage: "fr-FR",
    gamePlatform: "Navigateur web",
    applicationCategory: "GameApplication",
    operatingSystem: "Tout navigateur récent",
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "Pixolud", url: siteUrl },
    offers: { "@type": "Offer", price: 0, priceCurrency: "EUR", availability: "https://schema.org/InStock" },
  };
  if (author) data.author = { "@type": "Person", name: author };
  if (image) data.image = image.startsWith("http") ? image : `${siteUrl}${image}`;
  if (datePublished) data.datePublished = datePublished;
  if (typeof plays === "number" && plays > 0) data.interactionStatistic = {
    "@type": "InteractionCounter",
    interactionType: "https://schema.org/PlayAction",
    userInteractionCount: plays,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
