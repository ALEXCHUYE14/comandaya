import { NextResponse, type NextRequest } from "next/server";
import { errorMessage } from "@/core/lib/cn";
import { createPreference, isMercadoPagoConfigured } from "@/infrastructure/payments/mercadopago";
import { SITE_URL } from "@/infrastructure/supabase/env";
import { getServerSupabase } from "@/infrastructure/supabase/server";

/** Paso 1 del pago en línea: crea el intento (monto fijado por la base) y la preferencia de Mercado Pago. */
export async function POST(request: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: "El pago en línea aún no está activado" }, { status: 503 });
  }
  const sb = await getServerSupabase();
  const { data: auth } = await sb.auth.getClaims();
  if (!auth?.claims?.sub) return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { months?: unknown };
  const months = Number(body.months);
  if (![1, 3, 6, 12].includes(months)) return NextResponse.json({ error: "Elige 1, 3, 6 o 12 meses" }, { status: 400 });

  const { data, error } = await sb.rpc("billing_create_checkout", { p_months: months });
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  const checkout = data as { id: string; months: number; amount: number; plan_name: string; tenant: { name: string }; payer_email: string | null };

  try {
    const pref = await createPreference({
      checkoutId: checkout.id,
      title: `${checkout.plan_name} · ${checkout.months === 1 ? "1 mes" : `${checkout.months} meses`} · ${checkout.tenant.name}`,
      amount: Number(checkout.amount),
      payerEmail: checkout.payer_email,
      siteUrl: SITE_URL || request.nextUrl.origin,
    });
    return NextResponse.json({ url: pref.init_point });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return NextResponse.json({ error: "Mercado Pago no respondió. Intenta otra vez o paga por Yape." }, { status: 502 });
  }
}
