"use client";

import { errorMessage } from "@/core/lib/cn";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Save, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AppRole, BusinessSettings } from "@/core/domain/types";
import { ROLE_LABEL } from "@/core/domain/order-rules";
import { BrandMark } from "@/components/brand";
import { ImageUpload } from "@/components/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/features/session/session-context";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle title={title} description={description} />
      {children}
    </Card>
  );
}

function TeamSection() {
  const { profile } = useSession();
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => businessRepo.team(getSupabase()) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("cashier");
  const [busy, setBusy] = useState(false);
  const roles: AppRole[] = profile.role === "owner" ? ["admin", "cashier", "waiter", "kitchen", "owner"] : ["cashier", "waiter", "kitchen"];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await businessRepo.addStaff(getSupabase(), email, role);
      toast.success("Personal agregado. Ya puede entrar con su cuenta.");
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(errorMessage(err, "Error"));
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, patch: { role?: AppRole; is_active?: boolean }) {
    try {
      await businessRepo.updateStaff(getSupabase(), id, patch);
      await qc.invalidateQueries({ queryKey: ["team"] });
    } catch (err) {
      toast.error(errorMessage(err, "Error"));
    }
  }

  return (
    <Section title="Equipo" description="Tu personal crea su cuenta en /registro y tú lo vinculas aquí con su correo.">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@del-personal.com" />
        <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Agregar</Button>
      </form>
      <ul className="mt-4 divide-y divide-line">
        {(team.data ?? []).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.full_name || m.email} {m.id === profile.id && <Badge tone="accent">Tú</Badge>}</p>
              <p className="truncate text-sm text-muted">{m.email}</p>
            </div>
            {m.id === profile.id || (m.role === "owner" && profile.role !== "owner") ? (
              <Badge>{ROLE_LABEL[m.role]}</Badge>
            ) : (
              <>
                <Select className="h-11 w-40" value={m.role} onChange={(e) => update(m.id, { role: e.target.value as AppRole })}>
                  {[...new Set([...roles, m.role])].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
                <Switch checked={m.is_active} aria-label="Activo" onCheckedChange={(v) => update(m.id, { is_active: v })} />
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SettingsScreen() {
  const { tenant, settings, refresh } = useSession();
  const [name, setName] = useState(tenant.name);
  const [form, setForm] = useState<BusinessSettings>(settings);
  const [saving, setSaving] = useState(false);
  const uploaded = useRef<string[]>([]); // subidas de esta sesión, para limpiar las descartadas
  const dirty = name !== tenant.name || JSON.stringify(form) !== JSON.stringify(settings);

  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setImage = (k: "logo_url" | "yape_qr_url" | "plin_qr_url", url: string | null) => {
    if (url) uploaded.current.push(url);
    set(k, url);
  };
  const text = (k: keyof BusinessSettings) => ({
    value: (form[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never),
  });

  async function save() {
    if (form.tax_id && !/^\d{8}(\d{3})?$/.test(form.tax_id)) {
      toast.error("El RUC debe tener 11 dígitos o el DNI 8");
      return;
    }
    setSaving(true);
    try {
      const sb = getSupabase();
      if (name.trim() !== tenant.name) await businessRepo.renameTenant(sb, tenant.id, name.trim());
      await businessRepo.updateSettings(sb, tenant.id, form);
      // Sólo se borran subidas descartadas en esta sesión: el logo/QR anterior puede
      // seguir abierto en otro dispositivo del local (ticket, caja) hasta que recargue.
      const inUse = [form.logo_url, form.yape_qr_url, form.plin_qr_url];
      const unused = uploaded.current.filter((u) => !inUse.includes(u));
      uploaded.current = [];
      void businessRepo.removeAssets(sb, tenant.id, unused);
      await refresh();
      toast.success("Ajustes guardados");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:pr-36">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Ajustes del negocio</h1>
          <p className="text-muted">Tu marca en la carta QR, los tickets y la pantalla de cobro.</p>
        </div>
        <Button asChild variant="outline"><Link href="/plan"><CreditCard /> Mi plan</Link></Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Section title="Datos del negocio">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre comercial" className="sm:col-span-2"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
              <Field label="Razón social"><Input {...text("legal_name")} /></Field>
              <Field label="RUC / DNI" hint="11 dígitos (RUC) u 8 (DNI)">
                <Input inputMode="numeric" maxLength={11} {...text("tax_id")} onChange={(e) => set("tax_id", e.target.value.replace(/\D/g, "") || null)} />
              </Field>
              <Field label="Dirección" className="sm:col-span-2"><Input {...text("address")} placeholder="Av. Grau 123, Piura" /></Field>
              <Field label="Teléfono"><Input type="tel" {...text("phone")} /></Field>
              <Field label="WhatsApp"><Input type="tel" {...text("whatsapp")} placeholder="987 654 321" /></Field>
              <Field label="Correo" className="sm:col-span-2"><Input type="email" {...text("email")} /></Field>
            </div>
          </Section>

          <Section title="Redes sociales" description="Se muestran al pie de tu carta digital.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Instagram"><Input {...text("instagram")} placeholder="@tunegocio" /></Field>
              <Field label="Facebook"><Input {...text("facebook")} placeholder="facebook.com/…" /></Field>
              <Field label="TikTok"><Input {...text("tiktok")} placeholder="@tunegocio" /></Field>
            </div>
          </Section>

          <Section title="Cobros con Yape y Plin" description="El QR aparece en caja al cobrar y en el seguimiento del cliente.">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <ImageUpload tenantId={tenant.id} kind="yape" label="QR de Yape" keepOriginal value={form.yape_qr_url} onChange={(u) => setImage("yape_qr_url", u)} />
                <Field label="Número Yape"><Input type="tel" {...text("yape_number")} placeholder="987 654 321" /></Field>
              </div>
              <div className="space-y-3">
                <ImageUpload tenantId={tenant.id} kind="plin" label="QR de Plin" keepOriginal value={form.plin_qr_url} onChange={(u) => setImage("plin_qr_url", u)} />
                <Field label="Número Plin"><Input type="tel" {...text("plin_number")} placeholder="987 654 321" /></Field>
              </div>
            </div>
          </Section>

          <Section title="Mensajes">
            <div className="space-y-4">
              <Field label="Bienvenida de la carta digital"><Textarea maxLength={200} {...text("welcome_message")} /></Field>
              <Field label="Pie del ticket"><Textarea maxLength={200} {...text("ticket_footer")} /></Field>
            </div>
          </Section>

          <Section title="Operación">
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3">
                <span><span className="block font-semibold">Recibir pedidos desde la carta QR</span><span className="text-sm text-muted">Apágalo en horas punta si la cocina está saturada.</span></span>
                <Switch checked={form.accept_qr_orders} onCheckedChange={(v) => set("accept_qr_orders", v)} />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 px-4 py-3">
                <span><span className="block font-semibold">Alerta sonora en cocina</span><span className="text-sm text-muted">Campanita al llegar cada comanda nueva.</span></span>
                <Switch checked={form.kds_sound} onCheckedChange={(v) => set("kds_sound", v)} />
              </label>
            </div>
          </Section>

          <TeamSection />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <ImageUpload tenantId={tenant.id} kind="logo" preset="logo" label="Logo del negocio" value={form.logo_url} onChange={(u) => setImage("logo_url", u)} />
          </Card>
          <Card className="overflow-hidden">
            <p className="px-4 pt-4 text-xs font-bold uppercase tracking-wide text-muted">Vista previa de la carta</p>
            <div className="m-4 rounded-2xl bg-[#121212] p-4 text-[#eee8e0]">
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="" className="size-12 rounded-xl bg-white object-cover" />
                ) : <BrandMark className="size-12" />}
                <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight">{name || "Tu negocio"}</p>
              </div>
              <p className="mt-3 text-sm text-[#a1978c]">{form.welcome_message}</p>
            </div>
          </Card>
        </aside>
      </div>

      {dirty && (
        <div className="fixed inset-x-4 bottom-[84px] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink p-2 pl-5 text-bg shadow-2xl animate-slide-up md:bottom-6">
          <span className="text-sm font-semibold">Tienes cambios sin guardar</span>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar</Button>
        </div>
      )}
    </div>
  );
}
