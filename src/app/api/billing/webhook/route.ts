import { NextResponse, type NextRequest } from "next/server";
import { processMercadoPagoPayment } from "@/infrastructure/payments/billing";
import { isMercadoPagoConfigured, verifyWebhookSignature } from "@/infrastructure/payments/mercadopago";

/**
 * Aviso de Mercado Pago. No se confía en el contenido del aviso: sólo se usa el n.º de pago
 * para leerlo de la API de Mercado Pago. La firma (si configuras el secreto) frena avisos falsos.
 * Responder 5xx hace que Mercado Pago reintente.
 */
export async function POST(request: NextRequest) {
  if (!isMercadoPagoConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  const url = request.nextUrl;
  const body = (await request.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic;
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body.data?.id != null ? String(body.data.id) : null);
  // Sólo avisos de pago con n.º numérico; lo demás se ignora con 200 para que no se reintente
  if (type !== "payment" || !dataId || !/^\d{1,20}$/.test(dataId)) return NextResponse.json({ ok: true, ignored: true });

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature");
  if (secret && signature &&
      !verifyWebhookSignature({ xSignature: signature, xRequestId: request.headers.get("x-request-id"), dataId, secret })) {
    return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 });
  }

  try {
    const result = await processMercadoPagoPayment(dataId);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[billing/webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
