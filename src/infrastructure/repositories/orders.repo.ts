import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CartLine,
  Order,
  OrderStatus,
  OrderType,
  OrderWithItems,
  PaymentMethod,
} from "@/core/domain/types";
import { computeChange } from "@/core/domain/order-rules";

const ORDER_SELECT = "*, order_items(*), table:tables_or_tokens(id,label)";

export function toOrderItemsPayload(lines: CartLine[]) {
  return lines.map((l) => ({
    product_id: l.productId,
    quantity: l.quantity,
    notes: l.notes?.trim() || null,
  }));
}

export const ordersRepo = {
  /** Pedidos en curso + cerrados de hoy (para el tablero de caja y el KDS). */
  async listBoard(sb: SupabaseClient): Promise<OrderWithItems[]> {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString();
    const { data, error } = await sb
      .from("orders")
      .select(ORDER_SELECT)
      .or(`status.in.(pending,preparing,ready),created_at.gte.${since}`)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw error;
    return (data ?? []) as OrderWithItems[];
  },

  async create(
    sb: SupabaseClient,
    input: {
      orderType: OrderType;
      lines: CartLine[];
      tableId?: string | null;
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    },
  ): Promise<Order> {
    const { data, error } = await sb.rpc("pos_create_order", {
      p_order_type: input.orderType,
      p_items: toOrderItemsPayload(input.lines),
      p_table_id: input.tableId ?? null,
      p_customer_name: input.customerName ?? null,
      p_customer_phone: input.customerPhone ?? null,
      p_notes: input.notes ?? null,
    });
    if (error) throw error;
    return data as Order;
  },

  async setStatus(sb: SupabaseClient, id: string, status: OrderStatus, reason?: string) {
    const patch = status === "cancelled" && reason?.trim() ? { status, cancel_reason: reason.trim().slice(0, 200) } : { status };
    let { error } = await sb.from("orders").update(patch).eq("id", id);
    // Base sin migrar aún (falta la columna cancel_reason): anula igual, sin motivo
    if (error?.code === "PGRST204" && "cancel_reason" in patch) {
      ({ error } = await sb.from("orders").update({ status }).eq("id", id));
    }
    if (error) throw error;
  },

  async registerPayment(
    sb: SupabaseClient,
    order: Pick<Order, "id" | "total" | "status">,
    method: PaymentMethod,
    received?: number,
    closeOrder = false,
  ) {
    const amount = method === "cash" ? (received ?? order.total) : order.total;
    const { error } = await sb
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: method,
        amount_received: amount,
        change_given: method === "cash" ? computeChange(order.total, amount) : 0,
        ...(closeOrder ? { status: "closed" as const } : {}),
      })
      .eq("id", order.id);
    if (error) throw error;
  },

  async setDiscount(sb: SupabaseClient, id: string, discount: number) {
    const { error } = await sb.from("orders").update({ discount }).eq("id", id);
    if (error) throw error;
  },

  async addItems(sb: SupabaseClient, order: Pick<Order, "id" | "tenant_id">, lines: CartLine[]) {
    const rows = lines.map((l) => ({
      tenant_id: order.tenant_id,
      order_id: order.id,
      product_id: l.productId,
      quantity: l.quantity,
      notes: l.notes?.trim() || null,
    }));
    const { error } = await sb.from("order_items").insert(rows);
    if (error) throw error;
  },
};
