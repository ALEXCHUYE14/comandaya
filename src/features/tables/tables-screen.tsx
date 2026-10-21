"use client";

import { errorMessage } from "@/core/lib/cn";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, ExternalLink, Pencil, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DiningTable } from "@/core/domain/types";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTables } from "@/features/orders/use-catalog";
import { useSession } from "@/features/session/session-context";
import { catalogRepo } from "@/infrastructure/repositories/catalog.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { downloadQr, printQrSheet, publicMenuUrl, qrSvg } from "./qr";

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
  const { tenant } = useSession();
  const qc = useQueryClient();
  const tables = useTables();
  const [label, setLabel] = useState("");
  const sb = getSupabase();
  const menuUrl = publicMenuUrl(tenant.slug);
  const list = tables.data ?? [];

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
        <Card className="grid items-center gap-6 p-5 sm:grid-cols-[200px_1fr]">
          <QrPreview url={menuUrl} className="mx-auto size-48 overflow-hidden rounded-2xl bg-white p-2 [&_svg]:size-full" />
          <div className="min-w-0 space-y-3">
            <p className="truncate rounded-xl bg-surface-2 px-4 py-3 font-mono text-sm">{menuUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(menuUrl); toast.success("Enlace copiado"); }}><Copy /> Copiar</Button>
              <Button variant="outline" asChild><a href={menuUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a></Button>
              <Button variant="outline" onClick={() => downloadQr(menuUrl, `qr-${tenant.slug}`, "svg")}><Download /> SVG</Button>
              <Button variant="outline" onClick={() => downloadQr(menuUrl, `qr-${tenant.slug}`, "png")}><Download /> PNG</Button>
              <Button onClick={() => printQrSheet(tenant.name, [{ title: "Nuestra carta", url: menuUrl }])}><Printer /> Imprimir</Button>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle
          title="Mesas"
          description="Cada mesa tiene su propio QR: el pedido llega a caja y cocina con la mesa asignada."
          action={list.length > 0 && (
            <Button variant="outline" onClick={() => printQrSheet(tenant.name, list.filter((t) => t.is_active).map((t) => ({ title: t.label, url: publicMenuUrl(tenant.slug, t.public_code) })))}>
              <Printer /> Imprimir todos los QR
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
                      <Button size="icon-sm" variant="ghost" aria-label="Descargar PNG" onClick={() => downloadQr(url, `qr-${t.label}`, "png")}><Download /></Button>
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
