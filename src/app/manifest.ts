import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MAFC Comanda · POS gastronómico",
    short_name: "MAFC Comanda",
    description: "Caja, cocina y carta QR en tiempo real.",
    start_url: "/pos",
    display: "standalone",
    orientation: "any",
    background_color: "#121212",
    theme_color: "#b9532a",
    lang: "es-PE",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
