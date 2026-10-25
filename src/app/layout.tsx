import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeBootScript } from "@/components/theme";
import { SEO_DESCRIPTION, SEO_KEYWORDS, SEO_TITLE, SITE_NAME, SITE_URL } from "@/core/domain/seo";

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  // Base para que Open Graph, sitemap y canonical generen URLs absolutas del dominio real
  metadataBase: new URL(SITE_URL),
  title: { default: SEO_TITLE, template: `%s · ${SITE_NAME}` },
  description: SEO_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "MAFC", url: SITE_URL }],
  creator: "MAFC",
  publisher: "MAFC",
  category: "Software para restaurantes",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_PE",
    title: SEO_TITLE,
    description: SEO_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: SEO_TITLE, description: SEO_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
