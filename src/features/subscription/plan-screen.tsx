"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CreditCard, Receipt } from "lucide-react";
import type { SubscriptionState } from "@/core/domain/types";
import { can, money } from "@/core/domain/order-rules";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { useSession } from "@/features/session/session-context";
import { subscriptionRepo } from "@/infrastructure/repositories/subscription.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { OnlinePay, usePaymentReturn } from "./online-pay";
import { longDate, PayInstructions, STATE_LABEL } from "./pay-instructions";

const STATE_TONE: Record<SubscriptionState, "accent" | "olive" | "amber" | "danger" | "neutral"> = {
  trial: "accent",
  active: "olive",
  grace: "danger",
  suspended: "danger",
  free: "neutral",
};

const METHOD_LABEL = { yape: "Yape", plin: "Plin", transfer: "Transferencia", cash: "Efectivo", card: "Tarjeta", mercadopago: "Mercado Pago", other: "Otro" } as const;

export function PlanScreen({ onlinePayments = false }: { onlinePayments?: boolean }) {
  const { profile, subscription: initial } = useSession();
  usePaymentReturn();
  const allowed = can.manage(profile.role);
  const q = useQuery({
    queryKey: ["subscription", "mine"],
    queryFn: () => subscriptionRepo.mine(getSupabase()),
    initialData: initial ?? undefined,
    enabled: allowed && Boolean(initial),
    staleTime: 60_000,
  });
  const sub = q.data;

  if (!allowed) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState icon={<CreditCard />} title="Sólo para el dueño" text="El plan lo administra el propietario o un administrador." /></div>;
  }
  if (!sub) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState icon={<CreditCard />} title="Planes no disponibles" text="Falta actualizar la base de datos con supabase/schema.sql." /></div>;
  }

  const until =
    sub.state === "trial" ? `La prueba gratis termina el ${longDate(sub.trial_ends_at)}`
    : sub.state === "active" ? `Pagado hasta el ${longDate(sub.access_end)}`
    : sub.state === "grace" ? `Venció el ${longDate(sub.access_end)}. Tienes hasta el ${longDate(sub.grace_end)} para pagar`
    : sub.state === "free" ? "Cuenta de cortesía de MAFC"
    : "Cuenta suspendida";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6 md:pr-36">
      <div>
        <h1 className="text-3xl font-extrabold">Mi plan</h1>
        <p className="text-muted">Tu suscripción a {sub.plan_name}.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-muted">Estado</span>
            <Badge tone={STATE_TONE[sub.state]}>{STATE_LABEL[sub.state]}</Badge>
          </div>
          <p className="flex items-start gap-2 text-lg font-bold"><CalendarClock className="mt-1 size-5 shrink-0 text-muted" />{until}</p>
          {(sub.state === "trial" || sub.state === "active") && (
            <p className="text-sm text-muted">{sub.days_left > 0 ? `Quedan ${sub.days_left} días.` : "Vence hoy."} Puedes pagar por adelantado: los días se suman.</p>
          )}
          <ul className="space-y-1.5 border-t border-line pt-3 text-sm text-muted">
            <li>✓ Caja, cocina, carta QR y reportes sin límite de pedidos</li>
            <li>✓ Todo tu equipo incluido</li>
            <li>✓ Si un pago se atrasa, tus datos nunca se borran</li>
          </ul>
        </Card>

        {sub.state !== "free" && (
          <Card className="p-5">
            <SectionTitle title="Cómo pagar" description={onlinePayments ? "En línea se activa al instante; por Yape/Plin, al enviar tu comprobante." : "Paga y envía tu comprobante: activamos tu mes al confirmar."} />
            {onlinePayments && (
              <>
                <OnlinePay price={Number(sub.monthly_price)} />
                <p className="my-4 text-center text-xs font-semibold uppercase tracking-wide text-muted">o paga directo por Yape / Plin</p>
              </>
            )}
            <PayInstructions sub={sub} />
          </Card>
        )}
      </div>

      <section>
        <SectionTitle title="Pagos registrados" />
        {sub.payments.length === 0 ? (
          <EmptyState icon={<Receipt />} title="Aún no hay pagos" text="Aquí verás cada mes que MAFC registre." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {sub.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.months === 1 ? "1 mes" : `${p.months} meses`} · {METHOD_LABEL[p.method]}</span>
                  <span className="text-xs text-muted">Del {longDate(p.period_from)} al {longDate(p.period_to)}</span>
                </span>
                <span className="tabular font-bold">{money(p.amount)}</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
