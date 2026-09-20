import Link from "next/link";
import { LAST_UPDATE } from "@/lib/legal";

/**
 * Habillage commun des pages legales : un resume en haut (« l'essentiel »),
 * un sommaire cliquable, puis les sections numerotees. Meme presentation
 * partout, et lisible sur telephone.
 */

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export default function LegalPage({
  eyebrow,
  title,
  intro,
  highlights,
  sections,
  updated = LAST_UPDATE,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  /** Trois ou quatre phrases simples : l'essentiel sans lire la page entiere. */
  highlights?: { icon: string; text: string }[];
  sections: LegalSection[];
  updated?: string;
}) {
  return (
    <div className="portal-container portal-page legal-page">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--portal-accent)]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">{intro}</p>
        <p className="mt-2 text-xs text-[var(--portal-muted)]">Dernière mise à jour : {updated}</p>

        {highlights && highlights.length > 0 && (
          <div className="mt-8 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-surface)] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">L&apos;essentiel en 30 secondes</p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {highlights.map((h) => (
                <li key={h.text} className="flex gap-2.5 text-sm leading-6">
                  <span aria-hidden="true">{h.icon}</span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <nav aria-label="Sommaire" className="mt-8 rounded-2xl border border-[var(--portal-line)] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--portal-muted)]">Sommaire</p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[var(--portal-accent)] hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-9">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold">
                <span className="text-[var(--portal-accent)]">{i + 1}.</span> {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--portal-muted)] [&_a]:text-[var(--portal-accent)] [&_a]:underline [&_li]:mb-1 [&_strong]:text-[var(--portal-ink)] [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-[var(--portal-line)] pt-6 text-sm">
          <Link href="/mentions-legales" className="portal-button secondary small">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="portal-button secondary small">
            Confidentialité
          </Link>
          <Link href="/cookies" className="portal-button secondary small">
            Cookies
          </Link>
          <Link href="/cgu" className="portal-button secondary small">
            CGU
          </Link>
          <Link href="/remboursement" className="portal-button secondary small">
            Remboursement
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Adresse de contact, ou l'invitation a passer par le formulaire de signalement. */
export function ContactLine({ email }: { email: string }) {
  if (!email) {
    return (
      <p>
        En attendant qu&apos;une adresse de contact soit publiée, écris-nous par la page{" "}
        <Link href="/signalement">Signaler un contenu</Link> : elle arrive directement à l&apos;équipe.
      </p>
    );
  }
  return (
    <p>
      Écris à <a href={`mailto:${email}`}>{email}</a>. Nous répondons sous 30 jours au maximum.
    </p>
  );
}
