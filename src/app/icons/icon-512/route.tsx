import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 55%, #f97316 100%)",
          fontSize: 320,
        }}
      >
        🎮
      </div>
    ),
    { ...size },
  );
}
