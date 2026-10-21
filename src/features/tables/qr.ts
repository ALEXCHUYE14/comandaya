import QRCode from "qrcode";
import { SITE_URL } from "@/infrastructure/supabase/env";

export function publicMenuUrl(slug: string, tableCode?: string) {
  const base = SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/carta/${slug}${tableCode ? `?mesa=${tableCode}` : ""}`;
}

// Corrección "Q" (25 %): el QR se sigue leyendo aunque el cartel plastificado tenga brillo o rayones
const QR_OPTS = { errorCorrectionLevel: "Q" as const, margin: 1, color: { dark: "#121212", light: "#ffffff" } };

export function qrSvg(text: string) {
  return QRCode.toString(text, { ...QR_OPTS, type: "svg" });
}

export function qrPng(text: string, width = 1024) {
  return QRCode.toDataURL(text, { ...QR_OPTS, margin: 2, width });
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

// ---------------------------------------------------------------------------
// Cartel QR profesional (carta general o mesa): mismo diseño en pantalla,
// impresión y PNG descargable.
// ---------------------------------------------------------------------------

export interface QrPoster {
  business: string;
  address?: string | null;
  phone?: string | null;
  welcome?: string | null;
  logoUrl?: string | null;
  /** Nombre de la mesa; sin él es el cartel general de la carta. */
  table?: string | null;
  url: string;
}

export const posterKicker = (p: QrPoster) => (p.table ? "Pide desde tu mesa" : "Carta digital");
export const posterHeadline = (p: QrPoster) => (p.table ? "Escanea y pide aquí" : "Escanea y mira nuestra carta");
export const posterHint = "Abre la cámara de tu celular y apunta al código";
/** URL legible sin el código interno de la mesa ("mafccomanda.vercel.app/carta/mi-local"). */
export const posterDisplayUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
export const posterContact = (p: QrPoster) => [p.address, p.phone].map((s) => s?.trim()).filter(Boolean).join(" · ");
/** Descripción corta: la bienvenida del negocio, recortada a un largo que entra en el cartel. */
export const posterWelcome = (p: QrPoster) => {
  const w = p.welcome?.trim();
  if (!w) return "";
  return w.length > 110 ? `${w.slice(0, 107).trimEnd()}…` : w;
};

const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
// "Figtree Variable" es la fuente que la app ya trae cargada (respaldo inmediato para el PNG)
const SANS = "'Figtree', 'Figtree Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Figtree:wght@400;500;600;700&display=swap";
const ACCENT = "#b9532a";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Imprime uno o varios carteles. Uno solo sale grande; varios, dos por hoja A4. */
export async function printQrPosters(posters: QrPoster[]) {
  if (!posters.length) return;
  const w = window.open("", "_blank");
  if (!w) return;
  const svgs = await Promise.all(posters.map((p) => qrSvg(p.url)));
  const single = posters.length === 1;
  const cards = posters.map((p, i) => {
    const contact = posterContact(p);
    const welcome = posterWelcome(p);
    return `<article class="card">
      <p class="kicker">${esc(posterKicker(p))}</p>
      ${p.logoUrl ? `<img class="logo" src="${esc(p.logoUrl)}" alt="">` : ""}
      <h1>${esc(p.business)}</h1>
      ${contact ? `<p class="contact">${esc(contact)}</p>` : ""}
      ${p.table ? `<p class="table">${esc(p.table)}</p>` : ""}
      <div class="qr">${svgs[i]}</div>
      <h2>${esc(posterHeadline(p))}</h2>
      ${welcome ? `<p class="welcome">${esc(welcome)}</p>` : ""}
      <p class="hint">${esc(posterHint)}</p>
      <p class="url">${esc(posterDisplayUrl(p.url))}</p>
    </article>`;
  });

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Carteles QR · ${esc(posters[0]!.business)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_CSS}">
<style>
  @page { size: A4; margin: 10mm }
  * { box-sizing: border-box }
  body { margin: 0; color: #121212; font-family: ${SANS}; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .grid { display: grid; grid-template-columns: ${single ? "1fr" : "repeat(2, 1fr)"}; gap: 8mm; justify-items: center }
  .card { width: ${single ? "150mm" : "92mm"}; border: ${single ? "0.8mm" : "0.6mm"} solid #121212; border-radius: ${single ? "9mm" : "6mm"};
          padding: ${single ? "12mm 12mm 9mm" : "7mm 6mm 5mm"}; text-align: center; break-inside: avoid; page-break-inside: avoid; background: #fff }
  .kicker { margin: 0; color: ${ACCENT}; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; font-size: ${single ? "12pt" : "8pt"} }
  .logo { display: block; margin: ${single ? "4mm" : "2.5mm"} auto 0; width: ${single ? "18mm" : "12mm"}; height: ${single ? "18mm" : "12mm"}; object-fit: cover; border-radius: 3mm }
  h1 { margin: ${single ? "3mm" : "2mm"} 0 0; font-family: ${SERIF}; font-weight: 700; line-height: 1.05; font-size: ${single ? "32pt" : "19pt"} }
  .contact { margin: ${single ? "2.5mm" : "1.5mm"} 0 0; color: #555; font-size: ${single ? "11.5pt" : "8pt"} }
  .table { display: inline-block; margin: ${single ? "4mm" : "2.5mm"} 0 0; padding: .8mm 4mm; border-radius: 99px; background: #121212; color: #fff;
           font-weight: 700; font-size: ${single ? "14pt" : "10pt"} }
  .qr { margin: ${single ? "8mm" : "5mm"} auto ${single ? "7mm" : "4mm"}; width: ${single ? "95mm" : "56mm"}; height: ${single ? "95mm" : "56mm"} }
  .qr svg { width: 100%; height: 100%; display: block }
  h2 { margin: 0; font-family: ${SERIF}; font-weight: 600; font-size: ${single ? "22pt" : "13.5pt"} }
  .welcome { margin: ${single ? "2.5mm" : "1.5mm"} auto 0; max-width: 92%; color: #333; font-size: ${single ? "11.5pt" : "8pt"} }
  .hint { margin: ${single ? "2.5mm" : "1.5mm"} 0 0; color: #555; font-size: ${single ? "11pt" : "7.5pt"} }
  .url { margin: ${single ? "6mm" : "3.5mm"} 0 0; color: #777; font-size: ${single ? "10pt" : "7pt"}; word-break: break-all }
</style></head><body><div class="grid">${cards.join("")}</div>
<script>
  // Espera fuentes e imágenes antes de imprimir para que el cartel salga completo
  window.addEventListener("load", function () {
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () { setTimeout(function () { window.print(); }, 150); });
  });
</script></body></html>`);
  w.document.close();
}

// ---- PNG del cartel (para enviar por WhatsApp o mandar a imprimir) ----

let fontsLoading: Promise<void> | null = null;
/** Carga Fraunces/Figtree en la página sólo cuando se descarga un cartel (si falla, usa Georgia). */
export function ensurePosterFonts(): Promise<void> {
  if (fontsLoading) return fontsLoading;
  fontsLoading = new Promise<void>((resolve) => {
    // document.fonts.load() responde al instante si el @font-face aún no existe:
    // primero hay que esperar a que la hoja de estilos de las fuentes termine de cargar.
    let link = document.querySelector<HTMLLinkElement>(`link[href="${FONTS_CSS}"]`);
    const sheetReady = new Promise<void>((done) => {
      if (link?.sheet) return done();
      if (!link) {
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = FONTS_CSS;
        document.head.appendChild(link);
      }
      link.addEventListener("load", () => done(), { once: true });
      link.addEventListener("error", () => done(), { once: true });
    });
    const loads = sheetReady.then(() => Promise.all([
      document.fonts.load("700 64px Fraunces"),
      document.fonts.load("600 40px Fraunces"),
      document.fonts.load("500 28px Figtree"),
      document.fonts.load("700 24px Figtree"),
    ])).then(() => undefined, () => undefined);
    void Promise.race([loads, new Promise((r) => setTimeout(r, 3000))]).then(() => resolve());
  });
  return fontsLoading;
}

async function loadBitmap(src: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(src, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null; // sin CORS o sin red: el cartel sale sin logo
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1]!;
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

/** Dibuja el cartel en 1200×1560 px (proporción del cartel impreso) y lo descarga como PNG. */
export async function downloadQrPoster(p: QrPoster, filename: string) {
  await ensurePosterFonts();
  const W = 1200, H = 1560, PAD = 70;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite generar la imagen");
  const serif = (weight: number, size: number) => `${weight} ${size}px ${SERIF}`;
  const sans = (weight: number, size: number) => `${weight} ${size}px ${SANS}`;
  const center = (text: string, y: number) => ctx.fillText(text, W / 2, y);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#121212";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(PAD / 2, PAD / 2, W - PAD, H - PAD, 56);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  let y = 150;
  ctx.fillStyle = ACCENT;
  ctx.font = sans(700, 30);
  ctx.letterSpacing = "8px";
  center(posterKicker(p).toUpperCase(), y);
  ctx.letterSpacing = "0px";

  if (p.logoUrl) {
    const logo = await loadBitmap(p.logoUrl);
    if (logo) {
      const s = 110;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(W / 2 - s / 2, y + 28, s, s, 24);
      ctx.clip();
      const r = Math.max(s / logo.width, s / logo.height);
      ctx.drawImage(logo, W / 2 - (logo.width * r) / 2, y + 28 + s / 2 - (logo.height * r) / 2, logo.width * r, logo.height * r);
      ctx.restore();
      y += s + 28;
    }
  }

  // Nombre: se achica hasta entrar en una línea (nombres largos)
  ctx.fillStyle = "#121212";
  let size = 84;
  ctx.font = serif(700, size);
  while (ctx.measureText(p.business).width > W - PAD * 3 && size > 44) ctx.font = serif(700, (size -= 4));
  y += size + 22;
  center(p.business, y);

  const contact = posterContact(p);
  if (contact) {
    ctx.fillStyle = "#555555";
    ctx.font = sans(500, 30);
    for (const line of wrapLines(ctx, contact, W - PAD * 3, 2)) center(line, (y += 48));
  }

  if (p.table) {
    ctx.font = sans(700, 36);
    const tw = ctx.measureText(p.table).width + 64;
    y += 40;
    ctx.fillStyle = "#121212";
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2, y, tw, 62, 31);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    center(p.table, y + 44);
    y += 62;
  }

  // Código QR (el espacio restante se reparte para que todo entre)
  const welcome = posterWelcome(p);
  const bottomBlock = 70 + (welcome ? 90 : 0) + 50 + 80;
  const available = H - PAD - (y + 50) - bottomBlock - 40;
  const qrSize = Math.min(700, available);
  // Si sobra espacio (cartel con poco texto), el bloque QR + texto queda centrado
  y += Math.max(0, available - qrSize) / 2;
  const qrImg = await loadBitmap(await qrPng(p.url, 900));
  if (!qrImg) throw new Error("No se pudo generar el código QR");
  ctx.drawImage(qrImg, W / 2 - qrSize / 2, y + 50, qrSize, qrSize);
  y += 50 + qrSize;

  ctx.fillStyle = "#121212";
  ctx.font = serif(600, 54);
  center(posterHeadline(p), (y += 92));
  if (welcome) {
    ctx.fillStyle = "#333333";
    ctx.font = sans(500, 30);
    for (const line of wrapLines(ctx, welcome, W - PAD * 4, 2)) center(line, (y += 46));
  }
  ctx.fillStyle = "#555555";
  ctx.font = sans(500, 29);
  center(posterHint, (y += 52));
  ctx.fillStyle = "#777777";
  ctx.font = sans(500, 26);
  center(posterDisplayUrl(p.url), H - PAD - 30);

  trigger(canvas.toDataURL("image/png"), `${filename}.png`);
}
