"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, Lock, LockOpen, Loader2, Minus, Plus, Printer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { CashClosed, CashCurrent } from "@/core/domain/types";
import { can, money, toCents } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useSession } from "@/features/session/session-context";
import { cashRepo } from "@/infrastructure/repositories/cash.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { printCashReport } from "./print-cash";
import { CASH_KEY, useCashCurrent, useCashHistory } from "./use-cash";

const n = (v: unknown) => Number(v ?? 0);
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
/** "12.5" → 12.5; vacío o inválido → null */
const parseMoney = (s: string) => {
  const v = Number(s.replace(",", "."));
  return s.trim() !== "" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
};

function DiffLabel({ diff }: { diff: number }) {
  if (toCents(diff) === 0) return <Badge tone="olive">Cuadra</Badge>;
  return diff > 0 ? <Badge tone="amber">Sobra {money(diff)}</Badge> : <Badge tone="danger">Falta {money(Math.abs(diff))}</Badge>;
}

function OpenForm() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    const v = parseMoney(amount || "0");
    if (v === null) return void toast.error("Monto inválido");
    setBusy(true);
    try {
      await cashRepo.open(getSupabase(), v, notes);
      await qc.invalidateQueries({ queryKey: CASH_KEY });
      toast.success("Caja abierta");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo abrir la caja"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><Lock className="size-6" /></span>
        <div>
          <h2 className="text-xl font-bold">La caja está cerrada</h2>
          <p className="text-sm text-muted">Ábrela con el sencillo que tienes en el cajón. Los cobros desde ahora entran a este turno.</p>
        </div>
      </div>
      <form onSubmit={open} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Efectivo inicial (S/)">
          <Input type="number" inputMode="decimal" min={0} step="0.10" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <Input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Turno mañana" />
        </Field>
        <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <LockOpen />} Abrir caja</Button>
      </form>
    </Card>
  );
}

const QUICK_REASONS = { out: ["Compra de insumos", "Pago a delivery", "Gas / hielo", "Retiro del dueño"], in: ["Sencillo", "Aporte del dueño"] };

function MovementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = parseMoney(amount);
    if (!v) return void toast.error("Escribe el monto");
    if (reason.trim().length < 2) return void toast.error("Escribe el motivo");
    setBusy(true);
    try {
      await cashRepo.addMovement(getSupabase(), kind, v, reason);
      await qc.invalidateQueries({ queryKey: [...CASH_KEY, "current"] });
      toast.success(kind === "out" ? "Gasto registrado" : "Ingreso registrado");
      setAmount("");
      setReason("");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo registrar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Movimiento de efectivo" description="Dinero que entra o sale del cajón sin ser una venta.">
        <form onSubmit={save} className="space-y-4 pb-4">
          <Segmented<"in" | "out"> value={kind} onChange={setKind}
            options={[{ value: "out", label: "Sale (gasto)", icon: <Minus /> }, { value: "in", label: "Entra", icon: <Plus /> }]} />
          <Field label="Monto (S/)">
            <Input required autoFocus type="number" inputMode="decimal" min={0.1} step="0.10" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Motivo">
            <Input required maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS[kind].map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={cn("h-9 rounded-full border px-3 text-sm font-semibold", reason === r ? "border-ink bg-ink text-bg" : "border-line text-muted")}>{r}</button>
            ))}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Registrar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ cash, open, onOpenChange, onClosed }: { cash: CashCurrent; open: boolean; onOpenChange: (v: boolean) => void; onClosed: (c: CashClosed) => void }) {
  const qc = useQueryClient();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const expected = n(cash.summary.expected_cash);
  const countedNum = parseMoney(counted);

  async function close(e: React.FormEvent) {
    e.preventDefault();
    if (countedNum === null) return void toast.error("Escribe el efectivo que contaste");
    setBusy(true);
    try {
      const closed = await cashRepo.close(getSupabase(), countedNum, notes);
      await qc.invalidateQueries({ queryKey: CASH_KEY });
      onOpenChange(false);
      onClosed(closed);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo cerrar la caja"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Cerrar caja" description="Cuenta el efectivo del cajón y escríbelo aquí.">
        <form onSubmit={close} className="space-y-4 pb-4">
          {cash.unpaid_orders > 0 && (
            <p className="flex gap-2 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
              <TriangleAlert className="size-5 shrink-0" />
              Hay {cash.unpaid_orders} pedidos sin cobrar. Si los cobras después del cierre, no entrarán a este turno.
            </p>
          )}
          <div className="flex items-baseline justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-semibold text-muted">Efectivo esperado</span>
            <span className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{money(expected)}</span>
          </div>
          <Field label="Efectivo contado (S/)">
            <Input required autoFocus type="number" inputMode="decimal" min={0} step="0.10" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </Field>
          {countedNum !== null && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Diferencia</span>
              <DiffLabel diff={countedNum - expected} />
            </div>
          )}
          <Field label="Nota (opcional)">
            <Input maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. faltó sencillo por vuelto" />
          </Field>
          <Button type="submit" size="lg" variant="danger" className="w-full" disabled={busy || countedNum === null}>
            {busy ? <Loader2 className="animate-spin" /> : <Lock />} Cerrar caja
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Line({ label, value, sign, strong }: { label: string; value: number; sign?: "+" | "−"; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between py-1.5", strong && "border-t border-line pt-3 text-lg font-extrabold")}>
      <span className={cn(!strong && "text-muted")}>{sign && <span className="mr-1 font-bold">{sign}</span>}{label}</span>
      <span className="tabular font-semibold">{money(value)}</span>
    </div>
  );
}

function OpenSession({ cash, onClosed }: { cash: CashCurrent; onClosed: (c: CashClosed) => void }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const s = cash.summary;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Badge tone="olive"><LockOpen /> Caja abierta</Badge>
          desde las {time(cash.opened_at)}{cash.opened_by_name ? ` · ${cash.opened_by_name}` : ""}{cash.notes ? ` · ${cash.notes}` : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMoveOpen(true)}><Plus /> Ingreso / gasto</Button>
          <Button variant="danger" onClick={() => setCloseOpen(true)}><Lock /> Cerrar caja</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-accent/40 bg-accent/8 px-4 py-3 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-semibold text-muted">Efectivo esperado en cajón</p>
          <p className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(s.expected_cash)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-sm font-semibold text-muted">Ventas del turno</p>
          <p className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{money(s.total_sales)}</p>
          <p className="text-xs text-muted">{n(s.orders)} pedidos cobrados</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-sm font-semibold text-muted">Yape + Plin</p>
          <p className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{money(n(s.yape) + n(s.plin))}</p>
          <p className="text-xs text-muted">Yape {money(s.yape)} · Plin {money(s.plin)}</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-sm font-semibold text-muted">Tarjeta</p>
          <p className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{money(s.card)}</p>
          <p className="text-xs text-muted">Revisa el cierre de tu POS</p>
        </Card>
      </div>

      {n(s.cancelled_paid.orders) > 0 && (
        <p className="flex gap-2 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          <TriangleAlert className="size-5 shrink-0" />
          {s.cancelled_paid.orders} pedido(s) cobrado(s) y luego anulado(s) por {money(s.cancelled_paid.amount)}. No suman al efectivo (se asume devolución).
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Cómo se calcula el efectivo" />
          <Line label="Apertura" value={n(s.opening)} />
          <Line label="Ventas en efectivo" value={n(s.cash_sales)} sign="+" />
          <Line label="Ingresos" value={n(s.cash_in)} sign="+" />
          <Line label="Gastos y retiros" value={n(s.cash_out)} sign="−" />
          <Line label="Efectivo esperado" value={n(s.expected_cash)} strong />
        </Card>
        <Card className="overflow-hidden">
          <div className="p-5 pb-0"><SectionTitle title="Movimientos del turno" /></div>
          {s.movements.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Sin ingresos ni gastos registrados.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {s.movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", m.kind === "in" ? "bg-olive-soft text-olive" : "bg-danger-soft text-danger")}>
                    {m.kind === "in" ? <Plus className="size-4" /> : <Minus className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{m.reason}</span>
                    <span className="text-xs text-muted">{time(m.at)}{m.by_name ? ` · ${m.by_name}` : ""}</span>
                  </span>
                  <span className="tabular font-bold">{m.kind === "in" ? "+" : "−"}{money(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MovementDialog open={moveOpen} onOpenChange={setMoveOpen} />
      <CloseDialog key={closeOpen ? "open" : "closed"} cash={cash} open={closeOpen} onOpenChange={setCloseOpen} onClosed={onClosed} />
    </>
  );
}

export function CashScreen() {
  const { profile, tenant } = useSession();
  const allowed = can.charge(profile.role);
  const current = useCashCurrent(allowed);
  const history = useCashHistory(allowed);
  const [justClosed, setJustClosed] = useState<CashClosed | null>(null);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={<Calculator />} title="Sólo para caja" text="El cuadre lo hace caja, un administrador o el propietario." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:pr-36">
      <div>
        <h1 className="text-3xl font-extrabold">Cuadre de caja</h1>
        <p className="text-muted">Abre el turno, registra gastos y cierra contando el efectivo.</p>
      </div>

      {current.isError ? (
        <EmptyState icon={<TriangleAlert />} title="No se pudo cargar la caja"
          text={/function|schema cache/i.test(errorMessage(current.error)) ? "Falta actualizar la base de datos: ejecuta supabase/schema.sql en Supabase." : errorMessage(current.error)}
          action={<Button variant="outline" onClick={() => current.refetch()}>Reintentar</Button>} />
      ) : current.isLoading ? (
        <Skeleton className="h-48" />
      ) : current.data ? (
        <OpenSession cash={current.data} onClosed={setJustClosed} />
      ) : (
        <OpenForm />
      )}

      <section>
        <SectionTitle title="Cierres anteriores" />
        {history.isLoading ? (
          <Skeleton className="h-32" />
        ) : !history.data?.length ? (
          <p className="text-sm text-muted">Aún no hay cierres de caja.</p>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {history.data.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{dateTime(h.closed_at)}</span>
                  <span className="text-xs text-muted">Desde {time(h.opened_at)}{h.closed_by_name ? ` · cerró ${h.closed_by_name}` : ""}</span>
                </span>
                <span className="tabular text-muted">Ventas <b className="text-ink">{money(h.summary?.total_sales)}</b></span>
                <DiffLabel diff={n(h.difference)} />
                <Button variant="ghost" size="icon" aria-label="Imprimir cuadre" onClick={() => printCashReport(h, tenant)}><Printer /></Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <Dialog open={Boolean(justClosed)} onOpenChange={(v) => !v && setJustClosed(null)}>
        {justClosed && (
          <DialogContent title="Caja cerrada" description={dateTime(justClosed.closed_at)}>
            <div className="space-y-3 pb-5">
              <Line label="Efectivo esperado" value={n(justClosed.expected_cash)} />
              <Line label="Efectivo contado" value={n(justClosed.counted_cash)} />
              <div className="flex items-center justify-between border-t border-line pt-3">
                <span className="font-bold">Resultado</span>
                <DiffLabel diff={n(justClosed.difference)} />
              </div>
              <Button size="lg" className="w-full" onClick={() => printCashReport(justClosed, tenant)}><Printer /> Imprimir cuadre</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
