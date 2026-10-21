import QRCode from "qrcode";
import { SITE_URL } from "@/infrastructure/supabase/env";

export function publicMenuUrl(slug: string, tableCode?: string) {
  const base = SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/carta/${slug}${tableCode ? `?mesa=${tableCode}` : ""}`;
}

const QR_OPTS = { errorCorrectionLevel: "M" as const, margin: 1, color: { dark: "#121212", light: "#ffffff" } };

export function qrSvg(text: string) {
  return QRCode.toString(text, { ...QR_OPTS, type: "svg" });
}

export function qrPng(text: string, width = 1024) {
  return QRCode.toDataURL(text, { ...QR_OPTS, width });
}

function trigger(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadQr(text: string, filename: string, format: "svg" | "png") {
  if (format === "png") return trigger(await qrPng(text), `${filename}.png`);
  const url = URL.createObjectURL(new Blob([await qrSvg(text)], { type: "image/svg+xml" }));
  trigger(url, `${filename}.svg`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hoja A4 lista para imprimir con un QR por mesa (para plastificar y pegar). */
export async function printQrSheet(business: string, cards: { title: string; url: string }[]) {
  const svgs = await Promise.all(cards.map((c) => qrSvg(c.url)));
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR · ${esc(business)}</title><style>
    @page { size: A4; margin: 10mm }
    body { font-family: system-ui, sans-serif; margin: 0; color: #121212 }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm }
    .card { border: 1.5px dashed #999; border-radius: 6mm; padding: 7mm; text-align: center; break-inside: avoid }
    .card svg { width: 62mm; height: 62mm } h2 { margin: 0 0 1mm; font-size: 20pt } h3 { margin: 0 0 3mm; font-size: 11pt; color: #b9532a; letter-spacing: .08em; text-transform: uppercase }
    p { margin: 3mm 0 0; font-size: 10pt; color: #555 }
  </style></head><body><div class="grid">${cards
    .map((c, i) => `<div class="card"><h3>${esc(business)}</h3><h2>${esc(c.title)}</h2>${svgs[i]}<p>Escanea, mira la carta y pide desde tu celular</p></div>`)
    .join("")}</div><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
  w.document.close();
}
