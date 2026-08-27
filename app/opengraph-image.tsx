import { ImageResponse } from "next/og";

export const alt = "gen — Intelligent Computer Discovery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card (og:image) generated at the edge — no binary asset needed. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(124,58,237,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.35), transparent 45%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "linear-gradient(135deg,#7c3aed,#3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 800,
            }}
          >
            g
          </div>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>gen</div>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>Intelligent Computer Discovery</div>
        <div style={{ fontSize: 26, color: "#a1a1aa", marginTop: 18 }}>
          Compare · Rate · Ask AI — powered by Gemini
        </div>
      </div>
    ),
    size
  );
}
