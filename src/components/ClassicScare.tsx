export default function ClassicScare() { return (
      <svg viewBox="0 0 200 240" className="h-[92vh] max-w-[92vw]"  aria-hidden="true">
        <defs>
          <radialGradient id="peau" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#e6e1d3" />
            <stop offset="0.7" stopColor="#8f8a7c" />
            <stop offset="1" stopColor="#2a2723" />
          </radialGradient>
          <radialGradient id="trou" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#1a0505" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="118" rx="84" ry="108" fill="url(#peau)" />
        <path d="M18 70 Q40 10 100 8 Q160 10 182 70 Q150 40 100 42 Q50 40 18 70Z" fill="#141210" />
        <ellipse cx="64" cy="96" rx="22" ry="27" fill="url(#trou)" />
        <ellipse cx="136" cy="96" rx="22" ry="27" fill="url(#trou)" />
        <circle cx="64" cy="100" r="4" fill="#ff2a1a" style={{ filter: "drop-shadow(0 0 6px #ff2a1a)" }} />
        <circle cx="136" cy="100" r="4" fill="#ff2a1a" style={{ filter: "drop-shadow(0 0 6px #ff2a1a)" }} />
        <path d="M52 66 L80 78 M148 66 L120 78" stroke="#1d1a17" strokeWidth="6" strokeLinecap="round" />
        <path d="M94 118 L100 134 L106 118" fill="#3a352e" />
        <ellipse cx="100" cy="180" rx="36" ry="46" fill="url(#trou)" />
        <path d="M70 160 L78 172 L86 160 L94 174 L100 160 L106 174 L114 160 L122 172 L130 160" fill="#e9e4d2" />
        <path d="M76 206 L84 196 L92 208 L100 196 L108 208 L116 196 L124 206" fill="#e9e4d2" />
        <path d="M40 150 Q52 160 56 176 M160 150 Q148 160 144 176" stroke="#5e584d" strokeWidth="3" fill="none" />
      </svg>
); }
