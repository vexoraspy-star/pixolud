"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { FRAMES, frameById, frameStyle } from "@/lib/frames";
import { tierAtLeast, type Tier } from "@/lib/tiers";
import { saveAvatar } from "@/app/parametres/actions";

/**
 * Choisir sa photo de profil et son cadre.
 *
 * La photo est redimensionnee DANS LE NAVIGATEUR avant l'envoi : on la
 * recadre en carre de 256 pixels et on la reencode en WebP. Une photo de
 * telephone fait 4 Mo ; apres passage ici, une vingtaine de kilo-octets. Ca
 * evite de remplir le stockage gratuit et ca rend la liste d'amis instantanee.
 */
const TAILLE = 256;

export default function AvatarPicker({
  pseudo,
  urlActuelle,
  frameActuel,
  tier,
}: {
  pseudo: string;
  urlActuelle: string | null;
  frameActuel: string;
  tier: Tier;
}) {
  const [url, setUrl] = useState(urlActuelle);
  const [frame, setFrame] = useState(frameActuel);
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [pending, start] = useTransition();
  const fichier = useRef<HTMLInputElement>(null);

  /** Recadrage carre centre + reencodage, dans un canvas. */
  async function reduire(f: File): Promise<Blob> {
    const bitmap = await createImageBitmap(f);
    const cote = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = TAILLE;
    canvas.height = TAILLE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(
      bitmap,
      (bitmap.width - cote) / 2,
      (bitmap.height - cote) / 2,
      cote,
      cote,
      0,
      0,
      TAILLE,
      TAILLE,
    );
    bitmap.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/webp", 0.86);
    });
  }

  async function choisirFichier(f: File | undefined) {
    if (!f) return;
    setNote(null);
    if (!f.type.startsWith("image/")) {
      setNote({ ok: false, message: "Choisis une image (jpg, png, webp…)." });
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setNote({ ok: false, message: "Image trop lourde : 8 Mo maximum." });
      return;
    }
    setEnvoi(true);
    try {
      const petite = await reduire(f);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("session");
      // Un nom fixe par personne : la nouvelle photo remplace l'ancienne, et
      // le stockage ne se remplit pas de vieilles versions.
      const chemin = `${user.id}/avatar.webp`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(chemin, petite, { upsert: true, contentType: "image/webp" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(chemin);
      // `?v=` force le navigateur a recharger l'image apres un remplacement.
      const nouvelle = `${data.publicUrl}?v=${Date.now()}`;
      setUrl(nouvelle);
      const r = await saveAvatar(nouvelle, frame);
      setNote(r);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? "";
      setNote({
        ok: false,
        message: /bucket|not found/i.test(message)
          ? "Le stockage des avatars n'existe pas encore : lance supabase/add_profil_et_party.sql."
          : "L'envoi a échoué. Réessaie.",
      });
    } finally {
      setEnvoi(false);
    }
  }

  function choisirCadre(id: string) {
    setFrame(id);
    start(async () => setNote(await saveAvatar(url, id)));
  }

  function enlever() {
    setUrl(null);
    start(async () => setNote(await saveAvatar(null, frame)));
  }

  const apercu = frameById(frame);
  const epaisseur = apercu.id === "aucun" ? 0 : 6;

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Photo et cadre</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        C&apos;est ce que les autres voient partout : sur ton profil, dans la liste d&apos;amis et dans les partys.
      </p>

      <div className="mt-4 flex items-center gap-5">
        <span
          className="avatar-ring"
          style={{ width: 88, height: 88, padding: epaisseur, ...frameStyle(apercu) }}
          aria-hidden="true"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" width={88 - epaisseur * 2} height={88 - epaisseur * 2} className="avatar-photo" />
          ) : (
            <span
              className="avatar-initiales"
              style={{ width: 88 - epaisseur * 2, height: 88 - epaisseur * 2, fontSize: 30 }}
            >
              {pseudo.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="flex flex-col gap-2">
          <input
            ref={fichier}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void choisirFichier(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={envoi || pending}
            onClick={() => fichier.current?.click()}
            className="portal-button small"
          >
            {envoi ? "Envoi…" : url ? "Changer ma photo" : "Choisir une photo"}
          </button>
          {url && (
            <button type="button" disabled={envoi || pending} onClick={enlever} className="text-xs text-red-500 hover:underline">
              Enlever la photo
            </button>
          )}
          <p className="text-[10px] text-zinc-400">Recadrée en carré et réduite sur ton appareil avant l&apos;envoi.</p>
        </div>
      </div>

      <p className="mt-5 text-xs font-bold text-zinc-900 dark:text-white">Cadre</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FRAMES.map((f) => {
          const permis = tierAtLeast(tier, f.minTier);
          return (
            <button
              key={f.id}
              type="button"
              disabled={!permis || pending}
              onClick={() => choisirCadre(f.id)}
              aria-pressed={frame === f.id}
              title={permis ? f.label : `${f.label} — palier ${f.minTier === "max" ? "Max" : "Standard"}`}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                frame === f.id
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-200 hover:border-violet-400 dark:border-zinc-700"
              } ${permis ? "" : "opacity-40"}`}
            >
              <span className="avatar-ring" style={{ width: 22, height: 22, padding: 3, ...frameStyle(f) }}>
                <span className="avatar-initiales" style={{ width: 16, height: 16, fontSize: 8 }} />
              </span>
              {f.label}
              {!permis && <span aria-hidden="true">🔒</span>}
            </button>
          );
        })}
      </div>

      {note && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
            note.ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300"
          }`}
        >
          {note.message}
        </p>
      )}
    </section>
  );
}
