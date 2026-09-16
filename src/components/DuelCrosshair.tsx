"use client";

import { CROSSHAIR_COLORS, type DuelOptions } from "@/lib/duelOptions";

/**
 * Le reticule du Duel, dessine en CSS et entierement reglable.
 *
 * Il etait fixe et blanc : illisible sur les murs clairs de l'Entrepot, et
 * impossible a adapter a ceux qui visent avec un point plutot qu'une croix.
 * `spread` (0 a 1) l'ouvre quand on court ou qu'on tire, `hit` fait
 * apparaitre les quatre chevrons rouges d'un coup au but.
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
  const shadow = options.outline ? "0 0 0 1px rgba(0,0,0,0.85)" : undefined;
  const push = options.gap + (options.dynamic ? spread * 14 : 0);
  const branch = options.size;
  const th = options.thickness;
  const showBranches = options.crosshair === "croix" || options.crosshair === "croix-point";
  const showDot =
    options.crosshair === "point" || options.crosshair === "croix-point" || options.crosshair === "cercle";

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {showDot && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: th + 1,
              height: th + 1,
              background: color,
              boxShadow: shadow,
            }}
          />
        )}

        {showBranches &&
          [0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className="absolute left-1/2 top-1/2"
              style={{
                width: th,
                height: branch,
                background: color,
                boxShadow: shadow,
                transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(${-(push + branch / 2)}px)`,
              }}
            />
          ))}

        {options.crosshair === "cercle" && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: (push + branch) * 2,
              height: (push + branch) * 2,
              border: `${th}px solid ${color}`,
              boxShadow: shadow,
            }}
          />
        )}

        {options.crosshair === "chevrons" &&
          [-1, 1].map((side) => (
            <div
              key={side}
              className="absolute left-1/2 top-1/2"
              style={{
                width: th,
                height: branch + 3,
                background: color,
                boxShadow: shadow,
                transform: `translate(-50%,-50%) rotate(${side * 45}deg) translateY(${push + branch / 2}px)`,
              }}
            />
          ))}

        {hit > 0.02 && (
          <div style={{ opacity: hit }}>
            {[45, 135, 225, 315].map((deg) => (
              <div
                key={deg}
                className="absolute left-1/2 top-1/2 bg-red-400"
                style={{
                  width: th,
                  height: branch + 3,
                  boxShadow: shadow,
                  transform: `translate(-50%,-50%) rotate(${deg}deg) translateY(${-(push + branch)}px)`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
