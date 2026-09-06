import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pixolud — Crée, publie et joue à des mini-jeux 2D",
    short_name: "Pixolud",
    description:
      "La plateforme communautaire pour créer, publier et jouer à des mini-jeux 2D.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
