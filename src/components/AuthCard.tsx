import Link from "next/link";

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="auth-stage"><div className="auth-panel">
    <Link href="/" className="brand auth-brand"><span className="brand-mark" aria-hidden="true">✣</span>Pixolud</Link>
    {children}
  </div></div>;
}
