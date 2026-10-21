"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Ban, Download, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { OrderSource, OrderStatus, OrderType, PaymentMethod } from "@/core/domain/types";
import { can, money, ORDER_TYPE_LABEL, PAYMENT_LABEL, STATUS_LABEL, ticketCode } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { addDays, daysBetween, eachDay, formatDay, formatShortDay, startOfMonth, todayIn } from "@/core/lib/dates";
import { downloadXlsx } from "@/core/lib/xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/session/session-context";
import { reportsRepo } from "@/infrastructure/repositories/reports.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "last-month";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "month", label: "Este mes" },
  { id: "last-month", label: "Mes pasado" },
];

function rangeFor(p: Preset, today: string): [string, string] {
  switch (p) {
    case "today": return [today, today];
    case "yesterday": return [addDays(today, -1), addDays(today, -1)];
    case "7d": return [addDays(today, -6), today];
    case "30d": return [addDays(today, -29), today];
    case "month": return [startOfMonth(today), today];
    case "last-month": {
      const end = addDays(startOfMonth(today), -1);
      return [startOfMonth(end), end];
    }
  }
}

const SOURCE_LABEL: Record<OrderSource, string> = { pos: "Caja", qr: "Carta QR" };
const n = (v: unknown) => Number(v ?? 0);

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="tabular mt-0.5 font-[family-name:var(--font-display)] text-2xl font-extrabold sm:text-3xl">{value}</p>
      {hint && <p className={cn("mt-0.5 text-xs text-muted", tone === "warn" && "font-semibold text-amber")}>{hint}</p>}
    </Card>
  );
}

/**
 * Barras verticales de una sola serie. Al pasar el mouse o tocar una barra se ve su detalle;
 * las etiquetas del eje se espacian para no chocar.
 */
function Bars({ data, ariaLabel }: { data: { key: string; label: string; detail: string; value: number }[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const every = Math.max(1, Math.ceil(data.length / 8));
  const shown = active !== null ? data[active] : null;

  if (max === 0) return <p className="py-10 text-center text-sm text-muted">Sin ventas en este periodo.</p>;
  return (
    <div>
      <p className="mb-2 h-5 text-sm text-muted" aria-live="polite">
        {shown ? <><span className="font-semibold text-ink">{shown.detail}</span> · {money(shown.value)}</> : "Toca una barra para ver el detalle"}
      </p>
      <div role="img" aria-label={ariaLabel} className="flex h-44 items-end gap-[2px] border-b border-line" onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            aria-label={`${d.detail}: ${money(d.value)}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className="group flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
          >
            <span
              className={cn("block w-full rounded-t-[4px] bg-accent transition-opacity", active !== null && active !== i ? "opacity-40" : "opacity-100", "group-focus-visible:ring-2 group-focus-visible:ring-ring")}
              style={{ height: `${d.value > 0 ? Math.max((d.value / max) * 100, 2) : 0}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[11px] text-muted">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{i % every === 0 ? d.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

/** Lista con barra horizontal: valor y porcentaje escritos, la barra sólo refuerza. */
function ShareList({ rows }: { rows: { key: string; label: string; orders: number; total: number }[] }) {
  const sum = rows.reduce((a, r) => a + r.total, 0);
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">Sin datos.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = sum > 0 ? (r.total / sum) * 100 : 0;
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{r.label}</span>
              <span className="tabular text-muted"><b className="text-ink">{money(r.total)}</b> · {pct.toFixed(0)}% · {r.orders} ped.</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReportsScreen() {
  const { profile, tenant, settings } = useSession();
  const today = todayIn(settings.timezone);
  const [preset, setPreset] = useState<Preset | null>("today");
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor("today", today));
  const [exporting, setExporting] = useState(false);
  const allowed = can.manage(profile.role);

  const report = useQuery({
    queryKey: ["reports", "sales", from, to],
    queryFn: () => reportsRepo.sales(getSupabase(), from, to),
    enabled: allowed,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const r = report.data;
  const multiDay = daysBetween(from, to) > 0;

  const byDay = useMemo(() => {
    if (!r || !multiDay) return [];
    const map = new Map(r.by_day.map((d) => [d.day, n(d.total)]));
    return eachDay(from, to).map((d) => ({ key: d, label: formatShortDay(d), detail: formatDay(d), value: map.get(d) ?? 0 }));
  }, [r, from, to, multiDay]);

  const byHour = useMemo(() => {
    if (!r || !r.by_hour.length) return [];
    const map = new Map(r.by_hour.map((h) => [n(h.hour), n(h.total)]));
    const hours = [...map.keys()];
    const first = Math.min(...hours), last = Math.max(...hours);
    return Array.from({ length: last - first + 1 }, (_, i) => first + i).map((h) => ({
      key: String(h), label: `${h}h`, detail: `De ${h}:00 a ${h}:59`, value: map.get(h) ?? 0,
    }));
  }, [r]);

  function pick(p: Preset) {
    setPreset(p);
    setRange(rangeFor(p, today));
  }

  function setDate(which: "from" | "to", value: string) {
    if (!value) return;
    setPreset(null);
    setRange(([f, t]) => {
      const nf = which === "from" ? value : f;
      const nt = which === "to" ? value : t;
      return nf <= nt ? [nf, nt] : [nt, nf];
    });
  }

  async function exportExcel() {
    if (daysBetween(from, to) > 366) return toast.error("Exporta como máximo un año a la vez");
    setExporting(true);
    try {
      const rows = await reportsRepo.ordersForExport(getSupabase(), from, to);
      if (!rows.length) return void toast.info("No hay pedidos en este periodo");
      downloadXlsx(
        `ventas-${tenant.slug}-${from}_${to}.xlsx`,
        "Pedidos",
        ["Ticket", "Fecha", "Hora", "Tipo", "Origen", "Estado", "Pago", "Método", "Subtotal", "Descuento", "Total", "Cliente", "Motivo de anulación"],
        rows.map((o) => [
          ticketCode(o.ticket_number),
          o.business_date,
          new Date(o.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: settings.timezone }),
          ORDER_TYPE_LABEL[o.order_type as OrderType],
          SOURCE_LABEL[o.source as OrderSource],
          STATUS_LABEL[o.status as OrderStatus],
          o.payment_status === "paid" ? "Pagado" : "Por cobrar",
          o.payment_method ? PAYMENT_LABEL[o.payment_method as PaymentMethod] : "",
          n(o.subtotal),
          n(o.discount),
          n(o.total),
          o.customer_name ?? "",
          o.cancel_reason ?? "",
        ]),
      );
      toast.success(`Excel listo: ${rows.length} pedidos`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo exportar"));
    } finally {
      setExporting(false);
    }
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState icon={<BarChart3 />} title="Sólo para administración" text="Los reportes de ventas los ve el propietario o un administrador." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:pr-36">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Reportes de ventas</h1>
          <p className="text-muted">Ventas cobradas (sin anulados) por fecha de atención.</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={exporting}>
          {exporting ? <Loader2 className="animate-spin" /> : <Download />} Exportar a Excel
        </Button>
      </div>

      {/* Filtros en una sola fila */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => pick(p.id)}
            className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", preset === p.id ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink")}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="Desde" className="h-10 w-[9.5rem]" value={from} max={today} onChange={(e) => setDate("from", e.target.value)} />
          <span className="text-muted">a</span>
          <Input type="date" aria-label="Hasta" className="h-10 w-[9.5rem]" value={to} max={today} onChange={(e) => setDate("to", e.target.value)} />
        </div>
      </div>

      {report.isError ? (
        <EmptyState icon={<TriangleAlert />} title="No se pudo cargar el reporte" text={errorMessage(report.error)}
          action={<Button variant="outline" onClick={() => report.refetch()}>Reintentar</Button>} />
      ) : !r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
          <Skeleton className="h-64 sm:col-span-2 lg:col-span-4" />
        </div>
      ) : (
        <>
          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4 transition-opacity", report.isFetching && "opacity-60")}>
            <Kpi label="Ventas" value={money(r.totals.sales)} hint={n(r.totals.discounts) > 0 ? `Descuentos: ${money(r.totals.discounts)}` : undefined} />
            <Kpi label="Pedidos cobrados" value={String(n(r.totals.orders))} />
            <Kpi label="Ticket promedio" value={money(r.totals.avg_ticket)} />
            <Kpi label="Por cobrar" value={money(r.unpaid.amount)} hint={`${n(r.unpaid.orders)} pedidos sin pagar`} tone={n(r.unpaid.orders) > 0 ? "warn" : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <SectionTitle title={multiDay ? "Ventas por día" : "Ventas por hora"} description={multiDay ? `${formatDay(from)} – ${formatDay(to)}` : formatDay(from)} />
              <Bars data={multiDay ? byDay : byHour} ariaLabel={multiDay ? "Ventas por día" : "Ventas por hora"} />
            </Card>
            <Card className="p-5">
              <SectionTitle title="Métodos de pago" />
              <ShareList rows={r.by_method.map((m) => ({ key: m.method ?? "none", label: m.method ? PAYMENT_LABEL[m.method] : "Sin método", orders: n(m.orders), total: n(m.total) }))} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <div className="p-5 pb-0"><SectionTitle title="Lo más vendido" description="Top 10 por monto" /></div>
              {r.top_products.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-muted">Sin ventas en este periodo.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-y border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-5 py-2 font-semibold">#</th><th className="py-2 font-semibold">Producto</th><th className="py-2 text-right font-semibold">Cant.</th><th className="px-5 py-2 text-right font-semibold">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.top_products.map((p, i) => (
                      <tr key={p.name}>
                        <td className="tabular px-5 py-2.5 text-muted">{i + 1}</td>
                        <td className="py-2.5 font-semibold">{p.name}</td>
                        <td className="tabular py-2.5 text-right">{n(p.qty)}</td>
                        <td className="tabular px-5 py-2.5 text-right font-semibold">{money(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <div className="space-y-4">
              <Card className="p-5">
                <SectionTitle title="Tipo de pedido" />
                <ShareList rows={r.by_type.map((t) => ({ key: t.type, label: ORDER_TYPE_LABEL[t.type], orders: n(t.orders), total: n(t.total) }))} />
              </Card>
              <Card className="p-5">
                <SectionTitle title="Origen" />
                <ShareList rows={r.by_source.map((s) => ({ key: s.source, label: SOURCE_LABEL[s.source], orders: n(s.orders), total: n(s.total) }))} />
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="p-5 pb-0">
              <SectionTitle
                title="Anulaciones"
                description={n(r.cancelled.orders) > 0
                  ? `${n(r.cancelled.orders)} pedidos · ${money(r.cancelled.amount)}${n(r.cancelled.paid_amount) > 0 ? ` · ${money(r.cancelled.paid_amount)} ya estaban cobrados` : ""}`
                  : "Ninguna en este periodo"}
              />
            </div>
            {r.cancellations.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {r.cancellations.map((c) => (
                  <li key={`${c.day}-${c.ticket}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-bold"><Ban className="size-4 text-danger" />{ticketCode(c.ticket)}</span>
                    <span className="text-muted">{formatShortDay(c.day)}</span>
                    <span className="tabular font-semibold">{money(c.total)}</span>
                    {c.payment_status === "paid" && <Badge tone="amber">Ya cobrado</Badge>}
                    <span className="min-w-0 flex-1 text-muted">{c.reason ?? "Sin motivo"}</span>
                    <span className="text-xs text-muted">{c.by_name ? `por ${c.by_name}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
