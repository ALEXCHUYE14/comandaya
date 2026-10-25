import { ImageResponse } from "next/og";
import { DEFAULT_PLAN } from "@/core/domain/mafc";

// Imagen al compartir el enlace (WhatsApp, Facebook, LinkedIn, X). Se genera en el build.
export const alt = "MAFC Comanda · Sistema POS para restaurantes en Perú";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#e07a4c";
const CREAM = "#fffaf5";

function Tile({ opacity = 1 }: { opacity?: number }) {
  return <div style={{ width: 44, height: 44, borderRadius: 10, background: CREAM, opacity }} />;
}

export default function Image() {
  const price = `S/ ${DEFAULT_PLAN.monthly_price}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#121212", color: "#eee8e0", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* Marca MAFC: cuatro bloques que encajan */}
          <div style={{ width: 120, height: 120, borderRadius: 32, background: "#b9532a", display: "flex", flexWrap: "wrap",
            alignContent: "center", justifyContent: "center", gap: 10, padding: 11 }}>
            <Tile /><Tile opacity={0.72} /><Tile opacity={0.72} /><Tile />
          </div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>
            MAFC<span style={{ color: ACCENT, marginLeft: 14 }}>Comanda</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05, display: "flex", flexDirection: "column" }}>
            <span>Sistema POS para</span>
            <span style={{ color: ACCENT }}>restaurantes en Perú</span>
          </div>
          <div style={{ fontSize: 30, color: "#a1978c" }}>Caja, cocina y carta QR conectadas en tiempo real · Yape, Plin y efectivo</div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {[`Desde ${price} al mes`, `${DEFAULT_PLAN.trial_days} días gratis`, "Hecho en Perú"].map((t) => (
            <div key={t} style={{ display: "flex", fontSize: 26, fontWeight: 700, padding: "12px 26px", borderRadius: 999,
              background: t.startsWith("Desde") ? ACCENT : "rgba(255,255,255,0.08)", color: t.startsWith("Desde") ? "#1a0d06" : "#eee8e0" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
