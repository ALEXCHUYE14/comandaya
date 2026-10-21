import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine, OrderType, PublicMenu, PublicOrder } from "@/core/domain/types";
import { toOrderItemsPayload } from "./orders.repo";

export const publicRepo = {
  async menu(sb: SupabaseClient, slug: string): Promise<PublicMenu | null> {
    const { data, error } = await sb.rpc("get_public_menu", { p_slug: slug });
    if (error) throw error;
    if (!data) return null;
    const menu = data as PublicMenu;
    menu.products = menu.products.map((p) => ({ ...p, price: Number(p.price) }));
    return menu;
  },

  async placeOrder(
    sb: SupabaseClient,
    input: {
      slug: string;
      orderType: OrderType;
      lines: CartLine[];
      tableCode?: string | null;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    },
  ): Promise<{ tracking_token: string; ticket_number: number; total: number }> {
    const { data, error } = await sb.rpc("place_public_order", {
      p_slug: input.slug,
      p_order_type: input.orderType,
      p_items: toOrderItemsPayload(input.lines),
      p_table_code: input.tableCode ?? null,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    return data;
  },

  async order(sb: SupabaseClient, token: string): Promise<PublicOrder | null> {
    const { data, error } = await sb.rpc("get_public_order", { p_token: token });
    if (error) throw error;
    return (data as PublicOrder) ?? null;
  },
};
