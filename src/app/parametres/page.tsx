import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/connexion/actions";
import { updateProfile } from "./actions";

export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, bio")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Paramètres du compte
      </h1>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          Bio enregistrée !
        </p>
      )}

      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between border-b border-zinc-200 py-2 dark:border-zinc-800">
          <dt className="text-zinc-500 dark:text-zinc-400">Pseudo</dt>
          <dd className="font-medium text-zinc-900 dark:text-white">
            {profile?.pseudo}
          </dd>
        </div>
        <div className="flex justify-between border-b border-zinc-200 py-2 dark:border-zinc-800">
          <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
          <dd className="font-medium text-zinc-900 dark:text-white">{user.email}</dd>
        </div>
      </dl>

      <form action={updateProfile} className="mt-6 flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Bio
          <textarea
            name="bio"
            rows={3}
            maxLength={280}
            defaultValue={profile?.bio ?? ""}
            placeholder="Parle un peu de toi..."
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Enregistrer
        </button>
      </form>

      <form action={logout} className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <button
          type="submit"
          className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
