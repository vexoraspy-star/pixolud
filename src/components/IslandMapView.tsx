"use client";

import { useMemo, type MouseEvent } from "react";
import {
  ILE_ARBRE,
  ILE_CAISSE,
  ILE_MUR,
  SOL_BETON,
  SOL_PARQUET,
  SOL_SABLE,
  SOL_TERRE,
  SOL_EAU,
  type IslandMap,
} from "@/lib/duelIsland";

/**
 * La carte de l'ile vue du dessus : pour choisir ou atterrir avant le saut,
 * puis (touche M) pour voir ou est la zone pendant la partie.
 *
 * Chaque type de case est un seul chemin SVG — quelques elements au lieu de
 * cinq mille rectangles.
 */
export default function IslandMapView({
  island,
  onPick,
  zone,
  me,
  pick,
}: {
  island: IslandMap;
  /** Clic sur la carte, en cases. Absent : carte en lecture seule. */
  onPick?: (x: number, y: number) => void;
  /** Cercle de la zone, en cases. */
  zone?: { x: number; y: number; r: number } | null;
  /** Position du joueur, en cases. */
  me?: { x: number; y: number; yaw: number } | null;
  /** Point d'atterrissage deja choisi. */
  pick?: { x: number; y: number } | null;
}) {
  const layers = useMemo(() => {
    const W = island.width;
    const H = island.height;
    const paths: Record<string, string[]> = { sable: [], beton: [], terre: [], parquet: [], mur: [], caisse: [] };
    const trees: [number, number][] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const g = island.ground[i];
        const c = island.cells[i];
        const rect = `M${x} ${y}h1v1h-1z`;
        if (g === SOL_SABLE) paths.sable.push(rect);
        else if (g === SOL_BETON) paths.beton.push(rect);
        else if (g === SOL_TERRE) paths.terre.push(rect);
        else if (g === SOL_PARQUET) paths.parquet.push(rect);
        if (c === ILE_MUR) paths.mur.push(rect);
        else if (c === ILE_CAISSE) paths.caisse.push(rect);
        else if (c === ILE_ARBRE) trees.push([x, y]);
      }
    }
    const land: string[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (island.ground[y * W + x] !== SOL_EAU) land.push(`M${x} ${y}h1v1h-1z`);
      }
    }
    return {
      land: land.join(""),
      sable: paths.sable.join(""),
      beton: paths.beton.join(""),
      terre: paths.terre.join(""),
      parquet: paths.parquet.join(""),
      mur: paths.mur.join(""),
      caisse: paths.caisse.join(""),
      trees,
    };
  }, [island]);

  function handleClick(e: MouseEvent<SVGSVGElement>) {
    if (!onPick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * island.width;
    const y = ((e.clientY - rect.top) / rect.height) * island.height;
    onPick(x, y);
  }

  return (
    <svg
      viewBox={`0 0 ${island.width} ${island.height}`}
      className={`h-full w-full ${onPick ? "cursor-crosshair" : ""}`}
      onClick={handleClick}
      role={onPick ? "button" : "img"}
      aria-label="Carte de l'île"
    >
      <rect x={0} y={0} width={island.width} height={island.height} fill="#1f76b8" />
      <path d={layers.land} fill="#5f9a3e" />
      <path d={layers.sable} fill="#e2cf94" />
      <path d={layers.terre} fill="#9b7a4e" />
      <path d={layers.beton} fill="#9a9c98" />
      <path d={layers.parquet} fill="#9a6c42" />
      {layers.trees.map(([x, y]) => (
        <circle key={`t${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.75} fill="#2f6f3a" />
      ))}
      <path d={layers.mur} fill="#3b3226" />
      <path d={layers.caisse} fill="#8a6236" />

      {zone && (
        <circle cx={zone.x} cy={zone.y} r={zone.r} fill="rgba(73,182,255,0.12)" stroke="#9fe0ff" strokeWidth={0.45} />
      )}

      {island.pois.map((p) => (
        <text
          key={p.name}
          x={p.x + 0.5}
          y={p.y - 1.2}
          textAnchor="middle"
          fontSize={2.4}
          fontWeight={900}
          fill="#ffffff"
          stroke="#0b1422"
          strokeWidth={0.55}
          paintOrder="stroke"
          style={{ textTransform: "uppercase", pointerEvents: "none" }}
        >
          {p.name}
        </text>
      ))}

      {pick && (
        <g style={{ pointerEvents: "none" }}>
          <circle cx={pick.x} cy={pick.y} r={2.2} fill="none" stroke="#ffe04e" strokeWidth={0.5} />
          <path d={`M${pick.x} ${pick.y - 3.4}v2.2M${pick.x} ${pick.y + 1.2}v2.2M${pick.x - 3.4} ${pick.y}h2.2M${pick.x + 1.2} ${pick.y}h2.2`} stroke="#ffe04e" strokeWidth={0.5} />
        </g>
      )}

      {me && (
        <g transform={`translate(${me.x} ${me.y}) rotate(${(-me.yaw * 180) / Math.PI})`} style={{ pointerEvents: "none" }}>
          <path d="M0 -1.8 L1.2 1.2 L0 0.5 L-1.2 1.2 Z" fill="#ffe04e" stroke="#0b1422" strokeWidth={0.3} />
        </g>
      )}
    </svg>
  );
}
