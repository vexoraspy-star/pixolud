"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { EMOJI_OPTIONS, GRADIENT_OPTIONS } from "@/lib/theme-options";
import { createClient } from "@/lib/supabase/client";
import { EXCLUSIVE_EMOJIS, EXCLUSIVE_GRADIENTS, tierAtLeast, type Tier } from "@/lib/tiers";

const MAX_SIZE_BYTES = 4 * 1024 * 1024;

export default function CoverPicker({
  gameId,
  gradient,
  emoji,
  coverUrl,
  tier,
  onGradientChange,
  onEmojiChange,
  onCoverUrlChange,
}: {
  gameId: string;
  gradient: string;
  emoji: string;
  coverUrl: string | null;
  tier: Tier;
  onGradientChange: (g: string) => void;
  onEmojiChange: (e: string) => void;
  onCoverUrlChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Choisis un fichier image (jpg, png, webp...).");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError("Image trop lourde (4 Mo maximum).");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploadError("Tu dois être connecté.");
      setUploading(false);
      return;
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${gameId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("game-covers").upload(path, file, {
      upsert: true,
    });

    if (error) {
      setUploadError("Échec de l'envoi de l'image, réessaie.");
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("game-covers").getPublicUrl(path);
    onCoverUrlChange(publicUrl.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Vignette
      </p>

      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt="Couverture du jeu"
          className="mb-3 h-24 w-full max-w-xs rounded-xl object-cover"
        />
      ) : (
        <div
          className={`mb-3 flex h-24 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-br text-4xl ${gradient}`}
        >
          {emoji}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
          {uploading ? "Envoi..." : "📷 Uploader une image"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {coverUrl && (
          <button
            type="button"
            onClick={() => onCoverUrlChange(null)}
            className="text-xs font-medium text-red-500 hover:underline"
          >
            Retirer l&apos;image
          </button>
        )}
      </div>
      {uploadError && (
        <p className="mt-1 text-xs text-red-500">{uploadError}</p>
      )}

      <p className="mt-3 mb-1 text-xs text-zinc-400">
        Ou choisis une couleur + une icône (utilisé si aucune image) :
      </p>
      <div className="flex flex-wrap gap-2">
        {GRADIENT_OPTIONS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGradientChange(g)}
            aria-label={`Couleur ${g}`}
            className={`size-8 rounded-full bg-gradient-to-br ${g} ${
              gradient === g && !coverUrl
                ? "ring-2 ring-violet-600 ring-offset-2 ring-offset-white dark:ring-offset-black"
                : ""
            }`}
          />
        ))}
        {EXCLUSIVE_GRADIENTS.map(({ value: g, minTier }) =>
          tierAtLeast(tier, minTier) ? (
            <button
              key={g}
              type="button"
              onClick={() => onGradientChange(g)}
              aria-label={`Couleur ${g}`}
              className={`size-8 rounded-full bg-gradient-to-br ${g} ${
                gradient === g && !coverUrl
                  ? "ring-2 ring-violet-600 ring-offset-2 ring-offset-white dark:ring-offset-black"
                  : ""
              }`}
            />
          ) : (
            <span
              key={g}
              title={`Couleur exclusive ${minTier === "max" ? "Max" : "Standard"}`}
              className={`relative flex size-8 items-center justify-center rounded-full bg-gradient-to-br text-xs opacity-40 grayscale ${g}`}
            >
              🔒
            </span>
          ),
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEmojiChange(e)}
            className={`flex size-8 items-center justify-center rounded-full text-lg ${
              emoji === e && !coverUrl
                ? "bg-violet-100 dark:bg-violet-900/50"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            }`}
          >
            {e}
          </button>
        ))}
        {EXCLUSIVE_EMOJIS.map(({ value: e, minTier }) =>
          tierAtLeast(tier, minTier) ? (
            <button
              key={e}
              type="button"
              onClick={() => onEmojiChange(e)}
              className={`flex size-8 items-center justify-center rounded-full text-lg ${
                emoji === e && !coverUrl
                  ? "bg-violet-100 dark:bg-violet-900/50"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }`}
            >
              {e}
            </button>
          ) : (
            <span
              key={e}
              title={`Icône exclusive ${minTier === "max" ? "Max" : "Standard"}`}
              className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-xs opacity-50 dark:bg-zinc-900"
            >
              🔒
            </span>
          ),
        )}
      </div>
      {tier === "free" && (
        <p className="mt-2 text-xs text-zinc-400">
          🔒 ={" "}
          <Link href="/premium" className="font-medium text-violet-600 hover:underline">
            couleurs et icônes exclusives Premium
          </Link>
        </p>
      )}
    </div>
  );
}
