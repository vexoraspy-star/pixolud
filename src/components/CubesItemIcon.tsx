"use client";

import { useMemo } from "react";
import { iconDataUrl } from "@/lib/voxelIcons";

/**
 * Icone d'une chose de l'inventaire de Cubes (bloc, objet, ou 0 pour la main
 * nue). L'image est calculee une seule fois par voxelIcons.ts puis servie
 * depuis son cache ; elle est rendue au double de la taille affichee pour
 * rester nette sur les ecrans haute densite.
 */
export default function CubesItemIcon({ id, size = 36, className }: { id: number; size?: number; className?: string }) {
  const px = Math.round(size * 2);
  const src = useMemo(() => (typeof document === "undefined" ? "" : iconDataUrl(id, px)), [id, px]);
  if (!src) return <span aria-hidden="true" className={className} style={{ display: "inline-block", width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
