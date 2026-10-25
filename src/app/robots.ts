import type { MetadataRoute } from "next";
import { SITE_URL } from "@/core/domain/seo";

/** Google indexa la página de inicio y las cartas públicas; nunca las zonas privadas del sistema. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/pos", "/cuadre", "/cocina", "/reportes", "/catalogo", "/mesas", "/ajustes", "/plan",
          "/mafc", "/bienvenida", "/restablecer",
          "/carta/*/pedido/", // seguimiento privado de cada pedido
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
