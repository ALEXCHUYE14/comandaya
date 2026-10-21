import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order, SalesReport } from "@/core/domain/types";

export type ExportRow = Pick<
  Order,
  | "ticket_number" | "business_date" | "created_at" | "order_type" | "source" | "status"
  | "payment_status" | "payment_method" | "subtotal" | "discount" | "total"
  | "customer_name" | "cancel_reason"
>;

const EXPORT_COLUMNS =
  "ticket_number,business_date,created_at,order_type,source,status,payment_status,payment_method,subtotal,discount,total,customer_name,cancel_reason";
const PAGE = 1000; // límite de filas por respuesta de Supabase
const MAX_ROWS = 20_000;

export const reportsRepo = {
  /** Resumen agregado en el servidor: una sola llamada por rango. */
  async sales(sb: SupabaseClient, from: string, to: string): Promise<SalesReport> {
    const { data, error } = await sb.rpc("sales_report", { p_from: from, p_to: to });
    if (error) throw error;
    return data as SalesReport;
  },

  /** Pedidos del rango para Excel. Sólo se descarga cuando el usuario lo pide. */
  async ordersForExport(sb: SupabaseClient, from: string, to: string): Promise<ExportRow[]> {
    const rows: ExportRow[] = [];
    for (let start = 0; start < MAX_ROWS; start += PAGE) {
      const { data, error } = await sb
        .from("orders")
        .select(EXPORT_COLUMNS)
        .gte("business_date", from)
        .lte("business_date", to)
        .order("business_date")
        .order("ticket_number")
        .range(start, start + PAGE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as ExportRow[]));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  },
};
