import AuthCard from "@/components/AuthCard";

export default function VerifieTonEmailPage() {
  return (
    <AuthCard>
      <div className="text-center">
        <span className="text-4xl">📬</span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
          Vérifie ta boîte mail
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Si un compte existe avec cette adresse, un lien de réinitialisation
          vient de t&apos;être envoyé.
        </p>
      </div>
    </AuthCard>
  );
}
