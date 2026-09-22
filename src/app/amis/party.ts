"use server";

import { createClient } from "@/lib/supabase/server";
import { moderer } from "@/lib/moderation";

/**
 * Le mode party : un groupe d'amis qui discutent, meme quand ils ne sont pas
 * dans le meme jeu.
 *
 * Un groupe a un chef — celui qui l'a cree. Le chef est le seul a pouvoir
 * renommer, inviter, exclure et dissoudre ; les autres peuvent parler et
 * partir. Ces droits sont ecrits dans la base (voir add_profil_et_party.sql),
 * pas seulement ici : meme en appelant ces actions a la main, un membre ne
 * peut pas exclure quelqu'un.
 */

export interface PartyMembre {
  userId: string;
  pseudo: string;
  avatarUrl: string | null;
  frame: string;
  chef: boolean;
}

export interface PartyMessage {
  id: string;
  texte: string;
  auteur: string;
  deMoi: boolean;
  le: string;
}

export interface PartyEtat {
  /** Null quand on n'est dans aucun groupe. */
  party: { id: string; nom: string; jeSuisChef: boolean } | null;
  membres: PartyMembre[];
  /** Faux quand le fichier SQL n'a pas encore ete lance. */
  pret: boolean;
}

export interface PartyResult {
  ok: boolean;
  message: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MANQUE = "Le mode party n'est pas encore activé : lance supabase/add_profil_et_party.sql dans Supabase.";

function absent(message: string) {
  return /relation|schema cache|does not exist|function/i.test(message);
}

async function moi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Le groupe auquel j'appartiens, avec ses membres. */
export async function monParty(): Promise<PartyEtat> {
  const { supabase, user } = await moi();
  if (!user) return { party: null, membres: [], pret: true };

  const { data: liens, error } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", user.id)
    .limit(1);
  if (error) return { party: null, membres: [], pret: !absent(error.message) };
  const partyId = liens?.[0]?.party_id;
  if (!partyId) return { party: null, membres: [], pret: true };

  const { data: party } = await supabase.from("parties").select("id, nom, leader_id").eq("id", partyId).maybeSingle();
  if (!party) return { party: null, membres: [], pret: true };

  const { data: membres } = await supabase.from("party_members").select("user_id").eq("party_id", partyId);
  const ids = (membres ?? []).map((m) => String(m.user_id));
  const { data: profils } = ids.length
    ? await supabase.from("profiles").select("id, pseudo, avatar_url, frame").in("id", ids)
    : { data: [] };

  return {
    party: { id: String(party.id), nom: String(party.nom), jeSuisChef: party.leader_id === user.id },
    membres: (profils ?? [])
      .map((p) => ({
        userId: String(p.id),
        pseudo: String(p.pseudo ?? "?"),
        avatarUrl: (p.avatar_url as string | null) ?? null,
        frame: String(p.frame ?? "aucun"),
        chef: p.id === party.leader_id,
      }))
      .sort((a, b) => Number(b.chef) - Number(a.chef) || a.pseudo.localeCompare(b.pseudo, "fr")),
    pret: true,
  };
}

/** Creer un groupe : celui qui cree en devient le chef. */
export async function creerParty(nomIn: string): Promise<PartyResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  const nom = nomIn.trim().slice(0, 40) || "Ma party";

  const deja = await monParty();
  if (deja.party) return { ok: false, message: "Tu es déjà dans une party. Quitte-la d'abord." };

  const { data, error } = await supabase.from("parties").insert({ nom, leader_id: user.id }).select("id").single();
  if (error || !data) return { ok: false, message: absent(error?.message ?? "") ? MANQUE : "Création impossible." };

  const { error: e2 } = await supabase.from("party_members").insert({ party_id: data.id, user_id: user.id });
  if (e2) return { ok: false, message: "Création impossible." };
  return { ok: true, message: `« ${nom} » est créée. Invite tes amis !` };
}

/** Le chef ajoute un ami au groupe. */
export async function inviterAuParty(partyId: string, amiId: string): Promise<PartyResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(partyId) || !UUID_RE.test(amiId)) return { ok: false, message: "Introuvable." };

  // Seulement un vrai ami : une party n'est pas un moyen d'ecrire a un
  // inconnu qui n'a rien demande.
  const [a, b] = [user.id, amiId].sort();
  const { data: amitie } = await supabase
    .from("friendships")
    .select("id")
    .eq("a_id", a)
    .eq("b_id", b)
    .eq("status", "acceptee")
    .maybeSingle();
  if (!amitie) return { ok: false, message: "Vous devez d'abord être amis." };

  const { error } = await supabase.from("party_members").insert({ party_id: partyId, user_id: amiId });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, message: "Il est déjà dans la party." };
    if (/row-level security/i.test(error.message)) return { ok: false, message: "Seul le chef peut inviter." };
    return { ok: false, message: absent(error.message) ? MANQUE : "Invitation impossible." };
  }
  return { ok: true, message: "C'est fait : il est dans la party." };
}

/** Partir de son plein gre, ou exclure quelqu'un (chef seulement). */
export async function quitterParty(partyId: string, qui?: string): Promise<PartyResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(partyId)) return { ok: false, message: "Introuvable." };
  const cible = qui && UUID_RE.test(qui) ? qui : user.id;

  const { data: party } = await supabase.from("parties").select("leader_id").eq("id", partyId).maybeSingle();

  // Le chef qui part dissout le groupe : sans chef, plus personne ne peut
  // inviter, et un groupe fantome reste dans la liste de tout le monde.
  if (party?.leader_id === user.id && cible === user.id) {
    const { error } = await supabase.from("parties").delete().eq("id", partyId);
    if (error) return { ok: false, message: "Impossible de dissoudre la party." };
    return { ok: true, message: "La party est dissoute." };
  }

  const { error } = await supabase.from("party_members").delete().eq("party_id", partyId).eq("user_id", cible);
  if (error) return { ok: false, message: "Action impossible." };
  return { ok: true, message: cible === user.id ? "Tu as quitté la party." : "Membre exclu." };
}

/** Le chef renomme le groupe. */
export async function renommerParty(partyId: string, nomIn: string): Promise<PartyResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(partyId)) return { ok: false, message: "Introuvable." };
  const nom = nomIn.trim().slice(0, 40);
  if (!nom) return { ok: false, message: "Donne un nom." };
  if (moderer(nom).verdict === "bloquer") return { ok: false, message: "Ce nom n'est pas acceptable." };

  const { error } = await supabase.from("parties").update({ nom }).eq("id", partyId);
  if (error) return { ok: false, message: "Seul le chef peut renommer." };
  return { ok: true, message: "Nom changé." };
}

/** Les messages du groupe, du plus ancien au plus recent. */
export async function lireParty(partyId: string): Promise<PartyMessage[]> {
  const { supabase, user } = await moi();
  if (!user || !UUID_RE.test(partyId)) return [];

  const { data } = await supabase
    .from("party_messages")
    .select("id, text, sender_id, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })
    .limit(120);
  const lignes = data ?? [];
  const ids = [...new Set(lignes.map((m) => String(m.sender_id)))];
  const { data: profils } = ids.length
    ? await supabase.from("profiles").select("id, pseudo").in("id", ids)
    : { data: [] };
  const nom = new Map((profils ?? []).map((p) => [String(p.id), String(p.pseudo)]));

  return lignes
    .map((m) => ({
      id: String(m.id),
      texte: String(m.text ?? ""),
      auteur: nom.get(String(m.sender_id)) ?? "?",
      deMoi: m.sender_id === user.id,
      le: String(m.created_at ?? ""),
    }))
    .reverse();
}

/** Ecrire dans le groupe. Meme moderation que le chat prive. */
export async function envoyerAuParty(partyId: string, texte: string): Promise<PartyResult> {
  const { supabase, user } = await moi();
  if (!user) return { ok: false, message: "Connecte-toi d'abord." };
  if (!UUID_RE.test(partyId)) return { ok: false, message: "Introuvable." };
  const brut = texte.trim().slice(0, 1000);
  if (!brut) return { ok: false, message: "Écris quelque chose." };

  const avis = moderer(brut);
  if (avis.verdict === "bloquer") return { ok: false, message: avis.message };

  const { error } = await supabase
    .from("party_messages")
    .insert({ party_id: partyId, sender_id: user.id, text: avis.texte });
  if (error) {
    if (/row-level security/i.test(error.message)) return { ok: false, message: "Tu n'es plus dans cette party." };
    return { ok: false, message: absent(error.message) ? MANQUE : "Message non envoyé." };
  }
  return { ok: true, message: avis.message };
}
