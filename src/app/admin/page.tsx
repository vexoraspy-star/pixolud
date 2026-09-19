import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import AdminPanel from "@/components/AdminPanel";
import { loadAdminData } from "./data";

export const metadata: Metadata = {
  title: "Panneau admin — Pixolud",
  robots: { index: false, follow: false },
};

/**
 * Panneau admin. Un non-admin tombe sur une page introuvable (requireAdmin) ;
 * les donnees ne sont lues qu'ensuite, avec la cle secrete, cote serveur.
 */
export default async function AdminPage() {
  const me = await requireAdmin();
  // Sans la cle secrete sur le serveur (Vercel), rien ne peut se faire :
  // on explique quoi faire plutot que d'afficher une page d'erreur.
  if (!process.env.SUPABASE_SECRET_KEY) {
    return (
      <div className="portal-container portal-page">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/50 bg-amber-400/10 p-6 text-sm leading-6">
          <h1 className="text-2xl font-extrabold">Panneau admin : une clé manque</h1>
          <p className="mt-3">
            Sur Vercel, ouvre ton projet → <b>Settings</b> → <b>Environment Variables</b>, ajoute <code>SUPABASE_SECRET_KEY</code> avec la
            clé secrète de Supabase (<i>Project Settings → API Keys</i>), puis relance un déploiement. Ne mets jamais cette clé dans une
            variable qui commence par <code>NEXT_PUBLIC_</code>.
          </p>
        </div>
      </div>
    );
  }
  return <AdminPanel data={await loadAdminData(me)} />;
}
