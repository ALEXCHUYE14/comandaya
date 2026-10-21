import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Mercado Pago Checkout Pro: el cliente paga en la página de Mercado Pago (tarjeta y los
// medios que tu cuenta tenga habilitados). Nunca tocamos datos de tarjeta.
const API = "https://api.mercadopago.com";

const accessToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";

export function isMercadoPagoConfigured(): boolean {
  return Boolean(accessToken() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${body.message ?? "error"}`);
  return body;
}

export async function createPreference(input: {
  checkoutId: string;
  title: string;
  amount: number;
  payerEmail?: string | null;
  siteUrl: string;
}): Promise<{ id: string; init_point: string }> {
  const https = input.siteUrl.startsWith("https://");
  return mp("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.checkoutId },
    body: JSON.stringify({
      items: [{ id: "mafc-comanda", title: input.title.slice(0, 250), quantity: 1, unit_price: input.amount, currency_id: "PEN" }],
      ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
      external_reference: input.checkoutId,
      statement_descriptor: "MAFC COMANDA",
      back_urls: {
        success: `${input.siteUrl}/plan?pago=ok`,
        pending: `${input.siteUrl}/plan?pago=pendiente`,
        failure: `${input.siteUrl}/plan?pago=error`,
      },
      // Mercado Pago sólo acepta volver solo y avisar por webhook a URLs públicas https
      ...(https ? { auto_return: "approved", notification_url: `${input.siteUrl}/api/billing/webhook` } : {}),
    }),
  });
}

export interface MpPayment {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  payment_method_id: string | null;
  payment_type_id: string | null;
}

export function getPayment(id: string): Promise<MpPayment> {
  if (!/^\d{1,20}$/.test(id)) throw new Error("N.º de pago inválido");
  return mp(`/v1/payments/${id}`);
}

/**
 * Firma del webhook: HMAC-SHA256(secreto, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")
 * comparada con v1 del header x-signature ("ts=...,v1=...").
 */
export function verifyWebhookSignature(opts: { xSignature: string; xRequestId: string | null; dataId: string; secret: string }): boolean {
  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const expected = Buffer.from(v1, "hex");
  return [opts.dataId, opts.dataId.toLowerCase()].some((id) => {
    let manifest = `id:${id};`;
    if (opts.xRequestId) manifest += `request-id:${opts.xRequestId};`;
    manifest += `ts:${ts};`;
    const got = createHmac("sha256", opts.secret).update(manifest).digest();
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
