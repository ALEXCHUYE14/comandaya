import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashClosed, CashCurrent } from "@/core/domain/types";

/** La caja sólo se escribe vía RPC: el servidor calcula el esperado y la diferencia. */
export const cashRepo = {
  async current(sb: SupabaseClient): Promise<CashCurrent | null> {
    const { data, error } = await sb.rpc("cash_current");
    if (error) throw error;
    return (data as CashCurrent | null) ?? null;
  },

  async open(sb: SupabaseClient, opening: number, notes?: string) {
    const { error } = await sb.rpc("open_cash_session", { p_opening: opening, p_notes: notes?.trim() || null });
    if (error) throw error;
  },

  async addMovement(sb: SupabaseClient, kind: "in" | "out", amount: number, reason: string) {
    const { error } = await sb.rpc("add_cash_movement", { p_kind: kind, p_amount: amount, p_reason: reason });
    if (error) throw error;
  },

  async close(sb: SupabaseClient, counted: number, notes?: string): Promise<CashClosed> {
    const { data, error } = await sb.rpc("close_cash_session", { p_counted: counted, p_notes: notes?.trim() || null });
    if (error) throw error;
    return data as CashClosed;
  },

  async history(sb: SupabaseClient, limit = 20): Promise<CashClosed[]> {
    const { data, error } = await sb.rpc("cash_history", { p_limit: limit });
    if (error) throw error;
    return (data as CashClosed[]) ?? [];
  },
};
