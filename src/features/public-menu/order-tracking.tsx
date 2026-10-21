"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChefHat, PartyPopper, Receipt, Timer, XCircle } from "lucide-react";
import type { OrderStatus } from "@/core/domain/types";
import { customerStatusMessage, money, ORDER_TYPE_LABEL, ticketCode } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { playNewOrderChime, unlockAudio } from "@/core/lib/sound";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Skeleton } from "@/components/ui/empty";
import { publicRepo } from "@/infrastructure/repositories/public.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pending", label: "Recibido", icon: Receipt },
  { status: "preparing", label: "Preparando", icon: ChefHat },
  { status: "ready", label: "¡Listo!", icon: PartyPopper },
];
const ORDER: Record<OrderStatus, number> = { pending: 0, preparing: 1, ready: 2, closed: 3, cancelled: -1 };

export function OrderTracking({ slug, token }: { slug: string; token: string }) {
  const q = useQuery({
    queryKey: ["public-order", token],
    queryFn: () => publicRepo.order(getSupabase(), token),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "closed" || s === "cancelled" ? false : 15_000; // respaldo si el WebSocket cae
    },
  });
  const prevStatus = useRef<OrderStatus | null>(null);

  // WebSocket: canal público order:<token> emitido por un trigger de la BD
  useEffect(() => {
    const sb = getSupabase();
    const channel = sb
      .channel(`order:${token}`)
      .on("broadcast", { event: "status" }, () => void q.refetch())
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const fn = () => unlockAudio();
    window.addEventListener("pointerdown", fn, { once: true });
    return () => window.removeEventListener("pointerdown", fn);
  }, []);

  // Aviso al cliente cuando su pedido queda listo
  const status = q.data?.status;
  useEffect(() => {
    if (!status) return;
    if (prevStatus.current && prevStatus.current !== "ready" && status === "ready") {
      playNewOrderChime();
      const original = document.title;
      document.title = "🔔 ¡Tu pedido está listo!";
      setTimeout(() => (document.title = original), 8000);
    }
    prevStatus.current = status;
  }, [status]);

  const order = q.data;

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-10">
      <div className="flex items-center justify-between py-3">
        <Link href={`/carta/${slug}`} className="inline-flex h-12 items-center gap-2 rounded-xl px-2 font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-5" /> Carta
        </Link>
        <ThemeToggle />
      </div>

      {q.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-40" /></div>
      ) : !order ? (
        <p className="py-20 text-center text-muted">No encontramos este pedido.</p>
      ) : (
        <div className="space-y-4">
          <section className={cn(
            "relative overflow-hidden rounded-[2rem] p-6 text-center transition-colors duration-500",
            status === "ready" ? "bg-olive text-white dark:text-[#10140a]" : status === "cancelled" ? "bg-danger-soft" : "bg-[#121212] text-[#eee8e0]",
          )}>
            <div className="grain absolute inset-0 opacity-25" />
            <div className="relative">
              <div className="mx-auto mb-3 flex items-center justify-center gap-2 text-sm font-semibold opacity-80">
                {order.business.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.business.logo_url} alt="" className="size-7 rounded-lg bg-white object-cover" />
                ) : <BrandMark className="size-7" />}
                {order.business.name}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Tu número</p>
              <p className={cn("font-mono text-7xl font-extrabold tracking-tight", status === "ready" && "animate-pop")}>{ticketCode(order.ticket_number)}</p>
              <p className="mt-1 text-sm font-semibold opacity-80">
                {order.table_label ?? ORDER_TYPE_LABEL[order.order_type]}{order.customer_name ? ` · ${order.customer_name}` : ""}
              </p>
              <p className="mx-auto mt-4 max-w-xs text-xl font-bold leading-snug" aria-live="polite">
                {customerStatusMessage(order.status, order.order_type)}
              </p>
            </div>
          </section>

          {status !== "cancelled" && (
            <ol className="grid grid-cols-3 gap-2" aria-label="Progreso del pedido">
              {STEPS.map((s, i) => {
                const reached = ORDER[order.status] >= i;
                const current = ORDER[order.status] === i;
                return (
                  <li key={s.status} className="flex flex-col items-center gap-2 text-center">
                    <div className="relative flex w-full items-center">
                      <div className={cn("h-1.5 flex-1 rounded-full", i === 0 ? "bg-transparent" : reached ? "bg-accent" : "bg-line")} />
                      <span className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-full border-2 transition-all duration-500",
                        reached ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted",
                        current && "animate-pulse-ring",
                      )}>
                        {reached && !current ? <Check className="size-5" /> : <s.icon className="size-5" />}
                      </span>
                      <div className={cn("h-1.5 flex-1 rounded-full", i === STEPS.length - 1 ? "bg-transparent" : ORDER[order.status] > i ? "bg-accent" : "bg-line")} />
                    </div>
                    <span className={cn("text-sm font-bold", reached ? "text-ink" : "text-muted")}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {status === "cancelled" && (
            <p className="flex items-center justify-center gap-2 font-semibold text-danger"><XCircle className="size-5" /> Pedido anulado</p>
          )}

          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Timer className="size-5 text-accent" /> Detalle</h2>
            <ul className="space-y-2">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span><b className="text-accent">{i.quantity}×</b> {i.name}{i.notes && <span className="block text-xs italic text-muted">↳ {i.notes}</span>}</span>
                  <span className="tabular text-muted">{money(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-semibold text-muted">{order.payment_status === "paid" ? "Pagado" : "Total a pagar"}</span>
              <span className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{money(order.total)}</span>
            </div>
          </section>

          {order.payment_status === "unpaid" && status !== "cancelled" && (order.business.yape_qr_url || order.business.plin_qr_url) && (
            <section className="rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-lg font-bold">Paga desde tu celular</h2>
              <p className="mb-4 text-sm text-muted">Escanea y muestra la confirmación en caja.</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Yape", qr: order.business.yape_qr_url, n: order.business.yape_number },
                  { label: "Plin", qr: order.business.plin_qr_url, n: order.business.plin_number },
                ].filter((x) => x.qr).map((x) => (
                  <div key={x.label} className="rounded-2xl bg-surface-2 p-3 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.qr!} alt={`QR ${x.label}`} className="aspect-square w-full rounded-xl bg-white object-contain p-1" />
                    <p className="mt-2 font-bold">{x.label}</p>
                    {x.n && <p className="font-mono text-sm text-muted">{x.n}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {order.business.ticket_footer && <p className="pt-2 text-center text-sm text-muted">{order.business.ticket_footer}</p>}
        </div>
      )}
    </div>
  );
}
