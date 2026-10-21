import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminTenantRow,
  MySubscription,
  PlatformSettings,
  SubscriptionInfo,
  SubscriptionPayMethod,
  SubscriptionPayment,
} from "@/core/domain/types";

/** ¿La base todavía no tiene las RPC de planes? (schema.sql sin aplicar) */
export function isMissingRpc(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "PGRST202" || /could not find the function|schema cache/i.test(e?.message ?? "");
}

export const subscriptionRepo = {
  /** Plan del negocio del usuario. Funciona aunque el negocio esté suspendido. */
  async mine(sb: SupabaseClient): Promise<MySubscription | null> {
    const { data, error } = await sb.rpc("my_subscription");
    if (error) throw error;
    return (data as MySubscription | null) ?? null;
  },

  async isPlatformAdmin(sb: SupabaseClient): Promise<boolean> {
    const { data, error } = await sb.rpc("is_platform_admin");
    if (error) {
      if (isMissingRpc(error)) return false;
      throw error;
    }
    return Boolean(data);
  },

  // ---- Panel MAFC (la base valida is_platform_admin en cada llamada) ----

  async listTenants(sb: SupabaseClient): Promise<AdminTenantRow[]> {
    const { data, error } = await sb.rpc("admin_list_tenants");
    if (error) throw error;
    return (data as AdminTenantRow[]) ?? [];
  },

  async tenantPayments(sb: SupabaseClient, tenantId: string): Promise<SubscriptionPayment[]> {
    const { data, error } = await sb.rpc("admin_tenant_payments", { p_tenant: tenantId });
    if (error) throw error;
    return (data as SubscriptionPayment[]) ?? [];
  },

  async recordPayment(
    sb: SupabaseClient,
    input: { tenantId: string; months: number; amount: number; method: SubscriptionPayMethod; reference?: string },
  ): Promise<SubscriptionInfo> {
    const { data, error } = await sb.rpc("admin_record_payment", {
      p_tenant: input.tenantId,
      p_months: input.months,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference?.trim() || null,
    });
    if (error) throw error;
    return data as SubscriptionInfo;
  },

  async voidPayment(sb: SupabaseClient, paymentId: string): Promise<SubscriptionInfo> {
    const { data, error } = await sb.rpc("admin_void_payment", { p_payment: paymentId });
    if (error) throw error;
    return data as SubscriptionInfo;
  },

  async setSubscription(
    sb: SupabaseClient,
    input: { tenantId: string; override: "suspended" | "free" | null; extendTrialDays?: number; notes?: string },
  ): Promise<SubscriptionInfo> {
    const { data, error } = await sb.rpc("admin_set_subscription", {
      p_tenant: input.tenantId,
      p_override: input.override,
      p_extend_trial_days: input.extendTrialDays ?? 0,
      p_notes: input.notes?.trim() || null,
    });
    if (error) throw error;
    return data as SubscriptionInfo;
  },

  async platformSettings(sb: SupabaseClient): Promise<PlatformSettings> {
    const { data, error } = await sb.rpc("admin_get_platform_settings");
    if (error) throw error;
    return data as PlatformSettings;
  },

  async updatePlatformSettings(sb: SupabaseClient, patch: PlatformSettings): Promise<PlatformSettings> {
    const { data, error } = await sb.rpc("admin_update_platform_settings", { p: patch });
    if (error) throw error;
    return data as PlatformSettings;
  },
};
