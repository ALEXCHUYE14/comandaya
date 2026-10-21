"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LogOut, RefreshCw } from "lucide-react";
import type { MySubscription } from "@/core/domain/types";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabase } from "@/infrastructure/supabase/client";
import { OnlinePay, usePaymentReturn } from "./online-pay";
import { longDate, PayInstructions } from "./pay-instructions";

/** Se muestra en lugar del sistema cuando el negocio no tiene acceso. Sus datos se conservan. */
export function SuspendedScreen({ sub, onlinePayments = false }: { sub: MySubscription; onlinePayments?: boolean }) {
  const router = useRouter();
  usePaymentReturn();
  const [checking, setChecking] = useState(false);
  const manager = sub.role === "owner" || sub.role === "admin";

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-6">
      <div className="flex items-center justify-between">
        <Brand />
        <ThemeToggle />
      </div>
      <Card className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-danger-soft text-danger"><Lock className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-extrabold">{sub.tenant.name} está suspendido</h1>
            <p className="mt-1 text-muted">
              {sub.override === "suspended"
                ? "MAFC suspendió la cuenta."
                : `El plan venció el ${longDate(sub.access_end)}.`}{" "}
              La caja, la cocina y la carta QR están pausadas. <b className="text-ink">Tus datos están a salvo</b> y vuelven apenas se registre el pago.
            </p>
          </div>
        </div>
        {manager ? (
          <div className="space-y-4">
            {onlinePayments && <OnlinePay price={Number(sub.monthly_price)} />}
            <PayInstructions sub={sub} />
          </div>
        ) : (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">Avísale al dueño del negocio para que renueve el plan.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={checking} onClick={() => { setChecking(true); router.refresh(); setTimeout(() => setChecking(false), 1500); }}>
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Ya pagué, revisar
          </Button>
          <Button variant="ghost" onClick={logout}><LogOut /> Cerrar sesión</Button>
        </div>
      </Card>
    </div>
  );
}
