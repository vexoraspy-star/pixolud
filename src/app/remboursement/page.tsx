import type { Metadata } from "next";
import LegalPage, { ContactLine } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Paiements et remboursement — Pixolud",
  description: "Pixolud est gratuit. Ce qui s'appliquera le jour où une offre payante existera : droit de rétractation et remboursement.",
};

export default function RemboursementPage() {
  return (
    <LegalPage
      eyebrow="Paiements"
      title="Paiements et remboursement"
      intro="Aujourd'hui, tout Pixolud est gratuit : aucun paiement n'est possible sur le site, et aucune donnée bancaire n'est demandée ni conservée. Cette page explique ce qui s'appliquera si une offre payante voit le jour."
      highlights={[
        { icon: "🆓", text: "Le site est gratuit : rien n'est à payer aujourd'hui." },
        { icon: "💳", text: "Aucune carte bancaire n'est demandée ni stockée." },
        { icon: "↩️", text: "Le jour où une offre payante existera : 14 jours pour changer d'avis." },
        { icon: "📩", text: "Un remboursement se demandera par un simple message." },
      ]}
      sections={[
        {
          id: "aujourdhui",
          title: "Aujourd'hui : tout est gratuit",
          body: (
            <>
              <p>
                Les paliers affichés sur la page <a href="/premium">Premium</a> (Standard et Max) ne sont pas vendus : aucun
                moyen de paiement n&apos;est branché sur le site. Personne ne peut donc être débité, et aucune donnée bancaire
                n&apos;est collectée.
              </p>
              <p>
                Si tu vois un site ou une personne te réclamer de l&apos;argent au nom de Pixolud, c&apos;est une arnaque :
                signale-le par la page <a href="/signalement">Signaler un contenu</a>.
              </p>
            </>
          ),
        },
        {
          id: "retractation",
          title: "Droit de rétractation (14 jours)",
          body: (
            <>
              <p>
                Le jour où une offre payante existera, tu auras <strong>14 jours</strong> pour changer d&apos;avis sans avoir à
                te justifier (articles L221-18 et suivants du code de la consommation), à compter du paiement.
              </p>
              <p>
                Exception prévue par la loi : si tu demandes à profiter immédiatement du contenu numérique et que tu acceptes
                expressément de perdre ce droit, la rétractation ne s&apos;applique plus une fois le service fourni. La case
                correspondante ne sera jamais cochée à l&apos;avance.
              </p>
            </>
          ),
        },
        {
          id: "rembourser",
          title: "Demander un remboursement",
          body: (
            <>
              <p>Il suffira d&apos;un message indiquant ton pseudo et la date du paiement. Aucun formulaire compliqué.</p>
              <p>
                Le remboursement se fera sur le moyen de paiement utilisé, sous 14 jours après acceptation de la demande.
              </p>
            </>
          ),
        },
        {
          id: "mineurs",
          title: "Si tu as moins de 18 ans",
          body: (
            <p>
              Un achat ne pourra être fait qu&apos;avec l&apos;accord de tes parents ou de ton responsable légal. Si un paiement
              a été fait sans leur accord, ils pourront en demander l&apos;annulation et le remboursement complet.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Nous écrire",
          body: <ContactLine email={CONTACT_EMAIL} />,
        },
      ]}
    />
  );
}
