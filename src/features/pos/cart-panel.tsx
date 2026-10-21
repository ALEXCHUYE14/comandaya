"use client";

import { useState } from "react";
import { Bike, Loader2, MessageSquarePlus, Minus, Plus, Send, ShoppingBag, Trash2, Utensils, Wallet } from "lucide-react";
import type { DiningTable, OrderType, OrderWithItems } from "@/core/domain/types";
import { cartTotal, money, ticketCode } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { useSwipe } from "@/core/lib/use-swipe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { usePosCart } from "@/stores/pos-cart";
import type { CartLine } from "@/core/domain/types";

function CartRow({ line }: { line: CartLine }) {
  const { inc, dec, remove, setNote } = usePosCart();
  const [editing, setEditing] = useState(false);
  const swipe = useSwipe({ onSwipeLeft: () => remove(line.key) });

  return (
    <li className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger pr-5 text-white" style={{ opacity: swipe.progress }}>
        <Trash2 className="size-5" />
      </div>
      <div {...swipe.handlers} style={swipe.style} className="relative rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{line.name}</p>
            <p className="tabular text-sm text-muted">
              {money(line.unitPrice)} · <b className="text-ink">{money(line.unitPrice * line.quantity)}</b>
            </p>
            {line.notes && !editing && <p className="mt-1 text-sm italic text-accent">↳ {line.notes}</p>}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-surface-2 p-1">
            <button onClick={() => dec(line.key)} aria-label="Quitar uno" className="grid size-10 place-items-center rounded-lg hover:bg-line active:scale-90">
              <Minus className="size-4" />
            </button>
            <span className="tabular w-6 text-center font-bold">{line.quantity}</span>
            <button onClick={() => inc(line.key)} aria-label="Agregar uno" className="grid size-10 place-items-center rounded-lg hover:bg-line active:scale-90">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        {editing ? (
          <Input
            autoFocus
            maxLength={140}
            defaultValue={line.notes}
            placeholder="Sin cebolla, bien picante…"
            className="mt-2 h-11"
            onBlur={(e) => {
              setNote(line.key, e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button onClick={() => setEditing(true)} className="mt-1 inline-flex h-8 items-center gap-1 text-xs font-semibold text-muted hover:text-accent">
            <MessageSquarePlus className="size-3.5" /> {line.notes ? "Editar nota" : "Nota para cocina"}
          </button>
        )}
      </div>
    </li>
  );
}

export function CartPanel({
  tables,
  openOrders,
  submitting,
  onSubmit,
  className,
}: {
  tables: DiningTable[];
  openOrders: OrderWithItems[];
  submitting: boolean;
  onSubmit: (opts: { charge: boolean; appendTo: OrderWithItems | null }) => void;
  className?: string;
}) {
  const cart = usePosCart();
  const total = cartTotal(cart.lines);
  const activeTables = tables.filter((t) => t.is_active);
  const busy = new Map(openOrders.filter((o) => o.table_id && o.status !== "closed" && o.status !== "cancelled").map((o) => [o.table_id!, o]));
  const tableOrder = cart.orderType === "dine_in" && cart.tableId ? (busy.get(cart.tableId) ?? null) : null;
  const [newForTable, setNewForTable] = useState(false);
  const appendTo = tableOrder && tableOrder.payment_status === "unpaid" && !newForTable ? tableOrder : null;

  const needsTable = cart.orderType === "dine_in" && !cart.tableId;
  const canSend = cart.lines.length > 0 && !needsTable && !submitting;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="space-y-3 pb-3">
        <Segmented<OrderType>
          value={cart.orderType}
          onChange={(v) => cart.set({ orderType: v, tableId: v === "dine_in" ? cart.tableId : null })}
          options={[
            { value: "takeaway", label: "Al paso", icon: <ShoppingBag /> },
            { value: "dine_in", label: "Mesa", icon: <Utensils /> },
            { value: "delivery", label: "Delivery", icon: <Bike /> },
          ]}
        />

        {cart.orderType === "dine_in" ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {activeTables.map((t) => {
              const o = busy.get(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    cart.set({ tableId: t.id });
                    setNewForTable(false);
                  }}
                  className={cn(
                    "relative flex h-14 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-line bg-surface px-3 text-sm font-bold",
                    cart.tableId === t.id && "border-accent bg-accent/10 text-accent",
                  )}
                >
                  {t.label.replace(/^mesa\s*/i, "M")}
                  {o && <span className="text-[10px] font-semibold text-amber">{ticketCode(o.ticket_number)}</span>}
                </button>
              );
            })}
            {activeTables.length === 0 && <p className="text-sm text-muted">Crea tus mesas en “Mesas y QR”.</p>}
          </div>
        ) : (
          <Input
            value={cart.customerName}
            onChange={(e) => cart.set({ customerName: e.target.value })}
            placeholder={cart.orderType === "delivery" ? "Nombre y dirección / referencia" : "Nombre para llamar (opcional)"}
            maxLength={60}
          />
        )}

        {tableOrder && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-soft px-3 py-2 text-sm">
            <span>
              Mesa con pedido abierto <b>{ticketCode(tableOrder.ticket_number)}</b>
            </span>
            {tableOrder.payment_status === "unpaid" && (
              <button className="font-bold text-amber underline-offset-2 hover:underline" onClick={() => setNewForTable((v) => !v)}>
                {newForTable ? "Agregar a esa cuenta" : "Crear pedido nuevo"}
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
        {cart.lines.map((l) => (
          <CartRow key={l.key} line={l} />
        ))}
        {cart.lines.length === 0 && (
          <li className="grid h-40 place-items-center rounded-2xl border border-dashed border-line text-center text-sm text-muted">
            Toca un producto para agregarlo.
            <br />
            Desliza a la izquierda para quitar.
          </li>
        )}
      </ul>

      <div className="space-y-3 border-t border-line pt-3">
        {cart.lines.length > 0 && (
          <Input value={cart.notes} onChange={(e) => cart.set({ notes: e.target.value })} placeholder="Nota general del pedido" maxLength={300} className="h-11" />
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-muted">Total</span>
          <span className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="outline" disabled={!canSend} onClick={() => onSubmit({ charge: false, appendTo })}>
            {submitting ? <Loader2 className="animate-spin" /> : <Send />}
            {appendTo ? `Sumar a ${ticketCode(appendTo.ticket_number)}` : "A cocina"}
          </Button>
          <Button size="lg" disabled={!canSend} onClick={() => onSubmit({ charge: true, appendTo })}>
            <Wallet /> Cobrar
          </Button>
        </div>
        {needsTable && cart.lines.length > 0 && <p className="text-center text-xs font-semibold text-amber">Selecciona una mesa</p>}
      </div>
    </div>
  );
}
