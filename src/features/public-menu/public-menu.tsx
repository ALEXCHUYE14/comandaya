"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, ChevronRight, Clock3, AtSign, Loader2, MapPin, MessageCircle, Minus, Phone, Plus, Send, ShoppingBag, Utensils } from "lucide-react";
import { toast } from "sonner";
import type { OrderType, PublicMenu } from "@/core/domain/types";
import { MAFC_TAGLINE, MAFC_WHATSAPP } from "@/core/domain/mafc";
import { cartCount, cartTotal, initials, money, ticketCode, whatsappLink } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { publicRepo } from "@/infrastructure/repositories/public.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { usePublicCart } from "@/stores/public-cart";
import { useLiveMenu } from "./use-live-menu";

type Product = PublicMenu["products"][number];

function AddControl({ qty, onAdd, onDec, disabled }: { qty: number; onAdd: () => void; onDec: () => void; disabled: boolean }) {
  const [burst, setBurst] = useState(0);
  if (disabled) return <span className="rounded-full bg-surface-2 px-3 py-2 text-xs font-bold text-muted">Agotado</span>;
  if (qty === 0) {
    return (
      <button
        onClick={() => { onAdd(); setBurst((b) => b + 1); }}
        aria-label="Agregar"
        className="relative grid size-12 place-items-center rounded-full bg-accent text-accent-ink shadow-lg shadow-accent/25 transition-transform active:scale-90"
      >
        <Plus className="size-6" />
      </button>
    );
  }
  return (
    <div className="relative flex items-center gap-1 rounded-full bg-ink p-1 text-bg animate-pop">
      <button onClick={onDec} aria-label="Quitar uno" className="grid size-10 place-items-center rounded-full active:scale-90"><Minus className="size-4" /></button>
      <span key={qty} className="tabular w-5 animate-pop text-center font-extrabold">{qty}</span>
      <button onClick={() => { onAdd(); setBurst((b) => b + 1); }} aria-label="Agregar uno" className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink active:scale-90"><Plus className="size-4" /></button>
      {burst > 0 && <span key={burst} className="pointer-events-none absolute -top-2 right-3 animate-fly font-extrabold text-accent">+1</span>}
    </div>
  );
}

/**
 * Foto del plato: carga diferida, aparece suave y, si falla, muestra las iniciales.
 * Las URLs son únicas por subida y se cachean 1 año: el celular no las vuelve a descargar.
 */
function ProductImage({ src, name, soldOut, eager, className }: { src: string; name: string; soldOut: boolean; eager?: boolean; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  // La imagen pudo terminar de cargar antes de hidratar (caché): onLoad ya no llegará
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) setState(img.naturalWidth > 0 ? "ok" : "error");
  }, []);

  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {state === "error" ? (
        <span className="grid size-full place-items-center font-[family-name:var(--font-display)] text-2xl font-extrabold text-muted/60">{initials(name)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt={name}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn("size-full object-cover transition-[opacity,filter] duration-300", state === "ok" ? "opacity-100" : "opacity-0", soldOut && "grayscale")}
        />
      )}
      {soldOut && (
        <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-center text-[11px] font-extrabold uppercase tracking-wider text-white">Agotado</span>
      )}
    </div>
  );
}

function ProductRow({ p, qty, onAdd, onDec, onOpen, placeholder, eager }: {
  p: Product; qty: number; onAdd: () => void; onDec: () => void; onOpen: () => void; placeholder: boolean; eager: boolean;
}) {
  const soldOut = !p.is_available;
  return (
    <article className={cn("flex gap-4 rounded-3xl border border-line bg-surface p-3 transition-colors", qty > 0 && "border-accent/60", soldOut && "opacity-75")}>
      {(p.image_url || placeholder) && (
        <button type="button" onClick={onOpen} aria-label={`Ver ${p.name}`} className="shrink-0 self-start rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
          {p.image_url ? (
            <ProductImage key={p.image_url} src={p.image_url} name={p.name} soldOut={soldOut} eager={eager} className="size-28 rounded-2xl sm:size-32" />
          ) : (
            <span className="grain grid size-28 place-items-center rounded-2xl bg-surface-2 font-[family-name:var(--font-display)] text-3xl font-extrabold text-muted/50 sm:size-32">
              {initials(p.name)}
            </span>
          )}
        </button>
      )}
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="text-lg font-bold leading-tight">{p.name}</h3>
          {p.description && <p className="mt-1 line-clamp-3 text-sm text-muted">{p.description}</p>}
        </button>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="tabular font-[family-name:var(--font-display)] text-xl font-extrabold">{money(p.price)}</span>
          <AddControl qty={qty} disabled={soldOut} onAdd={onAdd} onDec={onDec} />
        </div>
      </div>
    </article>
  );
}

export function PublicMenuView({ menu: initialMenu, tableCode }: { menu: PublicMenu; tableCode: string | null }) {
  const router = useRouter();
  const menu = useLiveMenu(initialMenu); // agotados, precios, fotos y marca en tiempo real
  const { tenant, settings } = menu;
  const cart = usePublicCart(tenant.slug);
  const lockedTable = tableCode ? menu.tables.find((t) => t.code === tableCode) : undefined;
  const [orderType, setOrderType] = useState<OrderType>(lockedTable ? "dine_in" : "takeaway");
  const [table, setTable] = useState<string>(lockedTable?.code ?? "");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeCat, setActiveCat] = useState(menu.categories[0]?.id ?? "");
  const [hydrated, setHydrated] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const accepting = settings.accept_qr_orders;
  const whatsapp = whatsappLink(settings.whatsapp, `Hola ${tenant.name}, vi su carta digital y tengo una consulta.`);
  // Cada carta es publicidad de MAFC: un dueño que la ve puede escribir directo
  const mafcWhatsapp = whatsappLink(MAFC_WHATSAPP, `Hola MAFC, vi la carta digital de ${tenant.name} y quiero MAFC Comanda para mi negocio.`);

  useEffect(() => setHydrated(true), []);

  // Si algo del carrito se agota o cambia de precio, el carrito se corrige solo
  const syncCart = cart.sync;
  useEffect(() => {
    if (!hydrated) return;
    const removed = syncCart(menu.products);
    if (removed.length) {
      toast.warning(removed.length === 1
        ? `${removed[0]} se agotó y lo quitamos de tu pedido`
        : `${removed.join(", ")} se agotaron y los quitamos de tu pedido`);
    }
  }, [menu.products, hydrated, syncCart]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const hasPhotos = useMemo(() => menu.products.some((p) => p.image_url), [menu.products]);
  const detail = detailId ? menu.products.find((p) => p.id === detailId) ?? null : null;

  const sections = useMemo(() => {
    const byCat = menu.categories
      .map((c) => ({ ...c, items: menu.products.filter((p) => p.category_id === c.id) }))
      .filter((c) => c.items.length);
    const loose = menu.products.filter((p) => !p.category_id || !menu.categories.some((c) => c.id === p.category_id));
    return loose.length ? [...byCat, { id: "otros", name: "Otros", items: loose }] : byCat;
  }, [menu]);

  // Scrollspy: resalta la categoría visible
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveCat(visible.target.id.replace("cat-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  const qty = (id: string) => cart.lines.find((l) => l.productId === id)?.quantity ?? 0;
  const addToCart = (p: Product) =>
    accepting ? cart.add({ id: p.id, name: p.name, price: p.price }) : toast.info("Pide este plato en caja 🙌");
  const count = hydrated ? cartCount(cart.lines) : 0;
  const total = cartTotal(cart.lines);
  const recent = hydrated ? cart.recent.filter((r) => Date.now() - r.at < 6 * 3600_000) : [];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (orderType === "dine_in" && !table) return toast.error("Elige tu mesa");
    if (orderType !== "dine_in" && !cart.name.trim()) return toast.error("Escribe tu nombre para llamarte");
    setSending(true);
    try {
      const res = await publicRepo.placeOrder(getSupabase(), {
        slug: tenant.slug,
        orderType,
        lines: cart.lines,
        tableCode: orderType === "dine_in" ? table : null,
        customerName: cart.name,
        customerPhone: cart.phone,
        notes,
      });
      cart.remember(res.tracking_token, res.ticket_number);
      cart.clear();
      router.push(`/carta/${tenant.slug}/pedido/${res.tracking_token}`);
    } catch (err) {
      toast.error(errorMessage(err, "No pudimos enviar tu pedido"));
      setSending(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-32">
      {/* Cabecera */}
      <header className="relative overflow-hidden bg-[#121212] px-5 pb-6 pt-5 text-[#eee8e0]">
        <div className="grain absolute inset-0 opacity-30" />
        <div className="relative flex items-start justify-between">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt={tenant.name} className="size-16 rounded-2xl bg-white object-cover shadow-lg" />
          ) : (
            <BrandMark className="size-16" />
          )}
          <ThemeToggle className="text-[#a1978c] hover:bg-white/10 hover:text-white" />
        </div>
        <h1 className="relative mt-4 text-3xl font-extrabold leading-tight">{tenant.name}</h1>
        {settings.welcome_message && <p className="relative mt-1.5 text-[#a1978c]">{settings.welcome_message}</p>}
        <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#a1978c]">
          {settings.address && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{settings.address}</span>}
          {settings.phone && <a href={`tel:${settings.phone}`} className="inline-flex items-center gap-1"><Phone className="size-4" />{settings.phone}</a>}
        </div>
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noreferrer"
            className="relative mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#25d366] px-4 text-sm font-bold text-[#06301a] shadow-lg shadow-black/20 active:scale-95">
            <MessageCircle className="size-4" /> Escríbenos por WhatsApp
          </a>
        )}
        {lockedTable && (
          <p className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-[#e07a4c] px-4 py-2 font-bold text-[#1a0d06]">
            <Utensils className="size-4" /> Estás en {lockedTable.label}
          </p>
        )}
      </header>

      {!accepting && (
        <p className="mx-4 mt-4 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          Por ahora no estamos recibiendo pedidos en línea. Puedes ver la carta y pedir en caja.
        </p>
      )}

      {recent.length > 0 && (
        <div className="mx-4 mt-4 space-y-2">
          {recent.map((r) => (
            <a key={r.token} href={`/carta/${tenant.slug}/pedido/${r.token}`}
              className="flex h-14 items-center gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-4 font-semibold">
              <Clock3 className="size-5 text-accent" /> Seguir mi pedido {ticketCode(r.ticket)}
              <ChevronRight className="ml-auto size-5 text-muted" />
            </a>
          ))}
        </div>
      )}

      {/* Categorías fijas */}
      <nav className="no-scrollbar sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        {sections.map((c) => (
          <button key={c.id}
            onClick={() => sectionRefs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors", activeCat === c.id ? "bg-ink text-bg" : "bg-surface-2 text-muted")}>
            {c.name}
          </button>
        ))}
      </nav>

      <main className="space-y-8 px-4 pt-5">
        {sections.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} ref={(el) => { sectionRefs.current[c.id] = el; }} className="scroll-mt-20">
            <h2 className="mb-3 text-2xl font-extrabold">{c.name}</h2>
            <div className="space-y-3">
              {c.items.map((p, i) => (
                <ProductRow key={p.id} p={p} qty={hydrated ? qty(p.id) : 0} placeholder={hasPhotos}
                  eager={sections[0]?.id === c.id && i < 3}
                  onOpen={() => setDetailId(p.id)}
                  onAdd={() => addToCart(p)}
                  onDec={() => cart.dec(p.id)} />
              ))}
            </div>
          </section>
        ))}
        {sections.length === 0 && <p className="py-16 text-center text-muted">La carta se está preparando. ¡Vuelve pronto!</p>}

        <footer className="flex flex-wrap justify-center gap-4 py-8 text-sm text-muted">
          {settings.instagram && <a className="inline-flex items-center gap-1" href={`https://instagram.com/${settings.instagram.replace("@", "")}`} target="_blank" rel="noreferrer"><AtSign className="size-4" />{settings.instagram}</a>}
          {settings.tiktok && <a href={`https://tiktok.com/@${settings.tiktok.replace("@", "")}`} target="_blank" rel="noreferrer">TikTok {settings.tiktok}</a>}
          {settings.facebook && <a href={settings.facebook.startsWith("http") ? settings.facebook : `https://${settings.facebook}`} target="_blank" rel="noreferrer">Facebook</a>}
          <div className="flex w-full flex-col items-center gap-1.5 border-t border-line pt-5 text-xs text-muted/80">
            <a href="/" target="_blank" className="inline-flex items-center gap-1.5 hover:text-ink">
              <BrandMark className="size-4" /> Hecho con <b className="font-bold">MAFC Comanda</b> · {MAFC_TAGLINE}
            </a>
            {mafcWhatsapp && (
              <a href={mafcWhatsapp} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold text-muted hover:border-[#25d366] hover:text-ink">
                <MessageCircle className="size-3.5 text-[#1fa855]" /> ¿Quieres una carta así para tu negocio? Escríbenos
              </a>
            )}
          </div>
        </footer>
      </main>

      {/* Barra del carrito */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl px-4 pb-safe">
          <button onClick={() => setOpen(true)}
            className="flex h-16 w-full items-center justify-between rounded-2xl bg-accent px-5 text-accent-ink shadow-2xl shadow-accent/30 animate-slide-up">
            <span className="flex items-center gap-3">
              <span key={count} className="grid size-9 animate-pop place-items-center rounded-full bg-accent-ink font-extrabold text-accent">{count}</span>
              <span className="font-bold">Ver mi pedido</span>
            </span>
            <span className="tabular text-lg font-extrabold">{money(total)}</span>
          </button>
        </div>
      )}

      {/* Detalle del plato con foto grande */}
      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetailId(null)}>
        {detail && (
          <DialogContent title={detail.name}>
            <div className="space-y-4 pb-5">
              {detail.image_url && (
                <ProductImage key={detail.image_url} src={detail.image_url} name={detail.name} soldOut={!detail.is_available} eager
                  className="aspect-[4/3] w-full rounded-2xl" />
              )}
              {detail.description && <p className="text-muted">{detail.description}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(detail.price)}</span>
                <AddControl qty={hydrated ? qty(detail.id) : 0} disabled={!detail.is_available}
                  onAdd={() => addToCart(detail)} onDec={() => cart.dec(detail.id)} />
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Tu pedido" description={tenant.name}>
          <form onSubmit={send} className="space-y-4 pb-4">
            <ul className="divide-y divide-line">
              {cart.lines.map((l) => (
                <li key={l.key} className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{l.name}</p>
                      <p className="tabular text-sm text-muted">{money(l.unitPrice * l.quantity)}</p>
                    </div>
                    <AddControl qty={l.quantity} disabled={false} onAdd={() => cart.add({ id: l.productId, name: l.name, price: l.unitPrice })} onDec={() => cart.dec(l.productId)} />
                  </div>
                  <input value={l.notes ?? ""} maxLength={140} onChange={(e) => cart.setNote(l.productId, e.target.value)}
                    placeholder="¿Algún detalle? (sin ají, sin cebolla…)" className="mt-2 h-10 w-full rounded-xl bg-surface-2 px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                </li>
              ))}
            </ul>

            {!lockedTable && (
              <Segmented<OrderType>
                value={orderType}
                onChange={setOrderType}
                options={[
                  { value: "takeaway", label: "Para llevar", icon: <ShoppingBag /> },
                  ...(menu.tables.length ? [{ value: "dine_in" as const, label: "En mesa", icon: <Utensils /> }] : []),
                  { value: "delivery", label: "Delivery", icon: <Bike /> },
                ]}
              />
            )}
            {orderType === "dine_in" && !lockedTable && (
              <Field label="¿En qué mesa estás?">
                <Select required value={table} onChange={(e) => setTable(e.target.value)}>
                  <option value="">Elige tu mesa</option>
                  {menu.tables.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </Select>
              </Field>
            )}
            {orderType !== "dine_in" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tu nombre"><Input required maxLength={60} value={cart.name} onChange={(e) => cart.setContact({ name: e.target.value })} autoComplete="given-name" /></Field>
                <Field label="Celular (opcional)"><Input type="tel" maxLength={20} value={cart.phone} onChange={(e) => cart.setContact({ phone: e.target.value })} autoComplete="tel" /></Field>
              </div>
            )}
            <Field label={orderType === "delivery" ? "Dirección y referencia" : "Comentario"}>
              <Textarea required={orderType === "delivery"} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
            </Field>

            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-muted">Total</span>
              <span className="tabular font-[family-name:var(--font-display)] text-3xl font-extrabold">{money(total)}</span>
            </div>
            <Button type="submit" size="xl" className="w-full" disabled={sending || cart.lines.length === 0}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />} Enviar pedido
            </Button>
            <p className="text-center text-xs text-muted">Pagas en caja o con Yape/Plin. Verás el estado de tu pedido en vivo.</p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
