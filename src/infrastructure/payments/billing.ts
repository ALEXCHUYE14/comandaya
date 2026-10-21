import "server-only";
import type { SubscriptionInfo } from "@/core/domain/types";
import { getAdminSupabase } from "../supabase/admin-server";
import { getPayment } from "./mercadopago";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProcessResult =
  | { status: "paid" | "already_paid"; subscription: SubscriptionInfo }
  | { status: "not_approved"; mp_status: string }
  | { status: "ignored" };

/**
 * Lee el pago DIRECTO de la API de Mercado Pago (fuente de verdad) y, si está aprobado,
 * extiende el plan. Idempotente: el webhook y la vuelta del cliente pueden llamarla ambos.
 */
export async function processMercadoPagoPayment(paymentId: string): Promise<ProcessResult> {
  const p = await getPayment(paymentId);
  if (!p.external_reference || !UUID.test(p.external_reference)) return { status: "ignored" };
  if (p.status !== "approved") return { status: "not_approved", mp_status: p.status };

  const method =
    p.payment_method_id === "yape" ? "yape"
    : ["credit_card", "debit_card", "prepaid_card"].includes(p.payment_type_id ?? "") ? "card"
    : "mercadopago";

  const { data, error } = await getAdminSupabase().rpc("billing_confirm_payment", {
    p_checkout: p.external_reference,
    p_provider_payment_id: String(p.id),
    p_amount: p.transaction_amount,
    p_currency: p.currency_id,
    p_method: method,
  });
  if (error) throw error;
  return data as ProcessResult;
}
