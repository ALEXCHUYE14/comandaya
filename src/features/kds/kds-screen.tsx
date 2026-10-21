"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, ChefHat, Expand, Flame, Shrink, Undo2, Volume2, VolumeX } from "lucide-react";
import type { OrderWithItems, Station } from "@/core/domain/types";
import { elapsedMinutes, formatElapsed, ORDER_TYPE_LABEL, ticketCode, urgencyFor } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { isAudioReady, playNewOrderChime, unlockAudio } from "@/core/lib/sound";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { TYPE_ICON, useNow } from "@/features/orders/order-card";
import { useBoardOrders, useOnNewOrder, useSetOrderStatus } from "@/features/orders/use-orders";
import { useSession } from "@/features/session/session-context";

const URGENCY_STYLE = {
  ok: "bg-olive text-white dark:text-[#10140a]",
  warn: "bg-amber text-[#231700]",
  late: "bg-danger text-white dark:text-[#200806] animate-pulse-ring",
} as const;

function KdsTicket({ order, station, now }: { order: OrderWithItems; station: Station | "all"; now: number }) {
  const setStatus = useSetOrderStatus();
  const items = order.order_items.filter((i) => station === "all" || i.station === station);
  const mins = elapsedMinutes(order.created_at, now);
  const urgency = urgencyFor(mins);
  const Icon = TYPE_ICON[order.order_type];
  const cooking = order.status === "preparing";
  const isNew = (createdAt: string) => order.started_at && new Date(createdAt) > new Date(order.started_at);

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-2xl border-2 bg-surface shadow-sm animate-slide-up", cooking ? "border-amber/70" : "border-line")}>
      <header className={cn("flex items-center justify-between gap-2 px-4 py-2.5", URGENCY_STYLE[urgency])}>
        <span className="font-mono text-3xl font-extrabold leading-none">{ticketCode(order.ticket_number)}</span>
        <span className="tabular flex items-center gap-1 font-mono text-2xl font-bold">
          {urgency === "late" && <Flame className="size-5" />}
          {formatElapsed(order.created_at, now)}
        </span>
      </header>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm font-bold">
        <Icon className="size-4" />
        {order.table?.label ?? ORDER_TYPE_LABEL[order.order_type]}
        {order.customer_name && <span className="truncate font-semibold text-muted">· {order.customer_name}</span>}
        <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs", cooking ? "bg-amber-soft text-amber" : "bg-surface-2 text-muted")}>
          {cooking ? "Cocinando" : "Nuevo"}
        </span>
      </div>
      <ul className="flex-1 space-y-2 px-4 py-3">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 text-lg leading-snug">
            <span className="tabular min-w-8 font-mono text-xl font-extrabold text-accent">{i.quantity}</span>
            <span className="min-w-0 flex-1 font-semibold">
              {i.product_name}
              {isNew(i.created_at) && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-accent-ink">AGREGADO</span>}
              {i.notes && <span className="mt-0.5 block text-base font-bold italic text-danger">↳ {i.notes}</span>}
            </span>
          </li>
        ))}
      </ul>
      {order.notes && <p className="mx-4 mb-3 rounded-lg bg-amber-soft px-3 py-2 text-sm font-bold text-amber">{order.notes}</p>}
      <div className="p-3 pt-0">
        {cooking ? (
          <Button size="xl" variant="success" className="w-full" onClick={() => setStatus.mutate({ id: order.id, status: "ready" })}>
            <CheckCheck /> Listo para entregar
          </Button>
        ) : (
          <Button size="xl" className="w-full" onClick={() => setStatus.mutate({ id: order.id, status: "preparing" })}>
            <ChefHat /> Empezar
          </Button>
        )}
      </div>
    </article>
  );
}

export function KdsScreen() {
  const { settings } = useSession();
  const orders = useBoardOrders();
  const setStatus = useSetOrderStatus();
  const now = useNow(1000);
  const [station, setStation] = useState<Station | "all">("all");
  const [soundOn, setSoundOn] = useState(settings.kds_sound);
  const [audioReady, setAudioReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setAudioReady(isAudioReady());
    const fn = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  // 🔔 Nueva comanda por WebSocket → campanita
  useOnNewOrder(() => {
    if (soundOn) playNewOrderChime();
  });

  const { queue, ready } = useMemo(() => {
    const all = orders.data ?? [];
    const hasItems = (o: OrderWithItems) => station === "all" || o.order_items.some((i) => i.station === station);
    return {
      queue: all
        .filter((o) => (o.status === "pending" || o.status === "preparing") && hasItems(o))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      ready: all
        .filter((o) => o.status === "ready" && hasItems(o))
        .sort((a, b) => (b.ready_at ?? "").localeCompare(a.ready_at ?? ""))
        .slice(0, 8),
    };
  }, [orders.data, station]);

  const late = queue.filter((o) => urgencyFor(elapsedMinutes(o.created_at, now)) === "late").length;

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col md:min-h-dvh">
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:top-0 md:px-6 md:pr-36">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ChefHat className="size-7 text-accent" /> Cocina
        </h1>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-surface-2 px-3 py-1">{queue.length} en cola</span>
          {late > 0 && <span className="rounded-full bg-danger-soft px-3 py-1 text-danger">{late} atrasados</span>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented<Station | "all">
            value={station}
            onChange={setStation}
            options={[
              { value: "all", label: "Todo" },
              { value: "kitchen", label: "Cocina" },
              { value: "bar", label: "Barra" },
            ]}
          />
          <Button variant="outline" size="icon" aria-label={soundOn ? "Silenciar" : "Activar sonido"}
            onClick={() => { setSoundOn((v) => !v); unlockAudio(); setAudioReady(true); }}>
            {soundOn ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label="Pantalla completa" onClick={toggleFullscreen}>
            {fullscreen ? <Shrink /> : <Expand />}
          </Button>
        </div>
      </div>

      {soundOn && !audioReady && (
        <button
          onClick={() => { unlockAudio(); playNewOrderChime(); setAudioReady(true); }}
          className="mx-4 mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-4 font-bold text-accent-ink md:mx-6"
        >
          <BellRing className="size-5" /> Toca aquí para activar las alertas sonoras
        </button>
      )}

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 xl:flex-row">
        <div className="flex-1">
          {orders.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
          ) : queue.length === 0 ? (
            <EmptyState icon={<ChefHat />} title="Sin comandas pendientes" text="Las nuevas comandas aparecerán aquí al instante, con alerta sonora." className="h-full min-h-80" />
          ) : (
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {queue.map((o) => <KdsTicket key={o.id} order={o} station={station} now={now} />)}
            </div>
          )}
        </div>
        <aside className="xl:w-64">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Listos para entregar</h2>
          <div className="flex gap-2 overflow-x-auto xl:flex-col">
            {ready.map((o) => (
              <div key={o.id} className="flex shrink-0 items-center gap-2 rounded-2xl border border-olive/40 bg-olive-soft px-3 py-2">
                <span className="font-mono text-xl font-extrabold text-olive">{ticketCode(o.ticket_number)}</span>
                <span className="truncate text-xs font-semibold text-muted">{o.table?.label ?? o.customer_name ?? ""}</span>
                <button aria-label="Devolver a preparación" onClick={() => setStatus.mutate({ id: o.id, status: "preparing" })}
                  className="ml-auto grid size-10 place-items-center rounded-xl text-muted hover:bg-surface">
                  <Undo2 className="size-4" />
                </button>
              </div>
            ))}
            {ready.length === 0 && <p className="text-sm text-muted">—</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
