"use client";

import { SECRET_CODES, useFoundCodes } from "@/lib/fun";

/**
 * La chasse aux codes secrets.
 *
 * On montre les indices, jamais les codes : sinon il n'y a plus rien a
 * chercher. Un code trouve s'affiche en clair, avec ce qu'il debloque — et
 * comme le retaper l'eteint, cette liste sert aussi d'interrupteur.
 *
 * Les codes vivent dans ce navigateur (localStorage) : ils ne sont pas lies
 * au compte, et rien n'est envoye au serveur.
 */
export default function SecretCodes() {
  const trouves = useFoundCodes();

  return (
    <section className="secret-codes-panel mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
        Codes secrets{" "}
        <span className="font-normal text-zinc-500 dark:text-zinc-400">
          {trouves.length} / {SECRET_CODES.length} trouvés
        </span>
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Tape-les au clavier n&apos;importe où sur le site (pas dans un champ de texte). Retaper un code l&apos;éteint.
      </p>

      <ul className="codes-list mt-4">
        {SECRET_CODES.map((c) => {
          const trouve = trouves.includes(c.id);
          return (
            <li key={c.id} className={trouve ? "is-found" : undefined}>
              <span aria-hidden="true">{trouve ? "🔓" : "🔒"}</span>
              <span>
                <strong>{trouve ? c.label : "Code mystère"}</strong>
                <em>{trouve ? c.recompense : c.indice}</em>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
