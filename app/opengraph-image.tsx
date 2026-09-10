import { ImageResponse } from "next/og";

export const alt = "ONE DemoOps Control Plane — independent synthetic systems portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          color: "#f3f5f7",
          background: "linear-gradient(135deg, #0b0e12 0%, #10151a 58%, #0b211b 100%)",
          borderTop: "12px solid #9966CC",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #9966CC",
              borderRadius: 14,
              color: "#36c994",
              fontSize: 25,
              fontWeight: 800,
            }}
          >
            1
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 25, fontWeight: 800, letterSpacing: 8 }}>ONE</span>
            <span style={{ color: "#a7b0b8", fontSize: 18 }}>DemoOps Control Plane</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ color: "#36c994", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>
            OBSERVE → GOVERN → REMEDIATE → LEARN
          </span>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 760, lineHeight: 1.02 }}>
            <span>ONE DemoOps</span>
            <span style={{ color: "#b58ae0" }}>Control Plane</span>
          </div>
          <span style={{ maxWidth: 900, color: "#c8cfd5", fontSize: 25, lineHeight: 1.45 }}>
            A synthetic, agent-assisted command center for reliability, access governance,
            change intelligence, and operational readiness.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#89949d", fontSize: 17 }}>
          <span>Independent synthetic training artifact</span>
          <span style={{ color: "#36c994" }}>Built with ONE</span>
        </div>
      </div>
    ),
    size,
  );
}
