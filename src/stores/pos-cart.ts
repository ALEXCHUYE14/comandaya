"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, OrderType } from "@/core/domain/types";

interface PosCartState {
  lines: CartLine[];
  orderType: OrderType;
  tableId: string | null;
  customerName: string;
  notes: string;
  add: (p: { id: string; name: string; price: number }) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  setNote: (key: string, note: string) => void;
  set: (patch: Partial<Pick<PosCartState, "orderType" | "tableId" | "customerName" | "notes">>) => void;
  clear: () => void;
}

/**
 * Carrito de caja persistido en localStorage: si se recarga la página o se
 * cae el internet a mitad de la toma de pedido, nada se pierde.
 */
export const usePosCart = create<PosCartState>()(
  persist(
    (set) => ({
      lines: [],
      orderType: "takeaway",
      tableId: null,
      customerName: "",
      notes: "",
      add: (p) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === p.id && !l.notes);
          if (existing) {
            return { lines: s.lines.map((l) => (l.key === existing.key ? { ...l, quantity: Math.min(l.quantity + 1, 99) } : l)) };
          }
          return {
            lines: [...s.lines, { key: crypto.randomUUID(), productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 }],
          };
        }),
      inc: (key) => set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + 1, 99) } : l)) })),
      dec: (key) =>
        set((s) => ({
          lines: s.lines.flatMap((l) => (l.key !== key ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : [])),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      setNote: (key, note) => set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, notes: note } : l)) })),
      set: (patch) => set(patch),
      clear: () => set({ lines: [], customerName: "", notes: "", tableId: null }),
    }),
    { name: "comandaya-pos-cart", version: 1 }, // clave histórica: renombrarla vaciaría carritos abiertos
  ),
);
