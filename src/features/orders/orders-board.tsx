"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import type { OrderStatus, OrderWithItems } from "@/core/domain/types";
import { money, STATUS_LABEL } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { EmptyState } from "@/components/ui/empty";
import { Segmented } from "@/components/ui/segmented";
import { OrderCard } from "./order-card";

const COLUMNS: { status: OrderStatus; dot: string }[] = [
  { status: "pending", dot: "bg-muted" },
  { status: "preparing", dot: "bg-amber" },
  { status: "ready", dot: "bg-olive" },
];

type Filter = OrderStatus | "done";

export function OrdersBoard({ orders, onCharge }: { orders: OrderWithItems[]; onCharge: (o: OrderWithItems) => void }) {
  const [filter, setFilter] = useState<Filter>("pending");

  const groups = useMemo(() => {
    const g: Record<Filter, OrderWithItems[]> = { pending: [], preparing: [], ready: [], closed: [], cancelled: [], done: [] };
    for (const o of orders) {
      if (o.status === "closed" || o.status === "cancelled") g.done.push(o);
      else g[o.status].push(o);
    }
    g.done.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return g;
  }, [orders]);

  const sales = orders.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");
  const salesTotal = sales.reduce((a, o) => a + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "En curso", value: String(groups.pending.length + groups.preparing.length + groups.ready.length) },
          { label: "Listos", value: String(groups.ready.length) },
          { label: "Cobrado hoy", value: money(salesTotal) },
          { label: "Ventas pagadas", value: String(sales.length) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <p className="text-xs font-semibold text-muted">{k.label}</p>
            <p className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Móvil: filtro segmentado */}
      <Segmented<Filter>
        className="lg:hidden"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: `Espera ${groups.pending.length}` },
          { value: "preparing", label: `Cocina ${groups.preparing.length}` },
          { value: "ready", label: `Listos ${groups.ready.length}` },
          { value: "done", label: "Cerrados" },
        ]}
      />
      <div className="space-y-3 lg:hidden">
        {groups[filter].map((o) => <OrderCard key={o.id} order={o} onCharge={onCharge} />)}
        {groups[filter].length === 0 && <EmptyState icon={<Inbox />} title="Nada por aquí" />}
      </div>

      {/* Escritorio: kanban */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-3">
        {COLUMNS.map((c) => (
          <section key={c.status} className="min-w-0 rounded-3xl bg-surface-2/60 p-3">
            <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted">
              <span className={cn("size-2.5 rounded-full", c.dot)} />
              {STATUS_LABEL[c.status]}
              <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-ink">{groups[c.status].length}</span>
            </h3>
            <div className="space-y-3">
              {groups[c.status].map((o) => <OrderCard key={o.id} order={o} onCharge={onCharge} />)}
              {groups[c.status].length === 0 && <p className="py-8 text-center text-sm text-muted">Sin pedidos</p>}
            </div>
          </section>
        ))}
      </div>
      {groups.done.length > 0 && (
        <details className="hidden rounded-3xl border border-line p-3 lg:block">
          <summary className="cursor-pointer px-1 py-2 text-sm font-bold text-muted">Cerrados y anulados hoy ({groups.done.length})</summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {groups.done.map((o) => <OrderCard key={o.id} order={o} onCharge={onCharge} />)}
          </div>
        </details>
      )}
    </div>
  );
}
