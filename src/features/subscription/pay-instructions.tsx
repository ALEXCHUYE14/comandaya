"use client";

import { MessageCircle, Smartphone } from "lucide-react";
import type { MySubscription } from "@/core/domain/types";
import { money, whatsappLink } from "@/core/domain/order-rules";
import { Button } from "@/components/ui/button";

export const STATE_LABEL: Record<MySubscription["state"], string> = {
  trial: "Prueba gratis",
  active: "Activo",
  grace: "Vencido (en gracia)",
  suspended: "Suspendido",
  free: "Cortesía",
};

export const longDate = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

/** Cómo pagarle a MAFC: Yape/Plin/banco y enviar el comprobante por WhatsApp. */
export function PayInstructions({ sub }: { sub: MySubscription }) {
  const p = sub.pay_to;
  const wa = whatsappLink(
    p.whatsapp,
    `Hola MAFC, pagué ${money(sub.monthly_price)} del plan ${sub.plan_name} para "${sub.tenant.name}" (${sub.tenant.slug}). Te envío el comprobante.`,
  );
  const hasMethod = p.yape_number || p.yape_qr_url || p.plin_number || p.bank_info;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
        <span className="font-semibold text-muted">{sub.plan_name} · mensual</span>
        <span className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(sub.monthly_price)}</span>
      </div>

      {hasMethod ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          {p.yape_qr_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.yape_qr_url} alt="QR de Yape de MAFC" className="mx-auto size-44 rounded-2xl bg-white object-contain p-2" />
          )}
          <ul className="space-y-2 text-sm">
            {p.yape_number && <li className="flex items-center gap-2"><Smartphone className="size-4 text-muted" /> Yape: <b className="font-mono text-base">{p.yape_number}</b></li>}
            {p.plin_number && <li className="flex items-center gap-2"><Smartphone className="size-4 text-muted" /> Plin: <b className="font-mono text-base">{p.plin_number}</b></li>}
            {p.bank_info && <li className="whitespace-pre-line text-muted">{p.bank_info}</li>}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">Escríbenos por WhatsApp y te enviamos los datos de pago.</p>
      )}

      {wa && (
        <Button asChild size="lg" className="w-full bg-[#25d366] text-[#06301a] hover:bg-[#25d366] hover:brightness-105">
          <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Enviar comprobante por WhatsApp</a>
        </Button>
      )}
      <p className="text-center text-xs text-muted">Tu acceso se extiende apenas MAFC confirme el pago.</p>
    </div>
  );
}
