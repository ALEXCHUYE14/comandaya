import { NextResponse, type NextRequest } from "next/server";
import { processMercadoPagoPayment } from "@/infrastructure/payments/billing";
import { isMercadoPagoConfigured } from "@/infrastructure/payments/mercadopago";
import { getServerSupabase } from "@/infrastructure/supabase/server";

/** Al volver de Mercado Pago: confirma el pago al instante (por si el webhook tarda o no llega). */
export async function GET(request: NextRequest) {
  if (!isMercadoPagoConfigured()) return NextResponse.json({ error: "Pago en línea no activado" }, { status: 503 });
  const sb = await getServerSupabase();
  const { data: auth } = await sb.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  const paymentId = request.nextUrl.searchParams.get("payment_id") ?? "";
  if (!/^\d{1,20}$/.test(paymentId)) return NextResponse.json({ error: "N.º de pago inválido" }, { status: 400 });
  try {
    return NextResponse.json(await processMercadoPagoPayment(paymentId));
  } catch (err) {
    console.error("[billing/verify]", err);
    return NextResponse.json({ error: "No pudimos confirmar el pago todavía" }, { status: 502 });
  }
}
