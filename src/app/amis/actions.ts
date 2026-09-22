"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderer } from "@/lib/moderation";

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

export interface AmiLigne {
  /** Identifiant de l'amitie : c'est aussi celui de la conversation. */
  id: string;
  userId: string;
  pseudo: string;
  verified: boolean;
  avatarUrl: string | null;
  frame: string;
}

/**
 * Mes amis et mes demandes, pour le panneau flottant.
 *
 * La page /amis fait le meme travail cote serveur ; cette action existe pour
 * que le panneau puisse se rafraichir sans recharger la page.
 */
export async function mesAmis(): Promise<{
  amis: AmiLigne[];
  recues: AmiLigne[];
  envoyees: AmiLigne[];
  pret: boolean;
}> {
  const { supabase, user } = await moi();
  const vide = { amis: [], recues: [], envoyees: [], pret: true };
  if (!user) return vide;

  const { data: liens, error } = await supabase
    .from("friendships")
    .select("id, a_id, b_id, requested_by, status")
    .order("created_at", { ascending: false });
  if (error) return { ...vide, pret: !absent(error.message) };

  const lignes = (liens ?? []) as { id: string; a_id: string; b_id: string; requested_by: string; status: string }[];
  const autres = lignes.map((l) => (l.a_id === user.id ? l.b_id : l.a_id));
  const { data: profils } = autres.length
    ? await supabase.from("profiles").select("id, pseudo, verified, avatar_url, frame").in("id", autres)
    : { data: [] };
  const parId = new Map((profils ?? []).map((p) => [String(p.id), p]));

  const amis: AmiLigne[] = [];
  const recues: AmiLigne[] = [];
  const envoyees: AmiLigne[] = [];
  for (const l of lignes) {
    const autre = parId.get(l.a_id === user.id ? l.b_id : l.a_id);
    const ligne: AmiLigne = {
      id: l.id,
      userId: String(autre?.id ?? ""),
      pseudo: String(autre?.pseudo ?? "?"),
      verified: autre?.verified === true,
      avatarUrl: (autre?.avatar_url as string | null) ?? null,
      frame: String(autre?.frame ?? "aucun"),
    };
    if (l.status === "acceptee") amis.push(ligne);
    else if (l.requested_by === user.id) envoyees.push(ligne);
    else recues.push(ligne);
  }
  amis.sort((x, y) => x.pseudo.localeCompare(y.pseudo, "fr"));
  return { amis, recues, envoyees, pret: true };
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

/**
 * Garder une trace d'un message refuse ou signale, pour le panneau admin.
 *
 * Ecrit avec la cle secrete : le joueur n'a aucun acces a ce journal, et ne
 * peut donc pas effacer ce qu'il vient d'ecrire. Si la table n'existe pas
 * encore, on continue : la moderation doit marcher sans elle.
 */
async function journal(authorId: string, verdict: string, motif: string, texte: string) {
  try {
    await createAdminClient()
      .from("moderation_log")
      .insert({ author_id: authorId, endroit: "chat", verdict, motif, texte: texte.slice(0, 1000) });
  } catch {
    // Pas de cle secrete ou pas de table : la moderation a deja fait son
    // travail, le journal n'est qu'un confort pour l'equipe.
  }
}

/** Envoyer un message a un ami. */
export async function envoyerMessage(friendshipId: string, texte: string): Promise<AmisResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  const brut = texte.trim().slice(0, 1000);
  if (!brut) return { ok: false, message: "Écris quelque chose." };
  if (!UUID_RE.test(friendshipId)) return { ok: false, message: "Conversation introuvable." };

  // Moderation : ferme sur ce qui blesse, permissive sur le reste (le detail
  // est dans src/lib/moderation.ts). Un message bloque ne part pas du tout.
  const avis = moderer(brut);
  if (avis.verdict !== "ok") await journal(user.id, avis.verdict, avis.motif, brut);
  if (avis.verdict === "bloquer") return { ok: false, message: avis.message };
  const propre = avis.texte;

  const { error } = await supabase.from("messages").insert({ friendship_id: friendshipId, sender_id: user.id, text: propre });
  if (error) {
    if (absent(error.message)) return { ok: false, message: MANQUE };
    if (/row-level security/i.test(error.message)) return { ok: false, message: "Vous n'êtes plus amis." };
    return { ok: false, message: "Message non envoyé." };
  }
  // `avis.message` est vide quand tout va bien, et porte le rappel quand on a
  // masque des coordonnees ou signale un debordement.
  return { ok: true, message: avis.message };
}
