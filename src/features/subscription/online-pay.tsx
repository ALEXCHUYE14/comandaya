"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionInfo } from "@/core/domain/types";
import { money } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { Button } from "@/components/ui/button";
import { longDate } from "./pay-instructions";

const MONTHS = [1, 3, 6, 12] as const;

/** Pagar con Mercado Pago: tarjeta y los medios que tu cuenta tenga habilitados. */
export function OnlinePay({ price }: { price: number }) {
  const [months, setMonths] = useState<(typeof MONTHS)[number]>(1);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo iniciar el pago");
      window.location.href = data.url; // página segura de Mercado Pago
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar el pago");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <p className="font-bold">Pagar en línea</p>
      <div className="grid grid-cols-4 gap-2">
        {MONTHS.map((m) => (
          <button key={m} type="button" onClick={() => setMonths(m)}
            className={cn("rounded-xl border px-2 py-2 text-center text-sm font-semibold", months === m ? "border-ink bg-ink text-bg" : "border-line text-muted")}>
            {m === 1 ? "1 mes" : `${m} meses`}
            <span className="tabular block text-xs font-normal opacity-80">{money(price * m)}</span>
          </button>
        ))}
      </div>
      <Button size="lg" className="w-full" disabled={busy} onClick={pay}>
        {busy ? <Loader2 className="animate-spin" /> : <CreditCard />} Pagar {money(price * months)} con Mercado Pago
      </Button>
      <p className="text-center text-xs text-muted">Pagas en la página segura de Mercado Pago. Tu plan se activa apenas se apruebe.</p>
    </div>
  );
}

/**
 * Al volver de Mercado Pago (/plan?pago=ok&payment_id=…) confirma el pago en el servidor
 * y recarga la sesión: si el negocio estaba suspendido, se reactiva sin cerrar sesión.
 */
export function usePaymentReturn() {
  const router = useRouter();
  const qc = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("pago");
    if (!result) return;
    done.current = true;
    const paymentId = params.get("payment_id") ?? params.get("collection_id");
    window.history.replaceState(null, "", window.location.pathname); // que recargar no repita el aviso

    if (result === "error") return void toast.error("El pago no se completó. Puedes intentarlo de nuevo o pagar por Yape.");
    if (result === "pendiente") return void toast.info("Tu pago está pendiente. Tu plan se activa apenas Mercado Pago lo confirme.");
    if (!paymentId) return void toast.success("¡Gracias! Estamos confirmando tu pago.");

    const id = toast.loading("Confirmando tu pago…");
    fetch(`/api/billing/verify?payment_id=${encodeURIComponent(paymentId)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { status?: string; subscription?: SubscriptionInfo; mp_status?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "No pudimos confirmar el pago todavía");
        if (data.status === "paid" || data.status === "already_paid") {
          toast.success(`¡Pago recibido! Tu plan está activo hasta el ${data.subscription ? longDate(data.subscription.access_end) : "próximo mes"}.`, { id });
          await qc.invalidateQueries({ queryKey: ["subscription"] });
          router.refresh();
        } else if (data.status === "not_approved") {
          toast.info("Tu pago aún no está aprobado. Se activará apenas Mercado Pago lo confirme.", { id });
        } else {
          toast.dismiss(id);
        }
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "No pudimos confirmar el pago", { id }));
  }, [qc, router]);
}
