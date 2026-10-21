"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Delete, Loader2, Smartphone } from "lucide-react";
import type { OrderWithItems, PaymentMethod } from "@/core/domain/types";
import { computeChange, money, quickCashOptions, ticketCode, toCents } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/features/session/session-context";
import { useRegisterPayment } from "@/features/orders/use-orders";

const METHODS: { id: PaymentMethod; label: string; icon: React.ElementType; tint: string }[] = [
  { id: "cash", label: "Efectivo", icon: Banknote, tint: "text-olive" },
  { id: "yape", label: "Yape", icon: Smartphone, tint: "text-[#742384] dark:text-[#d58be3]" },
  { id: "plin", label: "Plin", icon: Smartphone, tint: "text-[#0a8fa3] dark:text-[#5fd3e3]" },
  { id: "card", label: "Tarjeta", icon: CreditCard, tint: "text-amber" },
];

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

export function PaymentDialog({
  order,
  open,
  onOpenChange,
}: {
  order: OrderWithItems | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { settings } = useSession();
  const pay = useRegisterPayment();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [close, setClose] = useState(false);

  useEffect(() => {
    if (open && order) {
      setMethod("cash");
      setReceived("");
      setClose(order.status === "ready");
    }
  }, [open, order]);

  if (!order) return null;
  const total = Number(order.total);
  const receivedNum = Number(received || 0);
  const change = computeChange(total, receivedNum);
  const enough = method !== "cash" || received === "" || toCents(receivedNum) >= toCents(total);

  function press(k: (typeof KEYS)[number]) {
    setReceived((r) => {
      if (k === "del") return r.slice(0, -1);
      if (k === "." && r.includes(".")) return r;
      if (r.includes(".") && r.split(".")[1]!.length >= 2) return r;
      if (r.length >= 7) return r;
      return r === "0" && k !== "." ? k : r + k;
    });
  }

  async function confirm() {
    if (!order) return;
    await pay.mutateAsync({
      order,
      method,
      received: method === "cash" && received ? receivedNum : total,
      close,
    });
    onOpenChange(false);
  }

  const qr = method === "yape" ? settings.yape_qr_url : method === "plin" ? settings.plin_qr_url : null;
  const phone = method === "yape" ? settings.yape_number : method === "plin" ? settings.plin_number : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Cobrar ${ticketCode(order.ticket_number)}`} description={order.customer_name ?? order.table?.label ?? undefined}>
        <div className="space-y-4 pb-4">
          <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-semibold text-muted">Total a cobrar</span>
            <span className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(total)}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-line bg-surface text-sm font-bold transition-all",
                  method === m.id && "border-accent bg-accent/8",
                )}
              >
                <m.icon className={cn("size-6", m.tint)} />
                {m.label}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-line p-3">
                  <p className="text-xs font-semibold text-muted">Recibido</p>
                  <p className="tabular text-2xl font-bold">{received ? money(receivedNum) : "—"}</p>
                </div>
                <div className={cn("rounded-2xl p-3", enough ? "bg-olive-soft" : "bg-danger-soft")}>
                  <p className="text-xs font-semibold text-muted">{enough ? "Vuelto" : "Falta"}</p>
                  <p className={cn("tabular text-2xl font-extrabold", enough ? "text-olive" : "text-danger")}>
                    {enough ? money(change) : money((toCents(total) - toCents(receivedNum)) / 100)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickCashOptions(total).map((v) => (
                  <button key={v} onClick={() => setReceived(String(v))}
                    className="tabular h-11 rounded-xl border border-line bg-surface px-3.5 font-semibold hover:border-accent">
                    {money(v)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <button key={k} onClick={() => press(k)}
                    className="tabular grid h-14 place-items-center rounded-2xl bg-surface-2 text-xl font-bold active:scale-95 active:bg-line">
                    {k === "del" ? <Delete className="size-6" /> : k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(method === "yape" || method === "plin") && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line p-4 text-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={`QR ${method}`} className="size-56 rounded-xl bg-white object-contain p-2" />
              ) : (
                <p className="py-8 text-sm text-muted">Sube tu QR de {method === "yape" ? "Yape" : "Plin"} en Ajustes para mostrarlo aquí.</p>
              )}
              {phone && <p className="font-mono text-lg font-semibold">{phone}</p>}
              <p className="text-sm text-muted">Verifica la notificación del pago en tu celular antes de confirmar.</p>
            </div>
          )}

          {method === "card" && (
            <p className="rounded-2xl border border-line p-4 text-sm text-muted">
              Pasa la tarjeta por tu POS (Izipay, Niubiz, etc.) por <b className="text-ink">{money(total)}</b> y confirma aquí cuando sea aprobada.
            </p>
          )}

          <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-semibold">Cerrar pedido (ya fue entregado)</span>
            <Switch checked={close} onCheckedChange={setClose} />
          </label>

          <Button size="xl" variant="success" className="w-full" disabled={!enough || pay.isPending} onClick={confirm}>
            {pay.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Confirmar pago {method === "cash" && received && enough ? `· vuelto ${money(change)}` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
