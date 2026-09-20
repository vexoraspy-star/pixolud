/** Petit personnage vectoriel maison, sans animation de rendu. */
export default function PixoAvatar({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="21" fill="#7960d8" />
    <path d="M32 17v-5" stroke="#ded5ff" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="10" r="3" fill="#a9ebce" />
    <rect x="13" y="19" width="38" height="31" rx="12" fill="#e7e1fa" />
    <rect x="17" y="23" width="30" height="21" rx="8" fill="#292b4c" />
    <path d="M24 30v5m16-5v5" stroke="#b6efd7" strokeWidth="4" strokeLinecap="round" />
    <path d="M29 38q3 3 6 0" stroke="#b6efd7" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 29v9m44-9v9" stroke="#c5b9ec" strokeWidth="4" strokeLinecap="round" />
    <path d="M25 50v3m14-3v3" stroke="#ddd4f7" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}
