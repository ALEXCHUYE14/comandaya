import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/shell/setup-notice";
import { Onboarding } from "@/features/onboarding/onboarding";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { getServerSupabase } from "@/infrastructure/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bienvenida", robots: { index: false, follow: false } };

export default async function WelcomePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const sb = await getServerSupabase();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const ctx = await businessRepo.context(sb, claims.sub);
  // Con negocio (aunque esté suspendido): el layout de la app decide qué mostrar
  if (ctx.tenant || (ctx.profile?.tenant_id && ctx.profile.is_active)) redirect("/pos");

  const meta = (claims.user_metadata ?? {}) as { full_name?: string };
  return (
    <Onboarding
      email={String(claims.email ?? "")}
      fullName={meta.full_name ?? ""}
      deactivated={Boolean(ctx.profile && !ctx.profile.is_active)}
    />
  );
}
