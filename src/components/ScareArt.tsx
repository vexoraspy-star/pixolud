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
    <svg viewBox="0 0 200 240" className="scare-art h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <radialGradient id="rieur-peau" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#d5d0bc" />
          <stop offset="0.55" stopColor="#76776a" />
          <stop offset="1" stopColor="#0b0f10" />
        </radialGradient>
        <radialGradient id="rieur-trou" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#140404" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="120" rx="92" ry="116" fill="url(#rieur-peau)" />
      <path d="M10 106Q18 33 73 12L49 71 20 121ZM190 100Q180 27 127 12L155 75 179 131Z" fill="#080b0c" opacity=".8" />
      <path d="M21 108L42 132 33 155 61 204 25 174ZM179 106L155 127 165 151 138 210 177 177Z" fill="#151a19" opacity=".7" />
      <path d="M70 16L84 36 79 46 90 61M129 18L118 48 130 59M89 25L97 30M158 49L146 59 151 70M36 125L51 134M156 130L168 121" stroke="#464c43" strokeWidth="1" fill="none" />
      {/* Les yeux : petits, enfonces, tres ecartes. */}
      <ellipse cx="58" cy="92" rx="19" ry="14" fill="url(#rieur-trou)" />
      <ellipse cx="142" cy="92" rx="19" ry="14" fill="url(#rieur-trou)" />
      <circle cx="58" cy="92" r="5" fill="#f2ede1" />
      <circle cx="142" cy="92" r="5" fill="#f2ede1" />
      <circle cx="58" cy="92" r="2" fill="#0a0a0a" />
      <circle cx="142" cy="92" r="2" fill="#0a0a0a" />
      <path d="M34 87Q56 72 78 86M123 83Q143 71 168 86M39 102Q59 113 77 100M125 100Q145 112 162 101" fill="none" stroke="#363b31" strokeWidth="3" />
      <path d="M84 97Q78 122 73 137M117 97Q122 122 129 136" fill="none" stroke="#373a32" strokeWidth="5" />
      {/* Les plis autour des yeux : c'est ce qui rend le sourire faux. */}
      <path d="M32 74 Q52 64 76 72 M168 74 Q148 64 124 72" stroke="#20190f" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M96 108 L100 128 L104 108" fill="#3b3024" />
      {/* Le sourire : d'une oreille a l'autre. */}
      <path d="M26 150 Q100 236 174 150 Q100 182 26 150Z" fill="url(#rieur-trou)" />
      <path d="M36 154 L46 170 L56 156 L66 174 L76 158 L86 178 L96 160 L106 178 L116 158 L126 174 L136 156 L146 170 L156 154" fill="#efe7d6" />
      <path d="M44 196 L54 182 L64 198 L74 184 L84 200 L94 186 L104 200 L114 184 L124 198 L134 182 L144 196" fill="#e3d9c4" />
      <path d="M22 146 Q100 166 178 146" stroke="#1a1410" strokeWidth="3" fill="none" />
      <path d="M29 140Q18 151 25 161M171 140Q183 151 177 164M57 212Q97 234 139 211" fill="none" stroke="#242b24" strokeWidth="3" />
    </svg>
  );
}

/** L'Oeil : un seul oeil immense qui remplit l'ecran et regarde. */
export function OeilScare() {
  return (
    <svg viewBox="0 0 240 200" className="scare-art h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <radialGradient id="oeil-iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b0b0f" />
          <stop offset="0.42" stopColor="#0b0b0f" />
          <stop offset="0.46" stopColor="#ddd7a4" />
          <stop offset="0.75" stopColor="#769a89" />
          <stop offset="1" stopColor="#142d2d" />
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
      <path d="M12 96 Q46 86 70 100 M228 104 Q194 118 168 102 M30 128 Q62 118 84 126 M210 74 Q180 66 156 76" stroke="#716f61" strokeWidth="1.5" fill="none" opacity="0.75" />
      <circle cx="120" cy="100" r="62" fill="url(#oeil-iris)" />
      <g fill="none" stroke="#c4cfaa" strokeWidth=".8" opacity=".7">
        {Array.from({ length: 40 }, (_, i) => <path key={i} d="M120 43L118 52 121 63 120 70" transform={`rotate(${i * 9} 120 100)`} />)}
      </g>
      <circle cx="120" cy="100" r="58" fill="none" stroke="#0f2426" strokeWidth="3" />
      <circle cx="120" cy="100" r="27" fill="#050506" />
      <circle cx="104" cy="82" r="9" fill="#ffffff" opacity="0.5" />
      <circle cx="139" cy="112" r="3" fill="#fff" opacity=".7" />
      {/* Les paupieres, qui recadrent l'oeil en amande. */}
      <path d="M0 100 Q120 -10 240 100 L240 0 L0 0Z" fill="#07070a" />
      <path d="M0 100 Q120 210 240 100 L240 200 L0 200Z" fill="#07070a" />
      <path d="M0 100 Q120 -8 240 100" stroke="#231b16" strokeWidth="7" fill="none" />
      <path d="M0 100 Q120 208 240 100" stroke="#231b16" strokeWidth="7" fill="none" />
      <path d="M12 72Q119 -6 226 72M18 60Q120 -10 219 58M18 138Q120 218 224 137" fill="none" stroke="#3d4036" strokeWidth="2" opacity=".65" />
    </svg>
  );
}

/** La Main : une main qui sort du noir et vient vers l'ecran. */
export function MainScare() {
  return (
    <svg viewBox="0 0 200 240" className="scare-art h-[92vh] max-w-[92vw]" aria-hidden="true">
      <defs>
        <linearGradient id="main-peau" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#d5d0b5" />
          <stop offset="0.55" stopColor="#7c8779" />
          <stop offset="1" stopColor="#0b1213" />
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
      <path d="M78 48L79 93 85 133 91 157 88 224M105 36L102 89 108 124 102 171 111 224M129 45L120 99 122 136M151 71L137 107 131 149M66 136L79 150 84 181" fill="none" stroke="#323e36" strokeWidth="2.2" opacity=".75" />
      <path d="M73 65l13 3M73 72l12 3M95 55l16 1M95 62l14 2M118 70l14 3M118 77l11 3M136 88l13 5" fill="none" stroke="#26382f" strokeWidth="1.5" />
      <path d="M75 32L76 14 85 25 89 34ZM98 15L100 0 109 10 112 18ZM123 26L131 8 133 20 137 32ZM149 54L163 38 160 57Z" fill="#1c2927" />
      <path d="M73 189Q95 174 123 186M78 195Q100 184 124 196" fill="none" stroke="#46544a" strokeWidth="1.5" />
    </svg>
  );
}

/** La Felure : ceramique fendue, orbites asymetriques et bouche creuse. */
export function FelureScare() {
  return <svg viewBox="0 0 200 240" className="scare-art h-[92vh] max-w-[92vw]" aria-hidden="true">
    <defs><radialGradient id="masque-ceramique" cx=".42" cy=".33" r=".7"><stop stopColor="#e0decb" /><stop offset=".6" stopColor="#8c9184" /><stop offset="1" stopColor="#0e1414" /></radialGradient></defs>
    <path d="M8 119Q7 8 95 1Q185 -2 193 116L171 221 143 240H52L18 211Z" fill="#111718" />
    <path d="M35 71Q35 19 97 17Q163 17 169 77L160 163Q148 223 103 231Q54 223 38 172Z" fill="url(#masque-ceramique)" />
    <path d="M39 80Q56 54 80 76L85 93Q68 117 47 109ZM117 80Q145 51 163 77L158 103Q136 119 116 96Z" fill="#060a0b" />
    <ellipse cx="64" cy="88" rx="3" ry="4" fill="#c4d7c8" /><circle cx="139" cy="87" r="2" fill="#c4d7c8" />
    <path d="M94 88L87 127 103 136 113 126 105 94" fill="#60685d" /><path d="M92 129l7-5 8 7" fill="#0b1010" />
    <path d="M79 159Q100 133 125 156Q141 187 113 217Q81 220 74 187Z" fill="#050809" />
    <path d="M81 159l9-4 2 9 5-11 8 0 3 12 7-10 8 6-5 11-10-5-11 5-9-6Z" fill="#b7b8a4" />
    <path d="M49 128L63 155 65 180M150 122L135 150 135 184" stroke="#545e52" strokeWidth="4" fill="none" />
    <path d="M90 18L83 40 96 56 91 72M83 40L67 46M146 39L132 54 136 65M39 99L50 120 44 144 60 172M44 144L36 151M160 102L148 127 158 146 145 169M113 218L118 200M59 191L71 198" fill="none" stroke="#3b4941" strokeWidth="1.2" />
    <path d="M48 59Q59 50 77 61M120 61Q142 42 155 57" stroke="#777f70" strokeWidth="3" fill="none" />
  </svg>;
}

/**
 * Le dessin correspondant a un identifiant de creature.
 *
 * Le Masque d'origine reste le dessin par defaut : c'est aussi lui qui
 * remplace une creature en image dont le fichier n'a pas pu se charger.
 */
export function ScareArt({ id }: { id: string }) {
  if (id === "rieur") return <RieurScare />;
  if (id === "oeil") return <OeilScare />;
  if (id === "main") return <MainScare />;
  if (id === "felure") return <FelureScare />;
  return <ClassicScare />;
}
