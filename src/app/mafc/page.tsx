import { notFound, redirect } from "next/navigation";
import { SetupNotice } from "@/components/shell/setup-notice";
import { AdminScreen } from "@/features/platform/admin-screen";
import { subscriptionRepo } from "@/infrastructure/repositories/subscription.repo";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { getServerSupabase } from "@/infrastructure/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel MAFC", robots: { index: false, follow: false } };

/** Panel de la plataforma: sólo usuarios en platform_admins. A los demás no se les revela que existe. */
export default async function PlatformAdminPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const sb = await getServerSupabase();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=/mafc");
  if (!(await subscriptionRepo.isPlatformAdmin(sb).catch(() => false))) notFound();
  return <AdminScreen />;
}
