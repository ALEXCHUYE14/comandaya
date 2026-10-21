import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole, BusinessSettings, Tenant, UserProfile } from "@/core/domain/types";
import { ASSETS_BUCKET } from "../supabase/env";

export type AssetKind = "logo" | "yape" | "plin" | "products";

export const businessRepo = {
  async context(sb: SupabaseClient, userId: string) {
    const { data: profile, error } = await sb
      .from("users_profile")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.tenant_id || !profile.is_active) return { profile: profile as UserProfile | null, tenant: null, settings: null };

    const [{ data: tenant }, { data: settings }] = await Promise.all([
      sb.from("tenants").select("*").eq("id", profile.tenant_id).single(),
      sb.from("business_settings").select("*").eq("tenant_id", profile.tenant_id).single(),
    ]);
    return {
      profile: profile as UserProfile,
      tenant: tenant as Tenant,
      settings: settings as BusinessSettings,
    };
  },

  async createTenant(sb: SupabaseClient, input: { name: string; slug: string; fullName: string; seedDemo: boolean }) {
    const { data, error } = await sb.rpc("create_tenant", {
      p_business_name: input.name,
      p_slug: input.slug,
      p_full_name: input.fullName,
      p_seed_demo: input.seedDemo,
    });
    if (error) throw error;
    return data as string;
  },

  async updateSettings(sb: SupabaseClient, tenantId: string, patch: Partial<BusinessSettings>) {
    const { tenant_id: _ignored, ...rest } = patch;
    const { error } = await sb.from("business_settings").update(rest).eq("tenant_id", tenantId);
    if (error) throw error;
  },

  async renameTenant(sb: SupabaseClient, tenantId: string, name: string) {
    const { error } = await sb.from("tenants").update({ name }).eq("id", tenantId);
    if (error) throw error;
  },

  async uploadAsset(sb: SupabaseClient, tenantId: string, kind: AssetKind, file: File): Promise<string> {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${tenantId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(ASSETS_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
    if (error) throw error;
    return sb.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
  },

  /**
   * Borra del bucket las imágenes que ya nadie usa (reemplazadas o descartadas).
   * Sólo toca archivos de la carpeta del negocio; si falla no interrumpe nada.
   */
  async removeAssets(sb: SupabaseClient, tenantId: string, urls: (string | null | undefined)[]) {
    const marker = `/storage/v1/object/public/${ASSETS_BUCKET}/`;
    const paths = urls.flatMap((u) => {
      const i = u ? u.indexOf(marker) : -1;
      if (!u || i < 0) return [];
      const path = decodeURIComponent(u.slice(i + marker.length).split("?")[0] ?? "");
      return path.startsWith(`${tenantId}/`) ? [path] : [];
    });
    if (!paths.length) return;
    await sb.storage.from(ASSETS_BUCKET).remove(paths).catch(() => undefined);
  },

  async team(sb: SupabaseClient): Promise<UserProfile[]> {
    const { data, error } = await sb.from("users_profile").select("*").order("created_at");
    if (error) throw error;
    return data as UserProfile[];
  },

  async addStaff(sb: SupabaseClient, email: string, role: AppRole, fullName?: string) {
    const { error } = await sb.rpc("add_staff_member", { p_email: email, p_role: role, p_full_name: fullName ?? null });
    if (error) throw error;
  },

  async updateStaff(sb: SupabaseClient, id: string, patch: { role?: AppRole; is_active?: boolean }) {
    const { error } = await sb.from("users_profile").update(patch).eq("id", id);
    if (error) throw error;
  },
};
