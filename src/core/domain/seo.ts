// SEO de MAFC Comanda: un solo lugar para títulos, descripciones y palabras clave,
// así la página de inicio, Google, WhatsApp y Facebook muestran lo mismo.

/** Dominio público (canonical, sitemap, Open Graph). Producción define NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (() => {
  const env = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  // En local (localhost) los enlaces SEO igual deben apuntar al dominio real
  return env && !/localhost|127\.0\.0\.1/.test(env) ? env : "https://mafccomanda.vercel.app";
})();

export const SITE_NAME = "MAFC Comanda";

/** Título principal: marca + búsqueda principal ("sistema para restaurantes en Perú"). */
export const SEO_TITLE = "MAFC Comanda · Sistema POS para restaurantes en Perú";

export const SEO_DESCRIPTION =
  "MAFC Comanda es el sistema para restaurantes en Perú: caja POS, pantalla de cocina y carta digital QR con pedidos en tiempo real. " +
  "Software POS económico para cevicherías, pollerías, hamburgueserías y dark kitchens. Cobra con Yape, Plin, efectivo o tarjeta. Prueba gratis.";

export const SEO_KEYWORDS = [
  "MAFC Comanda",
  "MAFC",
  "sistema para restaurantes en Perú",
  "sistema para restaurantes",
  "software POS económico para restaurantes",
  "software para restaurantes Perú",
  "POS para restaurantes",
  "sistema POS Perú",
  "punto de venta para restaurantes",
  "carta digital QR",
  "menú QR para restaurantes",
  "comandas digitales",
  "pantalla de cocina KDS",
  "sistema para cevicherías",
  "sistema para pollerías",
  "sistema para hamburgueserías",
  "caja para restaurantes con Yape y Plin",
  "cuadre de caja restaurante",
];

/** Escapa JSON-LD para insertarlo en <script> sin riesgo de inyección (recomendación de Next.js). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
