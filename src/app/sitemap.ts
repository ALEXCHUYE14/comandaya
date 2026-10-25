import type { MetadataRoute } from "next";
import { SITE_URL } from "@/core/domain/seo";

/** Páginas públicas que Google debe conocer (las privadas están bloqueadas en robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/registro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
