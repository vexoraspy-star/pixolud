/**
 * Les informations legales du site, ecrites une seule fois et reprises par
 * les mentions legales, la confidentialite, les cookies et le remboursement.
 *
 * A COMPLETER par le proprietaire : l'adresse de contact et la region de la
 * base de donnees (Supabase → Project Settings → General → Region).
 */

/** Adresse a laquelle on peut ecrire (obligatoire : LCEN et RGPD). */
export const CONTACT_EMAIL = "";

/** Nom affiche de l'editeur du site. */
export const PUBLISHER = "Tarendra (Pixolud)";

/** Region ou vivent la base de donnees et les comptes. */
export const DATA_REGION = "Union européenne (à confirmer dans Supabase)";

export const HOSTS = [
  {
    name: "Vercel Inc.",
    role: "hébergement du site",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
  },
  {
    name: "Supabase Inc.",
    role: "comptes, base de données et fichiers",
    address: "970 Toa Payoh North #07-04, Singapour",
    site: "https://supabase.com",
  },
] as const;

export const LAST_UPDATE = "20 septembre 2026";
