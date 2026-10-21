"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/core/domain/types";

interface PublicCartState {
  lines: CartLine[];
  name: string;
  phone: string;
  /** Pedidos enviados desde este celular, para volver a su seguimiento. */
  recent: { token: string; ticket: number; at: number }[];
  add: (p: { id: string; name: string; price: number }) => void;
  dec: (productId: string) => void;
  setNote: (productId: string, notes: string) => void;
  setContact: (patch: Partial<{ name: string; phone: string }>) => void;
  remember: (token: string, ticket: number) => void;
  clear: () => void;
  /** Alinea el carrito con la carta en vivo. Devuelve los nombres que se quitaron por agotados. */
  sync: (products: { id: string; name: string; price: number; is_available: boolean }[]) => string[];
}

const stores = new Map<string, ReturnType<typeof makeStore>>();

function makeStore(slug: string) {
  return create<PublicCartState>()(
    persist(
      (set, get) => ({
        lines: [],
        name: "",
        phone: "",
        recent: [],
        add: (p) =>
          set((s) => {
            const ex = s.lines.find((l) => l.productId === p.id);
            if (ex) return { lines: s.lines.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(l.quantity + 1, 30) } : l)) };
            return { lines: [...s.lines, { key: p.id, productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }] };
          }),
        dec: (productId) =>
          set((s) => ({
            lines: s.lines.flatMap((l) => (l.productId !== productId ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : [])),
          })),
        setNote: (productId, notes) => set((s) => ({ lines: s.lines.map((l) => (l.productId === productId ? { ...l, notes } : l)) })),
        setContact: (patch) => set(patch),
        remember: (token, ticket) =>
          set((s) => ({ recent: [{ token, ticket, at: Date.now() }, ...s.recent.filter((r) => Date.now() - r.at < 12 * 3600_000)].slice(0, 5) })),
        clear: () => set({ lines: [] }),
        sync: (products) => {
          const byId = new Map(products.map((p) => [p.id, p]));
          const removed: string[] = [];
          let changed = false;
          const lines = get().lines.flatMap((l) => {
            const p = byId.get(l.productId);
            if (!p || !p.is_available) {
              removed.push(l.name);
              changed = true;
              return [];
            }
            if (p.price !== l.unitPrice || p.name !== l.name) {
              changed = true;
              return [{ ...l, unitPrice: p.price, name: p.name }];
            }
            return [l];
          });
          if (changed) set({ lines });
          return removed;
        },
      }),
      { name: `comandaya-carta-${slug}`, version: 1 }, // clave histórica: renombrarla vaciaría carritos abiertos
    ),
  );
}

export function usePublicCart(slug: string) {
  let store = stores.get(slug);
  if (!store) {
    store = makeStore(slug);
    stores.set(slug, store);
  }
  return store();
}
