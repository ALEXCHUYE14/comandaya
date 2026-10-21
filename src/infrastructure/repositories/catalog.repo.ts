import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, DiningTable, Product } from "@/core/domain/types";

export const catalogRepo = {
  async categories(sb: SupabaseClient): Promise<Category[]> {
    const { data, error } = await sb.from("categories").select("*").order("sort_order").order("name");
    if (error) throw error;
    return data as Category[];
  },

  async products(sb: SupabaseClient): Promise<Product[]> {
    const { data, error } = await sb
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return (data as Product[]).map((p) => ({ ...p, price: Number(p.price) }));
  },

  async tables(sb: SupabaseClient): Promise<DiningTable[]> {
    const { data, error } = await sb.from("tables_or_tokens").select("*").order("sort_order").order("label");
    if (error) throw error;
    return data as DiningTable[];
  },

  async saveCategory(sb: SupabaseClient, tenantId: string, c: Partial<Category> & { name: string }) {
    const row = { tenant_id: tenantId, name: c.name.trim(), sort_order: c.sort_order ?? 0, is_active: c.is_active ?? true };
    const q = c.id
      ? sb.from("categories").update(row).eq("id", c.id)
      : sb.from("categories").insert(row);
    const { error } = await q;
    if (error) throw error;
  },

  async deleteCategory(sb: SupabaseClient, id: string) {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) throw error;
  },

  async saveProduct(sb: SupabaseClient, tenantId: string, p: Partial<Product> & { name: string; price: number }) {
    const row = {
      tenant_id: tenantId,
      name: p.name.trim(),
      description: p.description?.trim() || null,
      price: p.price,
      category_id: p.category_id || null,
      image_url: p.image_url ?? null,
      station: p.station ?? "kitchen",
      is_available: p.is_available ?? true,
      sort_order: p.sort_order ?? 0,
    };
    const q = p.id ? sb.from("products").update(row).eq("id", p.id) : sb.from("products").insert(row);
    const { error } = await q;
    if (error) throw error;
  },

  async setAvailability(sb: SupabaseClient, id: string, isAvailable: boolean) {
    const { error } = await sb.from("products").update({ is_available: isAvailable }).eq("id", id);
    if (error) throw error;
  },

  /** Borrado lógico: conserva el histórico de ventas. */
  async archiveProduct(sb: SupabaseClient, id: string) {
    const { error } = await sb.from("products").update({ is_active: false }).eq("id", id);
    if (error) throw error;
  },

  async saveTable(sb: SupabaseClient, tenantId: string, t: Partial<DiningTable> & { label: string }) {
    const row = {
      tenant_id: tenantId,
      label: t.label.trim(),
      kind: t.kind ?? "table",
      capacity: t.capacity ?? null,
      sort_order: t.sort_order ?? 0,
      is_active: t.is_active ?? true,
    };
    const q = t.id ? sb.from("tables_or_tokens").update(row).eq("id", t.id) : sb.from("tables_or_tokens").insert(row);
    const { error } = await q;
    if (error) throw error;
  },

  async deleteTable(sb: SupabaseClient, id: string) {
    const { error } = await sb.from("tables_or_tokens").delete().eq("id", id);
    if (error) throw error;
  },
};
