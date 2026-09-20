import { ImageResponse } from "next/og";

/**
 * L'image qui s'affiche quand quelqu'un colle un lien de Pixolud sur
 * WhatsApp, Discord, TikTok ou X. Sans elle, le lien apparait nu : c'est la
 * premiere raison pour laquelle un partage ne donne envie a personne.
 * Dessinee ici, sans fichier image.
 */
export const alt = "Pixolud — Crée, publie et joue à des mini-jeux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #17132b 0%, #3b1d7a 55%, #b3319b 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 24,
              background: "#7554dd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>Pixolud</span>
            <span style={{ fontSize: 22, opacity: 0.75 }}>pixolud.vercel.app</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ display: "flex", fontSize: 74, fontWeight: 800, letterSpacing: -2 }}>Crée, publie et joue</span>
          <span style={{ display: "flex", fontSize: 74, fontWeight: 800, letterSpacing: -2, marginTop: -14 }}>à des mini-jeux</span>
          <span style={{ fontSize: 30, opacity: 0.85 }}>
            Sans écrire une ligne de code. Et des jeux 3D dans le navigateur.
          </span>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 24 }}>
          {["🎮 Mini-jeux 2D", "🧊 Cubes", "🔫 Duel", "🕯️ Manoir", "🚪 Backrooms"].map((t) => (
            <span
              key={t}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.22)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
