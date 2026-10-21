import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/shell/setup-notice";
import { PublicMenuView } from "@/features/public-menu/public-menu";
import { publicRepo } from "@/infrastructure/repositories/public.repo";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { getPublicServerSupabase } from "@/infrastructure/supabase/public-server";

export const dynamic = "force-dynamic"; // disponibilidad fresca al abrir; luego se actualiza en vivo

// Metadatos y página comparten una sola llamada a Supabase por visita
const getMenu = cache((slug: string) => publicRepo.menu(getPublicServerSupabase(), slug));

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ mesa?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured) return {};
  const menu = await getMenu(slug).catch(() => null);
  if (!menu) return { title: "Carta no encontrada" };
  return {
    title: `Carta · ${menu.tenant.name}`,
    description: menu.settings.welcome_message ?? `Pide en línea en ${menu.tenant.name}`,
    openGraph: { images: menu.settings.logo_url ? [menu.settings.logo_url] : [] },
  };
}

export default async function PublicMenuPage({ params, searchParams }: Props) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const [{ slug }, { mesa }] = await Promise.all([params, searchParams]);
  const menu = await getMenu(slug);
  if (!menu) notFound();
  return <PublicMenuView menu={menu} tableCode={mesa ?? null} />;
}
