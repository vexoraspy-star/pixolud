"use client";

import { useId } from "react";
import type { CommanderLook, CommanderProfile } from "@/lib/tanks/tankCareer";

// Portrait dessine d'un commandant de « Tonnerre d'Acier » : visage, coiffure,
// couvre-chef (beret, casquette, casque de tankiste, bandana), signes
// particuliers, et les galons de son grade sur les epaules.

/** L'allure d'un commandant ; le premier (« recrue ») la tire de son nom. */
export function commanderLook(p: CommanderProfile, name: string): CommanderLook {
  if (p.look) return p.look;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const skins = ["#f1c9a5", "#d9a77c", "#b97f55", "#8d5a3b", "#f3d6bd"];
  const hairs = ["#2b1d14", "#5a3b22", "#a06a32", "#1b1b1b", "#c9c2b5"];
  return { skin: skins[h % skins.length], hair: hairs[(h >> 3) % hairs.length], hairStyle: "court", hat: "beret", hatColor: "#9f1d1d", uniform: "#4b5536", extras: [] };
}

export default function CommanderPortrait({
  look,
  name,
  stripes,
  className = "h-36 w-32",
}: {
  look: CommanderLook;
  name: string;
  stripes: number;
  className?: string;
}) {
  const bg = `cmd-bg-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const { skin, hair, hairStyle, hat, hatColor, uniform, extras } = look;
  const has = (e: CommanderLook["extras"][number]) => extras.includes(e);
  return (
    <svg viewBox="0 0 120 140" className={className} aria-label={`Portrait de ${name}`}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a1414" />
          <stop offset="100%" stopColor="#0c0b0a" />
        </linearGradient>
      </defs>
      <rect width="120" height="140" rx="6" fill={`url(#${bg})`} />
      {/* Epaules et veste, chemise, cravate */}
      <path d="M14 140 Q18 104 60 98 Q102 104 106 140Z" fill={uniform} />
      <path d="M48 100 L60 118 L72 100" fill="#e9e4d6" />
      <path d="M54 104 L60 126 L66 104Z" fill="#7a1f1f" />
      {Array.from({ length: stripes }, (_, i) => (
        <g key={i}>
          <rect x={22} y={110 + i * 5} width="16" height="2.5" fill="#e3b341" />
          <rect x={82} y={110 + i * 5} width="16" height="2.5" fill="#e3b341" />
        </g>
      ))}
      {/* Cheveux longs ou queue de cheval : derriere la tete */}
      {hairStyle === "long" && (
        <>
          <path d="M37 56 Q32 82 40 98 L47 98 Q42 80 43 60Z" fill={hair} />
          <path d="M83 56 Q88 82 80 98 L73 98 Q78 80 77 60Z" fill={hair} />
        </>
      )}
      {hairStyle === "queue" && <path d="M78 52 Q98 58 94 86 Q88 74 79 70Z" fill={hair} />}
      {/* Cou, oreilles, tete */}
      <rect x="51" y="82" width="18" height="20" fill={skin} />
      <ellipse cx="38.5" cy="66" rx="3.5" ry="6" fill={skin} />
      <ellipse cx="81.5" cy="66" rx="3.5" ry="6" fill={skin} />
      <ellipse cx="60" cy="64" rx="22" ry="26" fill={skin} />
      {/* Barbe (sous la bouche) */}
      {has("barbe") && <path d="M39 68 Q41 93 60 95 Q79 93 81 68 Q75 84 60 87 Q45 84 39 68Z" fill={hair} />}
      {/* Coiffure */}
      {hairStyle === "court" || hairStyle === "long" || hairStyle === "queue" ? (
        <path d="M38 62 Q40 44 60 42 Q80 44 82 62 Q78 52 60 52 Q42 52 38 62Z" fill={hair} />
      ) : hairStyle === "boucles" ? (
        <g fill={hair}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI + (i / 8) * Math.PI;
            return <circle key={i} cx={60 + Math.cos(a) * 22} cy={60 + Math.sin(a) * 20} r="6.5" />;
          })}
        </g>
      ) : (
        <g fill={hair} opacity="0.85">
          <path d="M38 64 Q38 56 42 53 L43 64Z" />
          <path d="M82 64 Q82 56 78 53 L77 64Z" />
        </g>
      )}
      {/* Couvre-chef */}
      {hat === "beret" && (
        <>
          <path d="M34 50 Q38 30 66 30 Q90 32 88 46 Q70 40 34 50Z" fill={hatColor} />
          <circle cx="76" cy="40" r="4" fill="#e3b341" />
        </>
      )}
      {hat === "casquette" && (
        <>
          <path d="M38 47 Q40 29 60 27 Q80 29 82 47Z" fill={hatColor} />
          <path d="M38 46 L82 46 L82 51 L38 51Z" fill="rgba(0,0,0,0.35)" />
          <path d="M35 51 Q60 61 85 51 Q60 55 35 51Z" fill="#141414" />
          <circle cx="60" cy="38" r="3.5" fill="#e3b341" />
        </>
      )}
      {hat === "casque" && (
        <>
          <ellipse cx="37" cy="66" rx="5.5" ry="10" fill={hatColor} />
          <ellipse cx="83" cy="66" rx="5.5" ry="10" fill={hatColor} />
          <path d="M35 62 Q33 30 60 27 Q87 30 85 62 Q81 47 60 45 Q39 47 35 62Z" fill={hatColor} />
          <path d="M47 31 Q44 40 45 49 M60 28 L60 45 M73 31 Q76 40 75 49" stroke="rgba(0,0,0,0.35)" strokeWidth="2" fill="none" />
          {/* Lunettes de tankiste relevees sur le casque */}
          <path d="M38 46 Q60 40 82 46" stroke="#2a2420" strokeWidth="3" fill="none" />
          <circle cx="51" cy="44" r="6" fill="#8fb3c9" stroke="#3a332c" strokeWidth="2" />
          <circle cx="69" cy="44" r="6" fill="#8fb3c9" stroke="#3a332c" strokeWidth="2" />
          <path d="M48 41 L51 39" stroke="#e8f4fb" strokeWidth="1.4" />
          <path d="M66 41 L69 39" stroke="#e8f4fb" strokeWidth="1.4" />
        </>
      )}
      {hat === "bandana" && (
        <>
          <path d="M37 53 Q60 43 83 53 L83 59 Q60 50 37 59Z" fill={hatColor} />
          <path d="M83 54 L93 49 L91 58Z" fill={hatColor} />
          <path d="M83 57 L93 63 L88 65Z" fill={hatColor} />
        </>
      )}
      {/* Visage */}
      <circle cx="51" cy="64" r="2.4" fill="#1a1a1a" />
      <circle cx="69" cy="64" r="2.4" fill="#1a1a1a" />
      <path d="M46 58 L56 57 M64 57 L74 58" stroke={hair} strokeWidth="2" strokeLinecap="round" />
      <path d="M60 66 L57 74 L62 74" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
      {has("moustache") && <path d="M49 77 Q55 72 60 75.5 Q65 72 71 77 Q65 79.5 60 77.5 Q55 79.5 49 77Z" fill={hair} />}
      <path d="M52 81 Q60 85 68 81" fill="none" stroke="#6b2b22" strokeWidth="2" strokeLinecap="round" />
      {has("peinture") && (
        <g stroke="#2e3a22" strokeWidth="3" strokeLinecap="round" opacity="0.85">
          <path d="M43 71 L54 67" />
          <path d="M66 67 L77 71" />
          <path d="M50 51 L58 49" />
        </g>
      )}
      {has("cicatrice") && (
        <g stroke="#b5655a" strokeWidth="1.8" strokeLinecap="round">
          <path d="M73 55 L67 73" />
          <path d="M68 60 L73 61 M67 66 L72 67" strokeWidth="1.2" />
        </g>
      )}
      {has("lunettes") && (
        <g fill="none" stroke="#1a1a1a" strokeWidth="1.6">
          <circle cx="51" cy="64" r="6" />
          <circle cx="69" cy="64" r="6" />
          <path d="M57 64 L63 64 M45 63 L40 61 M75 63 L80 61" />
        </g>
      )}
      {has("cache-oeil") && (
        <>
          <path d="M39 55 L84 62" stroke="#111" strokeWidth="1.6" />
          <ellipse cx="69" cy="64" rx="5.5" ry="4.8" fill="#111" />
        </>
      )}
    </svg>
  );
}
