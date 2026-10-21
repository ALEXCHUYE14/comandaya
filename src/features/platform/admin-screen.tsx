"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarPlus, ExternalLink, Gift, Loader2, LogOut, MessageCircle, Save, Search, Settings2, Store, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { AdminTenantRow, PlatformSettings, SubscriptionPayMethod, SubscriptionState } from "@/core/domain/types";
import { money, whatsappLink } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { Brand } from "@/components/brand";
import { ImageUpload } from "@/components/image-upload";
import { ThemeToggle } from "@/components/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { longDate, STATE_LABEL } from "@/features/subscription/pay-instructions";
import { subscriptionRepo } from "@/infrastructure/repositories/subscription.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

const KEY = ["mafc"] as const;
const n = (v: unknown) => Number(v ?? 0);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short" });

const STATE_TONE: Record<SubscriptionState, "accent" | "olive" | "amber" | "danger" | "neutral"> = {
  trial: "accent", active: "olive", grace: "amber", suspended: "danger", free: "neutral",
};
const FILTERS: { id: "all" | SubscriptionState; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "trial", label: "En prueba" },
  { id: "active", label: "Activos" },
  { id: "grace", label: "Vencidos" },
  { id: "suspended", label: "Suspendidos" },
  { id: "free", label: "Cortesía" },
];
const METHOD_LABEL: Record<SubscriptionPayMethod, string> = {
  yape: "Yape", plin: "Plin", transfer: "Transferencia", cash: "Efectivo", card: "Tarjeta (en línea)", mercadopago: "Mercado Pago", other: "Otro",
};
/** Métodos para registrar a mano (los pagos en línea llegan solos). */
const METHODS: { id: SubscriptionPayMethod; label: string }[] = [
  { id: "yape", label: "Yape" }, { id: "plin", label: "Plin" }, { id: "transfer", label: "Transferencia" },
  { id: "cash", label: "Efectivo" }, { id: "other", label: "Otro" },
];

function dueText(t: AdminTenantRow): string {
  const s = t.subscription;
  if (!s) return "Sin plan";
  if (s.state === "free") return "Sin vencimiento";
  const d = s.days_left;
  if (s.state === "suspended") return s.override === "suspended" ? "Suspendido a mano" : `Venció el ${shortDate(s.access_end)}`;
  if (s.state === "grace") return `Venció el ${shortDate(s.access_end)} · corte ${shortDate(s.grace_end)}`;
  return `Vence ${shortDate(s.access_end)} · ${d <= 0 ? "hoy" : d === 1 ? "1 día" : `${d} días`}`;
}

function reminderLink(t: AdminTenantRow, price: number) {
  const s = t.subscription;
  const who = t.owner?.name?.split(" ")[0] ?? "";
  const msg = !s || s.state === "trial"
    ? `Hola ${who}, te escribe MAFC. ¿Qué tal te va con MAFC Comanda en ${t.name}? Tu prueba gratis termina el ${s ? longDate(s.access_end) : "pronto"}. Para seguir usándolo, el plan es ${money(price)} al mes.`
    : s.state === "grace" || s.state === "suspended"
      ? `Hola ${who}, te escribe MAFC. El plan de ${t.name} venció el ${longDate(s.access_end)}. Para reactivarlo son ${money(price)} al mes; cuando pagues envíame el comprobante por aquí.`
      : `Hola ${who}, te escribe MAFC. Te recuerdo que el plan de ${t.name} vence el ${longDate(s.access_end)} (${money(price)} al mes).`;
  return whatsappLink(t.whatsapp ?? t.phone, msg);
}

function TenantDialog({ tenant, price, onClose }: { tenant: AdminTenantRow; price: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(String(price));
  const [method, setMethod] = useState<SubscriptionPayMethod>("yape");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState(tenant.notes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const payments = useQuery({
    queryKey: [...KEY, "payments", tenant.id],
    queryFn: () => subscriptionRepo.tenantPayments(getSupabase(), tenant.id),
  });
  const s = tenant.subscription;

  async function run(label: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(label);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo completar"));
    } finally {
      setBusy(null);
    }
  }

  function pickMonths(m: number) {
    setMonths(m);
    setAmount(String(Math.round(price * m * 100) / 100));
  }

  const sb = getSupabase();
  const amountNum = Number(amount);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={tenant.name} description={`${tenant.owner?.email ?? "Sin dueño"} · ${dueText(tenant)}`}>
        <div className="space-y-6 pb-5">
          <section className="space-y-3">
            <h3 className="font-bold">Registrar pago</h3>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => pickMonths(m)}
                  className={cn("h-10 rounded-full border px-4 text-sm font-semibold", months === m ? "border-ink bg-ink text-bg" : "border-line text-muted")}>
                  {m === 1 ? "1 mes" : `${m} meses`}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Monto (S/)"><Input type="number" inputMode="decimal" min={0} step="0.10" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Método">
                <Select value={method} onChange={(e) => setMethod(e.target.value as SubscriptionPayMethod)}>
                  {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="N.º de operación"><Input maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Opcional" /></Field>
            </div>
            <Button className="w-full" disabled={busy !== null || !Number.isFinite(amountNum) || amountNum < 0}
              onClick={() => run("pay", () => subscriptionRepo.recordPayment(sb, { tenantId: tenant.id, months, amount: amountNum, method, reference }), `Pago registrado: +${months} ${months === 1 ? "mes" : "meses"}`)}>
              {busy === "pay" ? <Loader2 className="animate-spin" /> : <Wallet />} Registrar {money(amountNum || 0)} · {months === 1 ? "1 mes" : `${months} meses`}
            </Button>
          </section>

          <section className="space-y-3">
            <h3 className="font-bold">Estado de la cuenta</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled={busy !== null}
                onClick={() => run("trial", () => subscriptionRepo.setSubscription(sb, { tenantId: tenant.id, override: s?.override === "free" ? "free" : null, extendTrialDays: 7, notes }), "Prueba extendida 7 días")}>
                <CalendarPlus /> Extender prueba 7 días
              </Button>
              {s?.override ? (
                <Button variant="outline" disabled={busy !== null}
                  onClick={() => run("normal", () => subscriptionRepo.setSubscription(sb, { tenantId: tenant.id, override: null, notes }), "Cuenta en modo normal")}>
                  <Undo2 /> Quitar {s.override === "free" ? "cortesía" : "suspensión"}
                </Button>
              ) : (
                <Button variant="outline" disabled={busy !== null}
                  onClick={() => run("free", () => subscriptionRepo.setSubscription(sb, { tenantId: tenant.id, override: "free", notes }), "Cuenta de cortesía")}>
                  <Gift /> Dar cortesía (gratis)
                </Button>
              )}
              {s?.override !== "suspended" && (
                <Button variant="danger" className="sm:col-span-2" disabled={busy !== null}
                  onClick={() => confirm(`¿Suspender ${tenant.name}? Su caja y su carta QR se pausan hasta que pague.`) &&
                    run("suspend", () => subscriptionRepo.setSubscription(sb, { tenantId: tenant.id, override: "suspended", notes }), "Cuenta suspendida")}>
                  <Ban /> Suspender ahora
                </Button>
              )}
            </div>
            <Field label="Nota interna">
              <Textarea maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Ej. paga los 5 de cada mes" />
            </Field>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold">Historial de pagos</h3>
            {payments.isLoading ? <Skeleton className="h-16" /> : !payments.data?.length ? (
              <p className="text-sm text-muted">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {payments.data.map((p) => (
                  <li key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5 text-sm", p.voided_at && "opacity-50")}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{money(p.amount)} · {p.months === 1 ? "1 mes" : `${p.months} meses`} · {METHOD_LABEL[p.method] ?? p.method}</span>
                      <span className="text-xs text-muted">{shortDate(p.period_from)} → {shortDate(p.period_to)}{p.reference ? ` · Op. ${p.reference}` : ""}{p.voided_at ? " · ANULADO" : ""}</span>
                    </span>
                    {!p.voided_at && (
                      <Button variant="ghost" size="sm" disabled={busy !== null}
                        onClick={() => confirm("¿Anular este pago? El vencimiento retrocede los meses que cubría.") &&
                          run(`void-${p.id}`, () => subscriptionRepo.voidPayment(sb, p.id), "Pago anulado")}>
                        Anular
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformSettingsCard({ initial }: { initial: PlatformSettings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const saved = await subscriptionRepo.updatePlatformSettings(getSupabase(), {
        ...form,
        monthly_price: Number(form.monthly_price),
        trial_days: Math.round(Number(form.trial_days)),
        grace_days: Math.round(Number(form.grace_days)),
      });
      setForm(saved);
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success("Plan actualizado");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle title="Plan y datos de cobro" description="Lo ven tus clientes en «Mi plan» y en la pantalla de suspensión." />
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <ImageUpload tenantId="platform" kind="yape" keepOriginal label="QR de Yape de MAFC" value={form.yape_qr_url} onChange={(u) => set("yape_qr_url", u)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Precio mensual (S/)"><Input type="number" inputMode="decimal" min={0} step="0.10" value={form.monthly_price} onChange={(e) => set("monthly_price", e.target.value as unknown as number)} /></Field>
          <Field label="Días de prueba"><Input type="number" min={0} max={90} value={form.trial_days} onChange={(e) => set("trial_days", e.target.value as unknown as number)} /></Field>
          <Field label="Días de gracia" hint="Tras vencer, antes de suspender"><Input type="number" min={0} max={30} value={form.grace_days} onChange={(e) => set("grace_days", e.target.value as unknown as number)} /></Field>
          <Field label="Yape"><Input type="tel" value={form.yape_number ?? ""} onChange={(e) => set("yape_number", e.target.value)} placeholder="987 654 321" /></Field>
          <Field label="Plin"><Input type="tel" value={form.plin_number ?? ""} onChange={(e) => set("plin_number", e.target.value)} /></Field>
          <Field label="WhatsApp para comprobantes"><Input type="tel" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="987 654 321" /></Field>
          <Field label="Cuenta bancaria (opcional)" className="sm:col-span-3">
            <Textarea maxLength={300} value={form.bank_info ?? ""} onChange={(e) => set("bank_info", e.target.value)} className="min-h-16" placeholder="BCP Soles 123-4567890-0-12 · CCI 002-123-..." />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">La prueba nueva aplica a los negocios que se registren desde ahora; los días de gracia y el precio aplican a todos.</p>
      <Button className="mt-4" onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar plan</Button>
    </Card>
  );
}

export function AdminScreen() {
  const router = useRouter();
  const sb = getSupabase();
  const tenants = useQuery({ queryKey: [...KEY, "tenants"], queryFn: () => subscriptionRepo.listTenants(sb), staleTime: 30_000 });
  const settings = useQuery({ queryKey: [...KEY, "settings"], queryFn: () => subscriptionRepo.platformSettings(sb), staleTime: 5 * 60_000 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const rows = tenants.data ?? [];
  const price = n(settings.data?.monthly_price ?? 30);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      const st = r.subscription?.state ?? "trial";
      c[st] = (c[st] ?? 0) + 1;
    }
    return c;
  }, [rows]);
  const list = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    return (filter === "all" || r.subscription?.state === filter)
      && (!q || [r.name, r.slug, r.owner?.email, r.owner?.name].some((v) => v?.toLowerCase().includes(q)));
  });
  const open = rows.find((r) => r.id === openId) ?? null;

  async function logout() {
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Brand />
          <Badge tone="accent">Panel MAFC</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild><Link href="/pos"><Store /> Mi negocio</Link></Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings((v) => !v)}><Settings2 /> Plan y cobro</Button>
          <ThemeToggle />
          <button onClick={logout} aria-label="Cerrar sesión" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-danger"><LogOut className="size-5" /></button>
        </div>
      </header>

      {showSettings && settings.data && <PlatformSettingsCard initial={settings.data} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Ingreso mensual", value: money((counts.active ?? 0) * price), hint: `${counts.active ?? 0} activos × ${money(price)}` },
          { label: "En prueba", value: String(counts.trial ?? 0), hint: "Por convertir" },
          { label: "Vencidos", value: String(counts.grace ?? 0), hint: "En días de gracia: escríbeles" },
          { label: "Suspendidos", value: String(counts.suspended ?? 0) },
          { label: "Negocios", value: String(counts.all ?? 0), hint: counts.free ? `${counts.free} de cortesía` : undefined },
        ].map((k) => (
          <Card key={k.label} className="px-4 py-3">
            <p className="text-sm font-semibold text-muted">{k.label}</p>
            <p className="tabular font-[family-name:var(--font-display)] text-2xl font-extrabold">{k.value}</p>
            {k.hint && <p className="text-xs text-muted">{k.hint}</p>}
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={cn("h-10 rounded-full border px-4 text-sm font-semibold", filter === f.id ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink")}>
            {f.label}{counts[f.id] ? ` · ${counts[f.id]}` : ""}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar negocio o correo" className="h-10 pl-9" />
        </div>
      </div>

      {tenants.isError ? (
        <EmptyState icon={<Store />} title="No se pudo cargar" text={errorMessage(tenants.error)} action={<Button variant="outline" onClick={() => tenants.refetch()}>Reintentar</Button>} />
      ) : tenants.isLoading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <EmptyState icon={<Store />} title="Sin negocios en este filtro" />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((t) => {
            const st = t.subscription?.state;
            const wa = reminderLink(t, price);
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex items-center gap-2 font-bold">
                    <span className="truncate">{t.name}</span>
                    <a href={`/carta/${t.slug}`} target="_blank" rel="noreferrer" aria-label="Abrir carta" className="text-muted hover:text-ink"><ExternalLink className="size-3.5" /></a>
                  </p>
                  <p className="truncate text-xs text-muted">{t.owner?.name ?? "Sin dueño"} · {t.owner?.email ?? "—"}</p>
                </div>
                <div className="min-w-0 basis-40 text-xs text-muted">
                  <p>{n(t.orders_30d)} pedidos en 30 días</p>
                  <p>{t.last_order_at ? `Último: ${shortDate(t.last_order_at)}` : "Sin pedidos aún"}</p>
                </div>
                <div className="flex basis-52 flex-col items-start gap-1">
                  {st && <Badge tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Badge>}
                  <span className="text-xs text-muted">{dueText(t)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {wa && (
                    <Button variant="ghost" size="icon" asChild aria-label="Escribir por WhatsApp">
                      <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /></a>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setOpenId(t.id)}><Wallet /> Gestionar</Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {open && <TenantDialog key={open.id} tenant={open} price={price} onClose={() => setOpenId(null)} />}
    </div>
  );
}
