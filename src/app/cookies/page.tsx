import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Cookies — Pixolud",
  description: "Les cookies et les données gardées dans ton navigateur par Pixolud, et comment les effacer.",
};

const COOKIES: { name: string; role: string; life: string; kind: string }[] = [
  { name: "sb-…-auth-token", role: "Te garder connecté à ton compte.", life: "1 an, ou jusqu'à la déconnexion", kind: "Nécessaire" },
  { name: "pixolud_lang", role: "Retenir la langue choisie.", life: "1 an", kind: "Nécessaire" },
  { name: "pixolud_triches", role: "Mémoriser les outils de triche activés (comptes admin uniquement).", life: "1 an", kind: "Nécessaire" },
];

const STORAGE: { name: string; role: string }[] = [
  { name: "pixolud-duel-profil", role: "Ta progression du Duel : pièces, expérience, tenues, danses." },
  { name: "pixolud-duel-entrainement", role: "Tes records au stand d'entraînement." },
  { name: "pixolud-cubes-v1", role: "Ton monde de Cubes : terrain, blocs posés, inventaire." },
  { name: "pixolud-invite", role: "Le numéro qui te sert de nom quand tu joues sans compte (« Joueur 482193 »)." },
  { name: "pixolud-reglages-3d", role: "Tes réglages des jeux 3D : clavier, sensibilité, luminosité." },
  { name: "pixolud-cookies-vu", role: "Se souvenir que tu as lu le bandeau d'information." },
];

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Vie privée"
      title="Cookies et données du navigateur"
      intro="Pixolud n'utilise aucun cookie publicitaire, aucun traceur et aucun outil de mesure d'audience tiers. Seuls des cookies nécessaires au fonctionnement du site sont déposés, plus quelques données gardées dans ton navigateur pour sauvegarder tes parties."
      highlights={[
        { icon: "🚫", text: "Aucune publicité, aucun traceur, aucune revente de données." },
        { icon: "✅", text: "Seulement des cookies nécessaires : ton consentement n'est pas requis pour ceux-là." },
        { icon: "🎮", text: "Tes parties (Duel, Cubes) sont sauvegardées dans ton navigateur, pas sur nos serveurs." },
        { icon: "🧹", text: "Tu peux tout effacer à tout moment depuis ton navigateur." },
      ]}
      sections={[
        {
          id: "cookies",
          title: "Les cookies déposés",
          body: (
            <>
              <p>
                Un cookie est un petit fichier que le site dépose dans ton navigateur. Ceux de Pixolud sont
                « strictement nécessaires » : sans eux, la connexion ou la langue ne fonctionneraient pas. La réglementation
                française (article 82 de la loi Informatique et Libertés) n&apos;exige pas de consentement pour ceux-là, mais
                elle exige de t&apos;en informer : c&apos;est le but de cette page.
              </p>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--portal-line)]">
                      <th className="py-2 pr-3 font-bold">Nom</th>
                      <th className="py-2 pr-3 font-bold">À quoi il sert</th>
                      <th className="py-2 pr-3 font-bold">Durée</th>
                      <th className="py-2 font-bold">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIES.map((c) => (
                      <tr key={c.name} className="border-b border-[var(--portal-line)]/60">
                        <td className="py-2 pr-3 font-mono">{c.name}</td>
                        <td className="py-2 pr-3">{c.role}</td>
                        <td className="py-2 pr-3">{c.life}</td>
                        <td className="py-2">{c.kind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          id: "navigateur",
          title: "Ce qui est gardé dans ton navigateur",
          body: (
            <>
              <p>
                Les jeux enregistrent ta progression sur ton appareil (stockage local), et non sur nos serveurs. Ces données
                ne sont envoyées à personne : elles restent dans ton navigateur.
              </p>
              <ul>
                {STORAGE.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong> — {s.role}
                  </li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: "effacer",
          title: "Tout effacer",
          body: (
            <>
              <p>
                Dans ton navigateur, ouvre les paramètres, puis <em>Confidentialité et sécurité</em> →{" "}
                <em>Effacer les données de navigation</em>, et choisis « Cookies et données de sites ». Tu peux aussi n&apos;effacer
                que Pixolud : clique sur le cadenas à gauche de l&apos;adresse, puis sur <em>Cookies et données de site</em>.
              </p>
              <p>
                Attention : effacer ces données déconnecte ton compte et efface tes parties de Duel et de Cubes sauvegardées sur
                cet appareil. Dans Cubes, tu peux d&apos;abord exporter ton monde depuis le menu du jeu.
              </p>
            </>
          ),
        },
        {
          id: "tiers",
          title: "Services tiers",
          body: (
            <p>
              Le site est hébergé par Vercel et utilise Supabase pour les comptes et la base de données. Ces prestataires
              peuvent enregistrer des journaux techniques (adresse IP, date, page demandée) nécessaires à la sécurité et au
              bon fonctionnement du service. Aucun réseau publicitaire, aucun bouton de réseau social et aucun outil de
              statistiques tiers n&apos;est installé sur le site.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Une question ?",
          body: <ContactLine email={CONTACT_EMAIL} />,
        },
      ]}
    />
  );
}
