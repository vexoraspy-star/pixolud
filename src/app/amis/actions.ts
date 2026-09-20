"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Amis et messages.
 *
 * Tout passe par la session de la personne connectee : ce sont les regles de
 * la base (supabase/add_amis_chat.sql) qui decident, pas ce fichier. Un
 * joueur ne peut donc pas lire une conversation qui n'est pas la sienne,
 * meme en appelant ces actions a la main.
 */

export interface AmisResult {
  ok: boolean;
  message: string;
}

export interface ChatMessage {
  id: string;
  texte: string;
  deMoi: boolean;
  le: string;
}

const MANQUE = "Le chat n'est pas encore activé sur le site. Lance supabase/add_amis_chat.sql dans Supabase.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function absent(message: string) {
  return /relation|schema cache|does not exist/i.test(message);
}

async function moi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Chercher quelqu'un par son pseudo pour l'ajouter. */
export async function chercherJoueurs(q: string): Promise<{ id: string; pseudo: string; verified: boolean }[]> {
  const terme = q.trim();
  if (terme.length < 2) return [];
  const { supabase, user } = await moi();
  if (!user) return [];
  const motif = terme.replace(/[\\%_*]/g, "\\$&");
  const { data } = await supabase
    .from("profiles")
    .select("id, pseudo, verified")
    .ilike("pseudo", `%${motif}%`)
    .limit(12);
  return (data ?? [])
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: String(p.id), pseudo: String(p.pseudo), verified: p.verified === true }));
}

/** Envoyer une demande d'ami. */
export async function demanderAmi(autreId: string): Promise<AmisResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(autreId) || autreId === user.id) return { ok: false, message: "Joueur introuvable." };

  const [a, b] = [user.id, autreId].sort();
  const { error } = await supabase.from("friendships").insert({ a_id: a, b_id: b, requested_by: user.id, status: "en_attente" });
  if (error) {
    if (absent(error.message)) return { ok: false, message: MANQUE };
    if (/duplicate|unique/i.test(error.message)) return { ok: false, message: "Vous êtes déjà amis, ou une demande est en attente." };
    return { ok: false, message: "Demande impossible." };
  }
  revalidatePath("/amis");
  return { ok: true, message: "Demande envoyée." };
}

/** Accepter une demande recue. */
export async function accepterAmi(id: string): Promise<AmisResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(id)) return { ok: false, message: "Demande introuvable." };
  const { error } = await supabase.from("friendships").update({ status: "acceptee" }).eq("id", id);
  if (error) return { ok: false, message: absent(error.message) ? MANQUE : "Impossible d'accepter." };
  revalidatePath("/amis");
  return { ok: true, message: "Vous êtes amis !" };
}

/** Refuser une demande, ou retirer quelqu'un de ses amis. */
export async function retirerAmi(id: string): Promise<AmisResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(id)) return { ok: false, message: "Introuvable." };
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) return { ok: false, message: absent(error.message) ? MANQUE : "Impossible." };
  revalidatePath("/amis");
  return { ok: true, message: "C'est fait." };
}

/** Les messages d'une conversation, du plus ancien au plus recent. */
export async function lireMessages(friendshipId: string): Promise<ChatMessage[]> {
  const { supabase, user } = await moi();
  if (!user || !UUID_RE.test(friendshipId)) return [];
  const { data } = await supabase
    .from("messages")
    .select("id, text, sender_id, created_at")
    .eq("friendship_id", friendshipId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? [])
    .map((m) => ({
      id: String(m.id),
      texte: String(m.text ?? ""),
      deMoi: m.sender_id === user.id,
      le: String(m.created_at ?? ""),
    }))
    .reverse();
}

/** Envoyer un message a un ami. */
export async function envoyerMessage(friendshipId: string, texte: string): Promise<AmisResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  const propre = texte.trim().slice(0, 1000);
  if (!propre) return { ok: false, message: "Écris quelque chose." };
  if (!UUID_RE.test(friendshipId)) return { ok: false, message: "Conversation introuvable." };
  const { error } = await supabase.from("messages").insert({ friendship_id: friendshipId, sender_id: user.id, text: propre });
  if (error) {
    if (absent(error.message)) return { ok: false, message: MANQUE };
    if (/row-level security/i.test(error.message)) return { ok: false, message: "Vous n'êtes plus amis." };
    return { ok: false, message: "Message non envoyé." };
  }
  return { ok: true, message: "" };
}
