"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { Category, Product, Station } from "@/core/domain/types";
import { initials, money } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, Skeleton } from "@/components/ui/empty";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useCategories, useProducts } from "@/features/orders/use-catalog";
import { useSession } from "@/features/session/session-context";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { catalogRepo } from "@/infrastructure/repositories/catalog.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

type Draft = Partial<Product> & { name: string; price: number };

function ProductDialog({ draft, categories, onClose }: { draft: Draft | null; categories: Category[]; onClose: () => void }) {
  const { tenant } = useSession();
  const qc = useQueryClient();
  const [form, setForm] = useState<Draft | null>(draft);
  const [saving, setSaving] = useState(false);
  const uploaded = useRef<string[]>([]); // fotos subidas mientras el diálogo estuvo abierto

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const sb = getSupabase();
      await catalogRepo.saveProduct(sb, tenant.id, form);
      // Limpia del bucket la foto reemplazada y las que se probaron y descartaron
      const finalUrl = form.image_url ?? null;
      const unused = [...uploaded.current, draft?.image_url].filter((u) => u && u !== finalUrl);
      uploaded.current = [];
      void businessRepo.removeAssets(sb, tenant.id, unused);
      await qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Producto guardado");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  /** Cerrar sin guardar: las fotos subidas en este intento no las usa nadie. */
  function discard() {
    void businessRepo.removeAssets(getSupabase(), tenant.id, uploaded.current);
    uploaded.current = [];
    onClose();
  }

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && !saving && discard()}>
      <DialogContent title={draft?.id ? "Editar producto" : "Nuevo producto"}>
        {form && (
          <form onSubmit={save} className="space-y-4 pb-4">
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <ImageUpload tenantId={tenant.id} kind="products" preset="product" label="Foto" value={form.image_url ?? null}
                onChange={(u) => { if (u) uploaded.current.push(u); set("image_url", u); }} />
              <div className="space-y-3">
                <Field label="Nombre"><Input required maxLength={80} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="Precio (S/)">
                  <Input required type="number" inputMode="decimal" min={0} step="0.10" value={Number.isFinite(form.price) ? form.price : ""}
                    onChange={(e) => set("price", Number(e.target.value))} />
                </Field>
              </div>
            </div>
            <Field label="Descripción"><Textarea maxLength={240} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Ingredientes, tamaño, acompañamiento…" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoría">
                <Select value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value || null)}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Se prepara en">
                <Segmented<Station> value={form.station ?? "kitchen"} onChange={(v) => set("station", v)}
                  options={[{ value: "kitchen", label: "Cocina" }, { value: "bar", label: "Barra" }]} />
              </Field>
            </div>
            <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
              <span className="font-semibold">Disponible hoy</span>
              <Switch checked={form.is_available ?? true} onCheckedChange={(v) => set("is_available", v)} />
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CatalogScreen() {
  const { tenant } = useSession();
  const qc = useQueryClient();
  const categories = useCategories();
  const products = useProducts();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });
  const sb = getSupabase();
  const cats = categories.data ?? [];
  const list = (products.data ?? []).filter((p) => filter === "all" || p.category_id === filter || (filter === "none" && !p.category_id));

  /** Agotado/Disponible responde al instante; si el servidor falla, se revierte. */
  async function toggleAvailability(p: Product, isAvailable: boolean) {
    const key = ["catalog", "products"];
    const prev = qc.getQueryData<Product[]>(key);
    qc.setQueryData<Product[]>(key, (old) => old?.map((x) => (x.id === p.id ? { ...x, is_available: isAvailable } : x)));
    try {
      await catalogRepo.setAvailability(sb, p.id, isAvailable);
      toast.success(isAvailable ? `${p.name}: disponible` : `${p.name}: agotado en la carta`, { duration: 1500 });
    } catch (err) {
      if (prev) qc.setQueryData(key, prev);
      toast.error(errorMessage(err, "No se pudo actualizar"));
    }
  }

  async function run(fn: () => Promise<void>, ok?: string) {
    try {
      await fn();
      await refresh();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err, "Error"));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-6 md:pr-36">
      <section>
        <SectionTitle title="Categorías" description="Ordenan la carta digital y los filtros rápidos de caja." />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCat.trim()) return;
            void run(() => catalogRepo.saveCategory(sb, tenant.id, { name: newCat, sort_order: cats.length + 1 }), "Categoría creada");
            setNewCat("");
          }}
        >
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ej. Chaufas, Postres…" maxLength={60} />
          <Button type="submit"><Plus /> Agregar</Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {cats.map((c) => (
            <span key={c.id} className={cn("inline-flex h-11 items-center gap-1 rounded-full border border-line bg-surface pl-4 pr-1 text-sm font-semibold", !c.is_active && "opacity-50")}>
              {c.name}
              <button aria-label={`Renombrar ${c.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2"
                onClick={() => {
                  const name = prompt("Nuevo nombre", c.name);
                  if (name?.trim()) void run(() => catalogRepo.saveCategory(sb, tenant.id, { ...c, name }));
                }}>
                <Pencil className="size-3.5" />
              </button>
              <button aria-label={`Eliminar ${c.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                onClick={() => confirm(`¿Eliminar "${c.name}"? Sus productos quedarán sin categoría.`) && void run(() => catalogRepo.deleteCategory(sb, c.id))}>
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          title="Productos"
          description="Marca como agotado lo que se acabó: en la carta QR se ve como «Agotado» al instante."
          action={<Button onClick={() => setDraft({ name: "", price: 0, category_id: filter !== "all" && filter !== "none" ? filter : (cats[0]?.id ?? null), station: "kitchen", is_available: true })}><Plus /> Nuevo producto</Button>}
        />
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {[{ id: "all", name: "Todos" }, ...cats, { id: "none", name: "Sin categoría" }].map((c) => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", filter === c.id ? "border-ink bg-ink text-bg" : "border-line text-muted")}>
              {c.name}
            </button>
          ))}
        </div>

        {products.isLoading ? (
          <Skeleton className="h-60" />
        ) : list.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed />} title="Aún no hay productos" text="Crea tu primer plato para empezar a vender." />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {list.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" loading="lazy" decoding="async" width={56} height={56} className="size-14 shrink-0 rounded-xl bg-surface-2 object-cover" />
                ) : (
                  <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-surface-2 font-[family-name:var(--font-display)] font-extrabold text-muted">{initials(p.name)}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="tabular text-sm text-muted">
                    {money(p.price)} · {cats.find((c) => c.id === p.category_id)?.name ?? "Sin categoría"} · {p.station === "bar" ? "Barra" : "Cocina"}
                  </p>
                </div>
                <label className="hidden items-center gap-2 text-sm font-semibold text-muted sm:flex">
                  {p.is_available ? "Disponible" : "Agotado"}
                  <Switch checked={p.is_available} onCheckedChange={(v) => void toggleAvailability(p, v)} />
                </label>
                <Switch className="sm:hidden" checked={p.is_available} onCheckedChange={(v) => void toggleAvailability(p, v)} aria-label="Disponible" />
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setDraft({ ...p })}><Pencil /></Button>
                <Button variant="ghost" size="icon" aria-label="Archivar" className="hidden text-muted hover:text-danger sm:inline-flex"
                  onClick={() => confirm(`¿Quitar "${p.name}" de la carta?`) && void run(() => catalogRepo.archiveProduct(sb, p.id), "Producto archivado")}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <ProductDialog key={draft?.id ?? (draft ? "new" : "none")} draft={draft} categories={cats} onClose={() => setDraft(null)} />
    </div>
  );
}
