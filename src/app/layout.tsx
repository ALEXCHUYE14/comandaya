import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeBootScript } from "@/components/theme";

export const metadata: Metadata = {
  title: { default: "MAFC Comanda · POS gastronómico", template: "%s · MAFC Comanda" },
  description:
    "MAFC Comanda: punto de venta, pantalla de cocina y carta QR con pedidos en tiempo real para cevicherías, broasterías, hamburgueserías y dark kitchens. Software a medida de tu negocio.",
  applicationName: "MAFC Comanda",
  appleWebApp: { capable: true, title: "MAFC Comanda", statusBarStyle: "black-translucent" },
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
