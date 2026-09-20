import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendsClient, { type Ami, type Demande } from "@/components/FriendsClient";

export const metadata: Metadata = {
  title: "Mes amis — Pixolud",
  description: "Ajoute tes amis sur Pixolud et discutez ensemble.",
  robots: { index: false, follow: true },
};

type Row = { id: string; a_id: string; b_id: string; requested_by: string; status: string; created_at: string };

export default async function AmisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: rows, error } = await supabase
    .from("friendships")
    .select("id, a_id, b_id, requested_by, status, created_at")
    .order("created_at", { ascending: false });

  // Sans la table (fichier SQL pas encore lance), la page le dit simplement.
  const pret = !error;
  const liens = (rows ?? []) as Row[];

  const autres = liens.map((l) => (l.a_id === user.id ? l.b_id : l.a_id));
  const { data: profils } = autres.length
    ? await supabase.from("profiles").select("id, pseudo, verified").in("id", autres)
    : { data: [] };
  const parId = new Map((profils ?? []).map((p) => [String(p.id), p]));

  const amis: Ami[] = [];
  const recues: Demande[] = [];
  const envoyees: Demande[] = [];
  for (const l of liens) {
    const autre = parId.get(l.a_id === user.id ? l.b_id : l.a_id);
    const base = {
      id: l.id,
      pseudo: String(autre?.pseudo ?? "?"),
      userId: String(autre?.id ?? ""),
      verified: autre?.verified === true,
    };
    if (l.status === "acceptee") amis.push(base);
    else if (l.requested_by === user.id) envoyees.push(base);
    else recues.push(base);
  }
  amis.sort((x, y) => x.pseudo.localeCompare(y.pseudo, "fr"));

  return <FriendsClient amis={amis} recues={recues} envoyees={envoyees} pret={pret} />;
}
