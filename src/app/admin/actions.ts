"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHEAT_COOKIE, CHEAT_GAMES, currentAdmin } from "@/lib/admin";
import type { AdminData } from "@/components/AdminPanel";
import { loadAdminData } from "./data";

/**
 * Actions du panneau admin.
 *
 * Une action serveur est une adresse que n'importe qui peut appeler : chacune
 * revérifie donc, cote serveur, que la personne connectee est admin AVANT de
 * toucher a quoi que ce soit (voir `run`). Les ecritures passent par la cle
 * secrete, qui ignore les regles RLS.
 */

export interface AdminResult {
  ok: boolean;
  message: string;
}

interface Ctx {
  admin: { id: string; pseudo: string };
  db: SupabaseClient;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PSEUDO_RE = /^[\p{L}\p{N}_.-]{3,24}$/u;
const MIGRATION_HINT = "Exécute d'abord le fichier supabase/add_admin_panel.sql dans Supabase (SQL Editor).";

/** Durees de bannissement : cote Supabase Auth, et en millisecondes pour le profil. */
const BAN_DURATIONS: Record<string, { auth: string; ms: number | null; label: string }> = {
  "1j": { auth: "24h", ms: 86_400_000, label: "1 jour" },
  "7j": { auth: "168h", ms: 7 * 86_400_000, label: "7 jours" },
  "30j": { auth: "720h", ms: 30 * 86_400_000, label: "30 jours" },
  definitif: { auth: "876000h", ms: null, label: "définitif" },
};

class AdminError extends Error {}

async function run(action: string, target: string, fn: (ctx: Ctx) => Promise<string>): Promise<AdminResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Réservé aux administrateurs." };
  const db = createAdminClient();
  try {
    const message = await fn({ admin, db });
    // Journal : sans la table (fichier SQL pas encore lance), on continue.
    await db.from("admin_log").insert({ admin_id: admin.id, action, target, details: message });
    revalidatePath("/admin");
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: e instanceof AdminError ? e.message : "L'action a échoué. Réessaie." };
  }
}

function checkId(id: string) {
  if (!UUID_RE.test(id)) throw new AdminError("Identifiant invalide.");
}

async function profileOf(db: SupabaseClient, id: string): Promise<{ id: string; pseudo: string; is_admin: boolean }> {
  checkId(id);
  const { data } = await db.from("profiles").select("id, pseudo, is_admin").eq("id", id).maybeSingle();
  if (!data) throw new AdminError("Compte introuvable.");
  return data as { id: string; pseudo: string; is_admin: boolean };
}

async function pseudoFree(db: SupabaseClient, pseudo: string, exceptId?: string) {
  const { data } = await db.from("profiles").select("id, pseudo").ilike("pseudo", pseudo.replace(/[\\%_*]/g, "\\$&"));
  const taken = (data ?? []).some(
    (p: { id: string; pseudo: string }) => p.pseudo.toLowerCase() === pseudo.toLowerCase() && p.id !== exceptId,
  );
  if (taken) throw new AdminError(`Le pseudo « ${pseudo} » est déjà pris.`);
}

function checkPseudo(pseudo: string) {
  if (!PSEUDO_RE.test(pseudo)) {
    throw new AdminError("Pseudo invalide : 3 à 24 caractères, lettres, chiffres, point, tiret ou soulignement.");
  }
}

/** Une ecriture sur une colonne ajoutee par le fichier SQL : message clair s'il manque. */
async function updateProfile(db: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await db.from("profiles").update(values).eq("id", id);
  if (error) {
    if (/column|schema cache/i.test(error.message)) throw new AdminError(MIGRATION_HINT);
    if (/duplicate|unique/i.test(error.message)) throw new AdminError("Ce pseudo est déjà pris.");
    throw new AdminError("Impossible de modifier ce profil.");
  }
}

/** Donnees du panneau pour la fenetre compacte (bouton 🛡) : admins seulement. */
export async function getAdminPanelData(): Promise<AdminData | null> {
  const admin = await currentAdmin();
  if (!admin || !process.env.SUPABASE_SECRET_KEY) return null;
  return loadAdminData(admin);
}

// ------------------------------------------------------------------ joueurs

export async function renameUser(id: string, newPseudo: string): Promise<AdminResult> {
  const pseudo = newPseudo.trim();
  return run("renommer", id, async ({ db }) => {
    const p = await profileOf(db, id);
    checkPseudo(pseudo);
    await pseudoFree(db, pseudo, id);
    await updateProfile(db, id, { pseudo });
    await db.auth.admin.updateUserById(id, { user_metadata: { pseudo } });
    return `« ${p.pseudo} » s'appelle maintenant « ${pseudo} ».`;
  });
}

export async function setTier(id: string, tier: string): Promise<AdminResult> {
  return run("palier", id, async ({ db }) => {
    if (!["free", "standard", "max"].includes(tier)) throw new AdminError("Palier invalide.");
    const p = await profileOf(db, id);
    await updateProfile(db, id, { tier });
    return `${p.pseudo} passe au palier ${tier === "free" ? "Gratuit" : tier === "standard" ? "Standard" : "Max"}.`;
  });
}

export async function setAdminRole(id: string, on: boolean): Promise<AdminResult> {
  return run(on ? "donner-admin" : "retirer-admin", id, async ({ db, admin }) => {
    const p = await profileOf(db, id);
    if (!on && id === admin.id) throw new AdminError("Tu ne peux pas te retirer tes propres droits admin.");
    await updateProfile(db, id, { is_admin: on });
    return on ? `${p.pseudo} est maintenant admin.` : `${p.pseudo} n'est plus admin.`;
  });
}

export async function setVerified(id: string, on: boolean): Promise<AdminResult> {
  return run(on ? "verifier" : "retirer-verif", id, async ({ db }) => {
    const p = await profileOf(db, id);
    await updateProfile(db, id, { verified: on });
    return on ? `${p.pseudo} a le badge vérifié.` : `${p.pseudo} n'a plus le badge vérifié.`;
  });
}

export async function confirmEmail(id: string): Promise<AdminResult> {
  return run("confirmer-email", id, async ({ db }) => {
    const p = await profileOf(db, id);
    const { error } = await db.auth.admin.updateUserById(id, { email_confirm: true });
    if (error) throw new AdminError("Impossible de confirmer ce compte.");
    return `Compte de ${p.pseudo} activé : plus besoin du lien reçu par e-mail.`;
  });
}

export async function setPassword(id: string, password: string): Promise<AdminResult> {
  return run("mot-de-passe", id, async ({ db }) => {
    const p = await profileOf(db, id);
    if (password.length < 8) throw new AdminError("Le mot de passe doit faire au moins 8 caractères.");
    const { error } = await db.auth.admin.updateUserById(id, { password });
    if (error) throw new AdminError("Impossible de changer le mot de passe.");
    return `Nouveau mot de passe enregistré pour ${p.pseudo}.`;
  });
}

export async function banUser(id: string, duration: string, reason: string, unpublish: boolean): Promise<AdminResult> {
  return run("bannir", id, async ({ db, admin }) => {
    const p = await profileOf(db, id);
    if (id === admin.id) throw new AdminError("Tu ne peux pas te bannir toi-même.");
    if (p.is_admin) throw new AdminError("Retire d'abord ses droits admin.");
    const d = BAN_DURATIONS[duration];
    if (!d) throw new AdminError("Durée invalide.");
    const motif = reason.trim().slice(0, 300);
    // 1. Supabase Auth : il ne peut plus se connecter (ni rafraichir sa session).
    const { error } = await db.auth.admin.updateUserById(id, { ban_duration: d.auth });
    if (error) throw new AdminError("Le bannissement a échoué.");
    // 2. Le profil : motif et date, pour l'ecran « compte suspendu » et les regles.
    let note = "";
    try {
      await updateProfile(db, id, {
        banned: true,
        ban_reason: motif || null,
        banned_until: d.ms === null ? null : new Date(Date.now() + d.ms).toISOString(),
      });
    } catch {
      note = " (motif non enregistré : lance le fichier SQL du panneau)";
    }
    if (unpublish) await db.from("games").update({ published: false }).eq("author_id", id);
    return `${p.pseudo} est banni (${d.label})${unpublish ? ", ses jeux sont retirés" : ""}${note}.`;
  });
}

export async function unbanUser(id: string): Promise<AdminResult> {
  return run("debannir", id, async ({ db }) => {
    const p = await profileOf(db, id);
    const { error } = await db.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) throw new AdminError("Le débannissement a échoué.");
    try {
      await updateProfile(db, id, { banned: false, ban_reason: null, banned_until: null });
    } catch {
      // Colonnes absentes : le bannissement Auth est leve, c'est l'essentiel.
    }
    return `${p.pseudo} n'est plus banni.`;
  });
}

export async function deleteUser(id: string, confirmPseudo: string): Promise<AdminResult> {
  return run("supprimer-compte", id, async ({ db, admin }) => {
    const p = await profileOf(db, id);
    if (id === admin.id) throw new AdminError("Tu ne peux pas supprimer ton propre compte ici.");
    if (p.is_admin) throw new AdminError("Retire d'abord ses droits admin.");
    if (confirmPseudo.trim() !== p.pseudo) throw new AdminError("Le pseudo tapé ne correspond pas : rien n'a été supprimé.");
    // Le profil, ses jeux, commentaires et notes partent avec (cles en cascade).
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new AdminError("La suppression a échoué.");
    return `Le compte ${p.pseudo} est supprimé définitivement.`;
  });
}

/**
 * Creer un compte pour quelqu'un, avec ou sans e-mail. Sans e-mail, on lui
 * donne une adresse technique qui ne recoit rien : il se connecte avec son
 * PSEUDO et son mot de passe (la page de connexion accepte les deux).
 */
export async function createAccount(pseudoIn: string, password: string, emailIn: string, verified: boolean): Promise<AdminResult> {
  const pseudo = pseudoIn.trim();
  const email = emailIn.trim().toLowerCase();
  return run("creer-compte", pseudo, async ({ db }) => {
    checkPseudo(pseudo);
    if (password.length < 8) throw new AdminError("Le mot de passe doit faire au moins 8 caractères.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminError("Adresse e-mail invalide.");
    await pseudoFree(db, pseudo);
    const slug = pseudo.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "") || "joueur";
    const address = email || `${slug}.${crypto.randomUUID().slice(0, 8)}@sans-email.pixolud.vercel.app`;
    const { data, error } = await db.auth.admin.createUser({
      email: address,
      password,
      email_confirm: true,
      user_metadata: { pseudo },
    });
    if (error || !data.user) {
      throw new AdminError(/registered|exists/i.test(error?.message ?? "") ? "Cette adresse e-mail a déjà un compte." : "Création impossible.");
    }
    let note = "";
    if (verified) {
      try {
        await updateProfile(db, data.user.id, { verified: true });
      } catch {
        note = " Badge vérifié non posé : lance le fichier SQL du panneau.";
      }
    }
    return `Compte « ${pseudo} » créé. Il se connecte avec ${email ? `${email} ou ` : ""}son pseudo et ce mot de passe.${note}`;
  });
}

// ------------------------------------------------------------------ cadeaux

/** Offrir des pieces, de l'XP ou tout le casier du Duel a un joueur. */
export async function sendGift(id: string, kind: string, amountIn: number, messageIn: string): Promise<AdminResult> {
  return run("cadeau", id, async ({ db, admin }) => {
    const p = await profileOf(db, id);
    if (!["pieces", "xp", "tout"].includes(kind)) throw new AdminError("Cadeau invalide.");
    const amount = kind === "tout" ? 0 : Math.floor(Number(amountIn));
    if (kind !== "tout" && !(amount >= 1 && amount <= 1_000_000)) throw new AdminError("Montant entre 1 et 1 000 000.");
    const { error } = await db.from("admin_gifts").insert({
      user_id: id,
      game: "duel",
      kind,
      amount,
      message: messageIn.trim().slice(0, 200),
      created_by: admin.id,
    });
    if (error) {
      throw new AdminError(
        /relation|schema cache|does not exist/i.test(error.message)
          ? "Lance d'abord le fichier supabase/add_admin_gifts.sql dans Supabase (SQL Editor)."
          : "Envoi impossible.",
      );
    }
    const what = kind === "tout" ? "tout le casier du Duel" : kind === "pieces" ? `${amount.toLocaleString("fr-FR")} pièces` : `${amount.toLocaleString("fr-FR")} XP`;
    return `🎁 ${what} envoyé à ${p.pseudo} : il le reçoit en ouvrant le Duel.`;
  });
}

// --------------------------------------------------------------------- jeux

export async function setGamePublished(id: string, on: boolean): Promise<AdminResult> {
  return run(on ? "publier-jeu" : "depublier-jeu", id, async ({ db }) => {
    checkId(id);
    const { data, error } = await db.from("games").update({ published: on }).eq("id", id).select("title").maybeSingle();
    if (error || !data) throw new AdminError("Jeu introuvable.");
    return on ? `« ${data.title} » est de nouveau publié.` : `« ${data.title} » est retiré du catalogue.`;
  });
}

export async function deleteGame(id: string): Promise<AdminResult> {
  return run("supprimer-jeu", id, async ({ db }) => {
    checkId(id);
    const { data, error } = await db.from("games").delete().eq("id", id).select("title").maybeSingle();
    if (error || !data) throw new AdminError("Jeu introuvable.");
    return `« ${data.title} » est supprimé définitivement.`;
  });
}

// ------------------------------------------------------------ commentaires

export async function deleteComment(id: string): Promise<AdminResult> {
  return run("supprimer-commentaire", id, async ({ db }) => {
    checkId(id);
    const { data, error } = await db.from("comments").delete().eq("id", id).select("text").maybeSingle();
    if (error || !data) throw new AdminError("Commentaire introuvable.");
    return "Commentaire supprimé.";
  });
}

// ------------------------------------------------------------- signalements

export async function setReportStatus(id: string, status: string): Promise<AdminResult> {
  return run("signalement", id, async ({ db }) => {
    checkId(id);
    if (!["ouvert", "traité", "rejeté"].includes(status)) throw new AdminError("Statut invalide.");
    const { error } = await db.from("reports").update({ status }).eq("id", id);
    if (error) throw new AdminError("Signalement introuvable.");
    return `Signalement marqué « ${status} ».`;
  });
}

// ------------------------------------------------------------ triches en jeu

export async function setCheatGames(slugs: string[]): Promise<AdminResult> {
  return run("triches", slugs.join(",") || "aucune", async () => {
    const known = new Set<string>(CHEAT_GAMES.map((g) => g.slug));
    const kept = slugs.filter((s) => known.has(s));
    (await cookies()).set(CHEAT_COOKIE, kept.join(","), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return kept.length ? `Triches actives sur ce navigateur : ${kept.length} jeu${kept.length > 1 ? "x" : ""}.` : "Triches désactivées dans tous les jeux.";
  });
}
