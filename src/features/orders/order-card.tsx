"use client";

import { useEffect, useState } from "react";
import { Ban, Bike, CheckCheck, ChefHat, Clock3, Printer, QrCode, ShoppingBag, Utensils, Wallet } from "lucide-react";
import type { OrderWithItems } from "@/core/domain/types";
import {
  can,
  elapsedMinutes,
  formatElapsed,
  money,
  ORDER_TYPE_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  ticketCode,
  urgencyFor,
} from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { useSwipe } from "@/core/lib/use-swipe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/session/session-context";
import { printTicket } from "@/features/pos/print-ticket";
import { toast } from "sonner";
import { useSetOrderStatus } from "./use-orders";

export const TYPE_ICON = { dine_in: Utensils, takeaway: ShoppingBag, delivery: Bike } as const;

export function useNow(intervalMs = 1000) {
  // 0 en el render del servidor para evitar desajustes de hidratación
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function OrderCard({ order, onCharge }: { order: OrderWithItems; onCharge: (o: OrderWithItems) => void }) {
  const { profile, tenant, settings } = useSession();
  const setStatus = useSetOrderStatus();
  const now = useNow(15_000);
  const Icon = TYPE_ICON[order.order_type];
  const active = order.status !== "closed" && order.status !== "cancelled";
  const mins = elapsedMinutes(order.created_at, now);
  const urgency = urgencyFor(mins);
  const paid = order.payment_status === "paid";

  const primary: { label: string; icon: React.ReactNode; run: () => void } | null = (() => {
    if (order.status === "pending") return { label: "Preparar", icon: <ChefHat />, run: () => setStatus.mutate({ id: order.id, status: "preparing" }) };
    if (order.status === "preparing") return { label: "Listo", icon: <CheckCheck />, run: () => setStatus.mutate({ id: order.id, status: "ready" }) };
    if (order.status === "ready")
      return paid
        ? { label: "Entregado", icon: <CheckCheck />, run: () => setStatus.mutate({ id: order.id, status: "closed" }) }
        : can.charge(profile.role)
          ? { label: "Cobrar y cerrar", icon: <Wallet />, run: () => onCharge(order) }
          : null;
    if (order.status === "closed" && !paid && can.charge(profile.role))
      return { label: "Cobrar", icon: <Wallet />, run: () => onCharge(order) };
    return null;
  })();

  const swipe = useSwipe({ onSwipeRight: active && primary ? primary.run : undefined });

  return (
    <div className="relative">
      {primary && active && (
        <div className="absolute inset-0 flex items-center rounded-2xl bg-olive pl-5 font-bold text-white" style={{ opacity: swipe.progress }}>
          {primary.label} →
        </div>
      )}
      <article
        {...swipe.handlers}
        style={swipe.style}
        className={cn(
          "relative rounded-2xl border border-line bg-surface p-3.5 shadow-sm",
          order.status === "ready" && "border-olive/60",
          !active && "opacity-70",
        )}
      >
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-extrabold tracking-tight">{ticketCode(order.ticket_number)}</span>
              {order.source === "qr" && (
                <Badge tone="accent"><QrCode /> QR</Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-muted">
              <Icon className="size-4 shrink-0" />
              {order.table?.label ?? ORDER_TYPE_LABEL[order.order_type]}
              {order.customer_name && <span className="truncate">· {order.customer_name}</span>}
            </p>
          </div>
          {active ? (
            <span
              className={cn(
                "tabular inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                urgency === "ok" && "bg-olive-soft text-olive",
                urgency === "warn" && "bg-amber-soft text-amber",
                urgency === "late" && "bg-danger-soft text-danger",
              )}
            >
              <Clock3 className="size-3.5" /> {formatElapsed(order.created_at, now).slice(0, 5)}
            </span>
          ) : (
            <Badge tone={order.status === "cancelled" ? "danger" : "neutral"}>{STATUS_LABEL[order.status]}</Badge>
          )}
        </header>

        <ul className="my-3 space-y-1 text-[15px]">
          {order.order_items.map((i) => (
            <li key={i.id} className="flex gap-2">
              <span className="tabular w-6 shrink-0 font-bold text-accent">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                {i.product_name}
                {i.notes && <span className="block text-xs italic text-muted">↳ {i.notes}</span>}
              </span>
            </li>
          ))}
        </ul>
        {order.status === "cancelled" && order.cancel_reason && (
          <p className="mb-3 rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger">Motivo de anulación: {order.cancel_reason}</p>
        )}
        {order.notes && <p className="mb-3 rounded-lg bg-amber-soft px-2.5 py-1.5 text-xs font-semibold text-amber">{order.notes}</p>}

        <footer className="flex items-center justify-between gap-2">
          <div>
            <p className="tabular text-lg font-extrabold">{money(order.total)}</p>
            {paid ? (
              <Badge tone="olive">Pagado · {order.payment_method ? PAYMENT_LABEL[order.payment_method] : ""}</Badge>
            ) : (
              <Badge tone="amber">Por cobrar</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Imprimir ticket" onClick={() => printTicket(order, tenant, settings)}>
              <Printer />
            </Button>
            {active && !paid && can.charge(profile.role) && order.status !== "ready" && (
              <Button variant="secondary" size="icon" aria-label="Cobrar" onClick={() => onCharge(order)}>
                <Wallet />
              </Button>
            )}
            {primary && (
              <Button variant={order.status === "ready" ? "success" : "primary"} onClick={primary.run}>
                {primary.icon}
                <span className="hidden sm:inline">{primary.label}</span>
              </Button>
            )}
          </div>
        </footer>
        {active && can.charge(profile.role) && (
          <button
            onClick={() => {
              const reason = prompt(`¿Por qué se anula el pedido ${ticketCode(order.ticket_number)}?`, "");
              if (reason === null) return;
              if (reason.trim().length < 3) return void toast.error("Escribe el motivo de la anulación");
              setStatus.mutate({ id: order.id, status: "cancelled", reason });
            }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger"
          >
            <Ban className="size-3.5" /> Anular
          </button>
        )}
      </article>
    </div>
  );
}
