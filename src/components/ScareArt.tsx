import ClassicScare from "./ClassicScare";

/**
 * Les creatures dessinees en code.
 *
 * Les deux premieres du site sont des images ; celles-ci sont du SVG pur —
 * aucun fichier a telecharger, donc elles apparaissent instantanement, meme
 * sur une mauvaise connexion. C'est ce qui fait peur : un screamer qui met
 * deux secondes a charger ne fait plus peur du tout.
 *
 * Regle de gout : pas de sang, pas de clignotement. Un visage trop proche,
 * des yeux qui fixent, et c'est suffisant.
 */

/** Le Rieur : un sourire beaucoup trop large, tres pres de l'ecran. */
export function RieurScare() {
  return (
    <svg viewBox="0 0 200 240" className="h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <radialGradient id="rieur-peau" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#d9c9b4" />
          <stop offset="0.65" stopColor="#7d6b57" />
          <stop offset="1" stopColor="#14100c" />
        </radialGradient>
        <radialGradient id="rieur-trou" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#140404" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="120" rx="92" ry="116" fill="url(#rieur-peau)" />
      {/* Les yeux : petits, enfonces, tres ecartes. */}
      <ellipse cx="58" cy="92" rx="19" ry="14" fill="url(#rieur-trou)" />
      <ellipse cx="142" cy="92" rx="19" ry="14" fill="url(#rieur-trou)" />
      <circle cx="58" cy="92" r="5" fill="#f2ede1" />
      <circle cx="142" cy="92" r="5" fill="#f2ede1" />
      <circle cx="58" cy="92" r="2" fill="#0a0a0a" />
      <circle cx="142" cy="92" r="2" fill="#0a0a0a" />
      {/* Les plis autour des yeux : c'est ce qui rend le sourire faux. */}
      <path d="M32 74 Q52 64 76 72 M168 74 Q148 64 124 72" stroke="#20190f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M96 108 L100 128 L104 108" fill="#3b3024" />
      {/* Le sourire : d'une oreille a l'autre. */}
      <path d="M26 150 Q100 236 174 150 Q100 182 26 150Z" fill="url(#rieur-trou)" />
      <path d="M36 154 L46 170 L56 156 L66 174 L76 158 L86 178 L96 160 L106 178 L116 158 L126 174 L136 156 L146 170 L156 154" fill="#efe7d6" />
      <path d="M44 196 L54 182 L64 198 L74 184 L84 200 L94 186 L104 200 L114 184 L124 198 L134 182 L144 196" fill="#e3d9c4" />
      <path d="M22 146 Q100 166 178 146" stroke="#1a1410" strokeWidth="3" fill="none" />
    </svg>
  );
}

/** L'Oeil : un seul oeil immense qui remplit l'ecran et regarde. */
export function OeilScare() {
  return (
    <svg viewBox="0 0 240 200" className="h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <radialGradient id="oeil-iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b0b0f" />
          <stop offset="0.42" stopColor="#0b0b0f" />
          <stop offset="0.46" stopColor="#7a1d1d" />
          <stop offset="0.75" stopColor="#c8842f" />
          <stop offset="1" stopColor="#3a2410" />
        </radialGradient>
        <radialGradient id="oeil-fond" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#efe8dc" />
          <stop offset="0.8" stopColor="#bdb3a3" />
          <stop offset="1" stopColor="#6f6355" />
        </radialGradient>
      </defs>
      <rect width="240" height="200" fill="#07070a" />
      <ellipse cx="120" cy="100" rx="116" ry="72" fill="url(#oeil-fond)" />
      {/* Les veines : quelques traits, pas une toile d'araignee. */}
      <path d="M12 96 Q46 86 70 100 M228 104 Q194 118 168 102 M30 128 Q62 118 84 126 M210 74 Q180 66 156 76" stroke="#a3413c" strokeWidth="2.5" fill="none" opacity="0.75" />
      <circle cx="120" cy="100" r="62" fill="url(#oeil-iris)" />
      <circle cx="120" cy="100" r="27" fill="#050506" />
      <circle cx="104" cy="82" r="9" fill="#ffffff" opacity="0.5" />
      {/* Les paupieres, qui recadrent l'oeil en amande. */}
      <path d="M0 100 Q120 -10 240 100 L240 0 L0 0Z" fill="#07070a" />
      <path d="M0 100 Q120 210 240 100 L240 200 L0 200Z" fill="#07070a" />
      <path d="M0 100 Q120 -8 240 100" stroke="#231b16" strokeWidth="7" fill="none" />
      <path d="M0 100 Q120 208 240 100" stroke="#231b16" strokeWidth="7" fill="none" />
    </svg>
  );
}

/** La Main : une main qui sort du noir et vient vers l'ecran. */
export function MainScare() {
  return (
    <svg viewBox="0 0 200 240" className="h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <linearGradient id="main-peau" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#cdbfae" />
          <stop offset="0.55" stopColor="#8b7b69" />
          <stop offset="1" stopColor="#1a150f" />
        </linearGradient>
      </defs>
      <rect width="200" height="240" fill="#06060a" />
      {/* L'avant-bras, qui sort de l'ombre du bas. */}
      <path d="M70 240 L60 170 Q100 150 140 172 L132 240Z" fill="url(#main-peau)" />
      {/* La paume. */}
      <path d="M58 172 Q100 138 142 172 Q150 120 120 104 Q100 96 80 104 Q50 120 58 172Z" fill="url(#main-peau)" />
      {/* Les doigts, tendus vers l'avant, inegaux : c'est ce qui fait vrai. */}
      <path d="M72 108 Q66 62 74 30 Q84 22 90 32 Q92 74 88 110Z" fill="url(#main-peau)" />
      <path d="M92 106 Q90 48 98 14 Q108 6 114 16 Q114 62 108 108Z" fill="url(#main-peau)" />
      <path d="M112 108 Q114 54 124 24 Q134 18 138 30 Q134 72 126 112Z" fill="url(#main-peau)" />
      <path d="M130 114 Q138 74 150 52 Q160 48 162 60 Q152 96 142 120Z" fill="url(#main-peau)" />
      {/* Le pouce, de l'autre cote. */}
      <path d="M62 140 Q38 124 26 104 Q28 92 40 96 Q60 114 72 130Z" fill="url(#main-peau)" />
      {/* Ongles et plis. */}
      <ellipse cx="82" cy="32" rx="7" ry="9" fill="#e6ddcd" opacity="0.85" />
      <ellipse cx="105" cy="16" rx="7" ry="9" fill="#e6ddcd" opacity="0.85" />
      <ellipse cx="130" cy="26" rx="7" ry="9" fill="#e6ddcd" opacity="0.85" />
      <ellipse cx="155" cy="55" rx="6" ry="8" fill="#e6ddcd" opacity="0.8" />
      <path d="M70 150 Q100 132 132 150 M74 162 Q100 146 128 162" stroke="#2b2119" strokeWidth="2.5" fill="none" opacity="0.8" />
    </svg>
  );
}

/** Le dessin correspondant a un identifiant de creature. */
export function ScareArt({ id }: { id: string }) {
  if (id === "rieur") return <RieurScare />;
  if (id === "oeil") return <OeilScare />;
  if (id === "main") return <MainScare />;
  return <ClassicScare />;
}
