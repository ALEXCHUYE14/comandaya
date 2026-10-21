"use client";

import { errorMessage } from "@/core/lib/cn";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Copy, Download, ExternalLink, ImageDown, Loader2, Pencil, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DiningTable } from "@/core/domain/types";
import { slugify } from "@/core/domain/order-rules";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTables } from "@/features/orders/use-catalog";
import { useSession } from "@/features/session/session-context";
import { catalogRepo } from "@/infrastructure/repositories/catalog.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { downloadQr, downloadQrPoster, printQrPosters, publicMenuUrl, qrSvg, type QrPoster } from "./qr";
import { QrPosterPreview } from "./qr-poster";

function QrPreview({ url, className }: { url: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    void qrSvg(url).then((s) => alive && setSvg(s));
    return () => { alive = false; };
  }, [url]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} aria-label={`Código QR para ${url}`} role="img" />;
}

export function TablesScreen() {
  const { tenant, settings } = useSession();
  const qc = useQueryClient();
  const tables = useTables();
  const [label, setLabel] = useState("");
  const sb = getSupabase();
  const menuUrl = publicMenuUrl(tenant.slug);
  const list = tables.data ?? [];
  const [busy, setBusy] = useState<string | null>(null);

  // Datos del cartel: salen de Ajustes, así siempre están al día
  const base = {
    business: tenant.name,
    address: settings.address,
    phone: settings.whatsapp || settings.phone,
    welcome: settings.welcome_message,
    logoUrl: settings.logo_url,
  };
  const menuPoster: QrPoster = { ...base, url: menuUrl };
  const tablePoster = (t: DiningTable): QrPoster => ({ ...base, table: t.label, url: publicMenuUrl(tenant.slug, t.public_code) });

  async function savePoster(key: string, poster: QrPoster, name: string) {
    setBusy(key);
    try {
      await downloadQrPoster(poster, `cartel-${slugify(name) || "qr"}`);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo generar el cartel"));
    } finally {
      setBusy(null);
    }
  }

  async function run(fn: () => Promise<void>, ok?: string) {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["catalog", "tables"] });
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err, "Error"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6 md:pr-36">
      <section>
        <SectionTitle title="Carta digital QR" description="Un solo QR para el mostrador, redes o delivery. El cliente pide para llevar y sigue su pedido en vivo." />
        <Card className="grid items-start gap-6 p-5 md:grid-cols-[300px_1fr]">
          <QrPosterPreview poster={menuPoster} className="mx-auto" />
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Cartel listo para imprimir</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => printQrPosters([menuPoster])}><Printer /> Imprimir cartel</Button>
                <Button variant="outline" disabled={busy === "menu"} onClick={() => savePoster("menu", menuPoster, `carta-${tenant.slug}`)}>
                  {busy === "menu" ? <Loader2 className="animate-spin" /> : <ImageDown />} Descargar cartel (PNG)
                </Button>
              </div>
              <p className="text-sm text-muted">
                El nombre, logo, dirección, teléfono y mensaje salen de <Link href="/ajustes" className="font-semibold text-accent">Ajustes</Link>.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Enlace de tu carta</p>
              <p className="truncate rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm">{menuUrl}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(menuUrl); toast.success("Enlace copiado"); }}><Copy /> Copiar</Button>
                <Button variant="outline" asChild><a href={menuUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a></Button>
                <Button variant="ghost" onClick={() => downloadQr(menuUrl, `qr-${tenant.slug}`, "png")}><Download /> Sólo QR (PNG)</Button>
                <Button variant="ghost" onClick={() => downloadQr(menuUrl, `qr-${tenant.slug}`, "svg")}><Download /> Sólo QR (SVG)</Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle
          title="Mesas"
          description="Cada mesa tiene su propio QR: el pedido llega a caja y cocina con la mesa asignada."
          action={list.length > 0 && (
            <Button variant="outline" onClick={() => printQrPosters(list.filter((t) => t.is_active).map(tablePoster))}>
              <Printer /> Imprimir carteles de todas las mesas
            </Button>
          )}
        />
        <form className="mb-4 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const name = label.trim() || `Mesa ${list.length + 1}`;
          void run(() => catalogRepo.saveTable(sb, tenant.id, { label: name, sort_order: list.length + 1 }), `${name} creada`);
          setLabel("");
        }}>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Mesa ${list.length + 1}`} maxLength={30} />
          <Button type="submit"><Plus /> Agregar</Button>
        </form>

        {tables.isLoading ? <Skeleton className="h-48" /> : list.length === 0 ? (
          <EmptyState icon={<QrCode />} title="Sin mesas" text="Si solo atiendes al paso, no necesitas mesas: usa el QR de la carta." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t: DiningTable) => {
              const url = publicMenuUrl(tenant.slug, t.public_code);
              const key = `table-${t.id}`;
              return (
                <Card key={t.id} className="flex gap-4 p-4">
                  <QrPreview url={url} className="size-24 shrink-0 overflow-hidden rounded-xl bg-white p-1 [&_svg]:size-full" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold">{t.label}</p>
                      <Switch checked={t.is_active} aria-label="Activa" onCheckedChange={(v) => void run(() => catalogRepo.saveTable(sb, tenant.id, { ...t, is_active: v }))} />
                    </div>
                    <p className="font-mono text-xs text-muted">?mesa={t.public_code}</p>
                    <div className="mt-auto flex gap-1 pt-2">
                      <Button size="icon-sm" variant="ghost" aria-label={`Imprimir cartel de ${t.label}`} title="Imprimir cartel" onClick={() => printQrPosters([tablePoster(t)])}><Printer /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Descargar cartel de ${t.label}`} title="Descargar cartel (PNG)" disabled={busy === key}
                        onClick={() => savePoster(key, tablePoster(t), `${tenant.slug}-${t.label}`)}>
                        {busy === key ? <Loader2 className="animate-spin" /> : <ImageDown />}
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Descargar sólo el QR de ${t.label}`} title="Sólo QR (PNG)" onClick={() => downloadQr(url, `qr-${slugify(t.label)}`, "png")}><Download /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Renombrar" onClick={() => {
                        const name = prompt("Nombre de la mesa", t.label);
                        if (name?.trim()) void run(() => catalogRepo.saveTable(sb, tenant.id, { ...t, label: name }));
                      }}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Eliminar" className="text-muted hover:text-danger"
                        onClick={() => confirm(`¿Eliminar ${t.label}? Su QR dejará de funcionar.`) && void run(() => catalogRepo.deleteTable(sb, t.id))}><Trash2 /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
