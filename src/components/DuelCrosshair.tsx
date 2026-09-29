"use client";

import { CROSSHAIR_COLORS, type DuelOptions } from "@/lib/duelOptions";

/**
 * Le reticule du Duel, dessine en SVG et entierement reglable.
 *
 * Il etait fixe et blanc : illisible sur les murs clairs de l'Entrepot, et
 * impossible a adapter a ceux qui visent avec un point plutot qu'une croix.
 * `spread` (0 a 1) l'ouvre quand on court ou qu'on tire, `hit` fait
 * apparaitre les quatre traits rouges d'un coup au but.
 *
 * Dessin au pixel pres (coordonnees entieres, `crispEdges`) : des blocs CSS
 * centres par translate(-50%) tombaient sur des demi-pixels et bavaient.
 * Le contour noir est un rectangle d'un pixel de plus derriere chaque trait.
 */
export default function DuelCrosshair({
  options,
  spread = 0,
  hit = 0,
}: {
  options: DuelOptions;
  spread?: number;
  hit?: number;
}) {
  const color = CROSSHAIR_COLORS[options.color] ?? "#ffffff";
  const outline = options.outline;
  const push = Math.round(options.gap + (options.dynamic ? spread * 14 : 0));
  const branch = Math.max(0, Math.round(options.size));
  const th = Math.max(1, Math.round(options.thickness));
  const showBranches = options.crosshair === "croix" || options.crosshair === "croix-point";
  const showDot =
    options.crosshair === "point" || options.crosshair === "croix-point" || options.crosshair === "cercle";

  // Boite paire autour du centre : tout le dessin tient dedans, marge comprise.
  const half = push + branch + th + 8;
  const n = half * 2;
  const c = half;
  /** Debut d'un trait d'epaisseur `th` centre sur c (au pixel entier). */
  const lo = c - Math.floor(th / 2);
  // Le point garde la parite de l'epaisseur : il reste centre sur les
  // branches. Seul (style « point »), il grossit d'un cran pour se voir.
  const dot = th + (showBranches ? (th === 1 ? 2 : 0) : 2);
  const dotLo = c - Math.floor(dot / 2);

  // Les quatre branches : [x, y, largeur, hauteur].
  const bars: [number, number, number, number][] = showBranches && branch > 0
    ? [
        [lo, c - push - branch, th, branch],
        [lo, c + push + (th % 2), th, branch],
        [c - push - branch, lo, branch, th],
        [c + push + (th % 2), lo, branch, th],
      ]
    : [];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg width={n} height={n} viewBox={`0 0 ${n} ${n}`} aria-hidden style={{ overflow: "visible" }}>
        <g shapeRendering="crispEdges">
          {outline &&
            bars.map(([x, y, w, h], i) => (
              <rect key={`o${i}`} x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill="rgba(0,0,0,0.85)" />
            ))}
          {bars.map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
          ))}
          {showDot && (
            <>
              {outline && <rect x={dotLo - 1} y={dotLo - 1} width={dot + 2} height={dot + 2} fill="rgba(0,0,0,0.85)" />}
              <rect x={dotLo} y={dotLo} width={dot} height={dot} fill={color} />
            </>
          )}
        </g>

        {options.crosshair === "cercle" && (
          <>
            {outline && (
              <circle cx={c} cy={c} r={push + branch} fill="none" stroke="rgba(0,0,0,0.85)" strokeWidth={th + 2} />
            )}
            <circle cx={c} cy={c} r={push + branch} fill="none" stroke={color} strokeWidth={th} />
          </>
        )}

        {options.crosshair === "chevrons" &&
          [-1, 1].map((side) => {
            const x2 = c + side * (branch + 3) * 0.7071;
            const y1 = c + push;
            const y2 = y1 + (branch + 3) * 0.7071;
            return (
              <g key={side}>
                {outline && (
                  <line x1={c} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.85)" strokeWidth={th + 2} strokeLinecap="square" />
                )}
                <line x1={c} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={th} strokeLinecap="square" />
              </g>
            );
          })}

        {hit > 0.02 && (
          <g opacity={Math.min(1, hit)}>
            {[
              [-1, -1],
              [1, -1],
              [-1, 1],
              [1, 1],
            ].map(([sx, sy]) => {
              const a = push + 3;
              const b = push + branch + 5;
              return (
                <line
                  key={`${sx}${sy}`}
                  x1={c + sx * a * 0.7071}
                  y1={c + sy * a * 0.7071}
                  x2={c + sx * b * 0.7071}
                  y2={c + sy * b * 0.7071}
                  stroke="#ff4a4a"
                  strokeWidth={Math.max(1.5, th)}
                  strokeLinecap="butt"
                />
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
