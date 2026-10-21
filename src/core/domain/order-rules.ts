import type { AppRole, CartLine, OrderStatus, OrderType, PaymentMethod } from "./types";

// ---------------------------------------------------------------------------
// Máquina de estados del pedido
//   pending → preparing → ready → closed
//   (cualquiera salvo closed) → cancelled
// ---------------------------------------------------------------------------

export const STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "ready", "closed"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En espera",
  preparing: "En preparación",
  ready: "Listo para entrega",
  closed: "Cerrado",
  cancelled: "Anulado",
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Mesa",
  takeaway: "Para llevar",
  delivery: "Delivery",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  yape: "Yape",
  plin: "Plin",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  cashier: "Caja",
  waiter: "Mozo",
  kitchen: "Cocina",
};

export function nextStatus(current: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(current);
  if (i === -1 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1] ?? null;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "closed" || from === "cancelled") return false;
  if (to === "cancelled") return true;
  return STATUS_FLOW.indexOf(to) > STATUS_FLOW.indexOf(from);
}

/** Texto amable para el cliente en la pantalla de seguimiento. */
export function customerStatusMessage(status: OrderStatus, type: OrderType): string {
  switch (status) {
    case "pending":
      return "Recibimos tu pedido, en un momento entra a cocina…";
    case "preparing":
      return "Tu pedido se está preparando…";
    case "ready":
      return type === "dine_in"
        ? "¡Tu pedido está listo para ser servido!"
        : type === "delivery"
          ? "¡Tu pedido está listo para ser repartido!"
          : "¡Tu pedido está listo! Acércate a recogerlo.";
    case "closed":
      return "Pedido entregado. ¡Buen provecho!";
    case "cancelled":
      return "Este pedido fue anulado. Consulta en caja.";
  }
}

// ---------------------------------------------------------------------------
// Dinero (soles) — se trabaja en céntimos para evitar errores de coma flotante
// ---------------------------------------------------------------------------

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;

export function cartTotal(lines: CartLine[]): number {
  return fromCents(lines.reduce((acc, l) => acc + toCents(l.unitPrice) * l.quantity, 0));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.quantity, 0);
}

export function computeChange(total: number, received: number): number {
  return fromCents(Math.max(toCents(received) - toCents(total), 0));
}

/** Billetes sugeridos para cobro rápido en efectivo. */
export function quickCashOptions(total: number): number[] {
  const bills = [10, 20, 50, 100, 200];
  const exact = Math.ceil(total * 10) / 10;
  const options = new Set<number>([exact]);
  for (const b of bills) {
    if (b >= total) options.add(b);
    const rounded = Math.ceil(total / b) * b;
    if (rounded >= total && rounded <= 200) options.add(rounded);
  }
  return [...options].sort((a, b) => a - b).slice(0, 5);
}

const formatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export const money = (n: number | string | null | undefined) =>
  formatter.format(Number(n ?? 0)).replace("PEN", "S/");

export const ticketCode = (n: number) => `#${String(n).padStart(3, "0")}`;

// ---------------------------------------------------------------------------
// Tiempos del KDS: verde < 5 min, ámbar 5–10 min, rojo > 10 min
// ---------------------------------------------------------------------------

export type Urgency = "ok" | "warn" | "late";

export function urgencyFor(minutes: number): Urgency {
  if (minutes < 5) return "ok";
  if (minutes < 10) return "warn";
  return "late";
}

export function elapsedMinutes(fromIso: string, now = Date.now()): number {
  if (!now) return 0;
  return Math.max(0, (now - new Date(fromIso).getTime()) / 60000);
}

export function formatElapsed(fromIso: string, now = Date.now()): string {
  if (!now) return "--:--";
  const total = Math.floor(Math.max(0, now - new Date(fromIso).getTime()) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Permisos de la interfaz (la base de datos los vuelve a validar)
// ---------------------------------------------------------------------------

export const can = {
  sell: (r: AppRole) => ["owner", "admin", "cashier", "waiter"].includes(r),
  charge: (r: AppRole) => ["owner", "admin", "cashier"].includes(r),
  kitchen: (r: AppRole) => ["owner", "admin", "kitchen", "cashier"].includes(r),
  manage: (r: AppRole) => ["owner", "admin"].includes(r),
};

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Enlace de WhatsApp a partir del número que escribió el negocio.
 * "987 654 321" → https://wa.me/51987654321 (celular peruano sin código de país).
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = `51${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Iniciales para productos sin foto: "1/4 Broaster" → "BR", "Ceviche mixto" → "CM". */
export function initials(name: string): string {
  const words = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((w) => /^[a-z]/i.test(w));
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? name).slice(0, 2).toUpperCase();
}
