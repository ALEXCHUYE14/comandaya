"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Lock, Printer, ShoppingBasket, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { OrderWithItems, Product } from "@/core/domain/types";
import { can, cartCount, cartTotal, money, ticketCode } from "@/core/domain/order-rules";
import { cn, errorMessage } from "@/core/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/empty";
import { useCashIsOpen } from "@/features/cash/use-cash";
import { OrdersBoard } from "@/features/orders/orders-board";
import { useCategories, useProducts, useTables } from "@/features/orders/use-catalog";
import { ORDERS_KEY, useBoardOrders } from "@/features/orders/use-orders";
import { useSession } from "@/features/session/session-context";
import { ordersRepo } from "@/infrastructure/repositories/orders.repo";
import { getSupabase } from "@/infrastructure/supabase/client";
import { usePosCart } from "@/stores/pos-cart";
import { CartPanel } from "./cart-panel";
import { PaymentDialog } from "./payment-dialog";
import { printTicket } from "./print-ticket";
import { ProductPicker } from "./product-picker";

export function PosScreen() {
  const { profile, tenant, settings } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    if (profile.role === "kitchen") router.replace("/cocina");
  }, [profile.role, router]);
  const cart = usePosCart();
  const categories = useCategories();
  const products = useProducts();
  const tables = useTables();
  const orders = useBoardOrders();

  const [tab, setTab] = useState<"sell" | "orders">(can.sell(profile.role) ? "sell" : "orders");
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Aviso de caja cerrada: si la base aún no tiene las RPC de caja, no se muestra nada
  const cashOpen = useCashIsOpen(can.charge(profile.role));
  const cashClosed = cashOpen.isSuccess && cashOpen.data === false;
  const board = orders.data ?? [];
  const openOrders = board.filter((o) => o.status !== "closed" && o.status !== "cancelled");
  // Siempre leemos el pedido desde la caché para reflejar cambios en tiempo real
  const charging = board.find((o) => o.id === chargeId) ?? null;
  const created = board.find((o) => o.id === createdId) ?? null;

  const quantities = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of cart.lines) m[l.productId] = (m[l.productId] ?? 0) + l.quantity;
    return m;
  }, [cart.lines]);

  function add(p: Product) {
    cart.add({ id: p.id, name: p.name, price: p.price });
  }

  async function submit({ charge, appendTo }: { charge: boolean; appendTo: OrderWithItems | null }) {
    setSubmitting(true);
    const sb = getSupabase();
    try {
      let orderId: string;
      if (appendTo) {
        await ordersRepo.addItems(sb, appendTo, cart.lines);
        if (appendTo.status === "ready") await ordersRepo.setStatus(sb, appendTo.id, "preparing");
        orderId = appendTo.id;
        toast.success(`Agregado a ${ticketCode(appendTo.ticket_number)}`);
      } else {
        const order = await ordersRepo.create(sb, {
          orderType: cart.orderType,
          lines: cart.lines,
          tableId: cart.tableId,
          customerName: cart.customerName,
          notes: cart.notes,
        });
        orderId = order.id;
      }
      cart.clear();
      setCartOpen(false);
      await qc.refetchQueries({ queryKey: ORDERS_KEY });
      if (charge) setChargeId(orderId);
      else if (!appendTo) setCreatedId(orderId);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo registrar el pedido"));
    } finally {
      setSubmitting(false);
    }
  }

  const count = cartCount(cart.lines);
  const loading = products.isLoading || categories.isLoading;

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-16 z-20 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:top-0 md:px-6 md:pr-36">
        <div className="flex gap-1 rounded-2xl bg-surface-2 p-1 sm:w-fit">
          {can.sell(profile.role) && (
            <button onClick={() => setTab("sell")}
              className={cn("flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-muted sm:flex-none", tab === "sell" && "bg-surface text-ink shadow-sm")}>
              <ShoppingBasket className="size-4" /> Nueva venta
            </button>
          )}
          <button onClick={() => setTab("orders")}
            className={cn("flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-muted sm:flex-none", tab === "orders" && "bg-surface text-ink shadow-sm")}>
            <ClipboardList className="size-4" /> Pedidos
            {openOrders.length > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-ink">{openOrders.length}</span>}
          </button>
        </div>
        {cashClosed && (
          <Link href="/cuadre" className="mt-2 flex items-center gap-2 rounded-xl bg-amber-soft px-3 py-2 text-sm font-semibold text-amber sm:w-fit">
            <Lock className="size-4 shrink-0" /> La caja está cerrada: los cobros no entran a ningún turno. <span className="underline">Abrir caja</span>
          </Link>
        )}
      </div>

      {tab === "sell" ? (
        <div className="flex flex-1 gap-6 px-4 py-4 md:px-6">
          <div className="min-w-0 flex-1 pb-24 lg:pb-4">
            {loading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : (
              <ProductPicker categories={categories.data ?? []} products={products.data ?? []} quantities={quantities} onAdd={add} />
            )}
          </div>
          {/* Carrito fijo en tablet horizontal / escritorio */}
          <aside className="sticky top-[88px] hidden h-[calc(100dvh-112px)] w-[380px] shrink-0 rounded-3xl border border-line bg-surface p-4 lg:flex md:top-[84px]">
            <CartPanel className="w-full" tables={tables.data ?? []} openOrders={openOrders} submitting={submitting} onSubmit={submit} />
          </aside>
        </div>
      ) : (
        <div className="px-4 py-4 md:px-6">
          {orders.isLoading ? <Skeleton className="h-64" /> : <OrdersBoard orders={board} onCharge={(o) => setChargeId(o.id)} />}
        </div>
      )}

      {/* Barra flotante del carrito en móvil */}
      {tab === "sell" && count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-[84px] z-30 flex h-16 items-center justify-between rounded-2xl bg-ink px-5 text-bg shadow-2xl animate-slide-up md:bottom-6 md:left-[112px] lg:hidden"
        >
          <span className="flex items-center gap-3">
            <span key={count} className="grid size-9 animate-pop place-items-center rounded-full bg-accent font-extrabold text-accent-ink">{count}</span>
            <span className="font-bold">Ver pedido</span>
          </span>
          <span className="tabular text-lg font-extrabold">{money(cartTotal(cart.lines))}</span>
        </button>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title="Pedido actual" className="h-[92dvh] sm:h-[85dvh]">
          <CartPanel className="h-full pb-2" tables={tables.data ?? []} openOrders={openOrders} submitting={submitting} onSubmit={submit} />
        </DialogContent>
      </Dialog>

      <PaymentDialog order={charging} open={Boolean(chargeId)} onOpenChange={(v) => !v && setChargeId(null)} />

      {/* Confirmación con token de llamado */}
      <Dialog open={Boolean(createdId)} onOpenChange={(v) => !v && setCreatedId(null)}>
        <DialogContent title="Pedido enviado a cocina">
          {created && (
            <div className="space-y-4 pb-4 text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted">Token de llamado</p>
              <p className="font-mono text-7xl font-extrabold text-accent">{ticketCode(created.ticket_number)}</p>
              <p className="text-muted">{created.table?.label ?? created.customer_name ?? "Para llevar"} · {money(created.total)}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" onClick={() => printTicket(created, tenant, settings)}><Printer /> Ticket</Button>
                <Button variant="outline" size="lg" onClick={() => printTicket(created, tenant, settings, "kitchen")}><Printer /> Comanda</Button>
              </div>
              {can.charge(profile.role) && (
                <Button size="lg" className="w-full" onClick={() => { setChargeId(created.id); setCreatedId(null); }}>
                  <Wallet /> Cobrar ahora
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
