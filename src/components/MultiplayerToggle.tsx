"use client";

export default function MultiplayerToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-dashed border-zinc-300 px-4 py-3 dark:border-zinc-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
      />
      <span>
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          🎉 Mode Party — inviter un ami
        </span>
        <span className="block text-xs text-zinc-400">
          Active un bouton « Inviter un ami » sur la page du jeu : vous verrez
          qui est connecté en même temps que vous. Chacun joue sur son propre
          écran pour l&apos;instant — la partie vraiment synchronisée arrive
          dans une prochaine mise à jour.
        </span>
      </span>
    </label>
  );
}
