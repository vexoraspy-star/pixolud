export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-gradient-to-br from-violet-50 via-white to-orange-50 px-4 py-12 sm:px-6 dark:from-violet-950/20 dark:via-black dark:to-orange-950/10">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
