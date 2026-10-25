import { redirect } from "next/navigation";
import type { MySubscription } from "@/core/domain/types";
import { AppShell } from "@/components/shell/app-shell";
import { SetupNotice } from "@/components/shell/setup-notice";
import { SessionProvider } from "@/features/session/session-context";
import { SuspendedScreen } from "@/features/subscription/suspended-screen";
import { isMercadoPagoConfigured } from "@/infrastructure/payments/mercadopago";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { subscriptionRepo } from "@/infrastructure/repositories/subscription.repo";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { getServerSupabase } from "@/infrastructure/supabase/server";

export const dynamic = "force-dynamic";
// Zona privada del sistema: nunca debe aparecer en buscadores
export const metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const sb = await getServerSupabase();
  const { data } = await sb.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/login");

  // El plan se revisa antes que el negocio: suspendido, el negocio no es legible (RLS).
  // Si la base aún no tiene planes o falla la consulta, no se bloquea a nadie.
  const subscription: MySubscription | null = await subscriptionRepo.mine(sb).catch(() => null);
  if (subscription && subscription.has_access === false) return <SuspendedScreen sub={subscription} onlinePayments={isMercadoPagoConfigured()} />;

  const ctx = await businessRepo.context(sb, uid);
  if (!ctx.profile || !ctx.tenant || !ctx.settings) redirect("/bienvenida");

  return (
    <SessionProvider initial={{ profile: ctx.profile, tenant: ctx.tenant, settings: ctx.settings, subscription }}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
