"use client";

import { errorMessage } from "@/core/lib/cn";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OrderStatus, OrderWithItems, PaymentMethod } from "@/core/domain/types";
import { STATUS_LABEL, ticketCode } from "@/core/domain/order-rules";
import { ordersRepo } from "@/infrastructure/repositories/orders.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

export const ORDERS_KEY = ["orders", "board"] as const;

export function useBoardOrders() {
  return useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersRepo.listBoard(getSupabase()),
    refetchInterval: 60_000, // red de seguridad si el WebSocket se corta
    staleTime: 5_000,
  });
}

/** Cambia el estado con actualización optimista: la UI responde al instante. */
export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      ordersRepo.setStatus(getSupabase(), id, status, reason),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ORDERS_KEY });
      const prev = qc.getQueryData<OrderWithItems[]>(ORDERS_KEY);
      qc.setQueryData<OrderWithItems[]>(ORDERS_KEY, (old) =>
        old?.map((o) =>
          o.id === id
            ? {
                ...o,
                status,
                started_at: status === "preparing" ? new Date().toISOString() : o.started_at,
                ready_at: status === "ready" ? new Date().toISOString() : o.ready_at,
              }
            : o,
        ),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ORDERS_KEY, ctx.prev);
      toast.error(errorMessage(err, "No se pudo actualizar"));
    },
    onSuccess: (_d, v) => {
      const o = qc.getQueryData<OrderWithItems[]>(ORDERS_KEY)?.find((x) => x.id === v.id);
      if (o) toast.success(`${ticketCode(o.ticket_number)} → ${STATUS_LABEL[v.status]}`, { duration: 1500 });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
}

export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { order: OrderWithItems; method: PaymentMethod; received?: number; close?: boolean }) =>
      ordersRepo.registerPayment(getSupabase(), v.order, v.method, v.received, v.close),
    onSuccess: () => toast.success("Pago registrado"),
    onError: (err) => toast.error(errorMessage(err, "No se pudo registrar el pago")),
    onSettled: () => qc.invalidateQueries({ queryKey: ORDERS_KEY }),
  });
}

export type LiveState = "connecting" | "live" | "offline";

/**
 * Puente Realtime: escucha INSERT/UPDATE de orders y order_items del negocio
 * por WebSocket y refresca la caché de React Query (con debounce).
 */
export function useOrdersRealtime(tenantId: string, onNewOrder?: (o: { id: string; source: string; ticket_number: number }) => void) {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");
  const cbRef = useRef(onNewOrder);
  cbRef.current = onNewOrder;

  useEffect(() => {
    const sb = getSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ORDERS_KEY });
        // El cuadre de caja sólo se vuelve a pedir si su pantalla está abierta
        void qc.invalidateQueries({ queryKey: ["cash", "current"] });
      }, 200);
    };

    const channel = sb
      .channel(`tenant-orders-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const n = payload.new as { id: string; source: string; ticket_number: number };
          cbRef.current?.(n);
        }
        invalidate();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `tenant_id=eq.${tenantId}` }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products", filter: `tenant_id=eq.${tenantId}` }, () =>
        qc.invalidateQueries({ queryKey: ["catalog"] }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setState("live");
          invalidate(); // al reconectar, sincroniza lo que se perdió
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setState("offline");
        }
      });

    const goOffline = () => setState("offline");
    window.addEventListener("offline", goOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", goOffline);
      sb.removeChannel(channel);
    };
  }, [tenantId, qc]);

  return state;
}

// Bus de eventos de "nuevo pedido" (el canal Realtime vive una sola vez en el shell)
type NewOrderEvent = { id: string; source: string; ticket_number: number };
const bus = typeof window !== "undefined" ? new EventTarget() : null;

export function emitNewOrder(o: NewOrderEvent) {
  bus?.dispatchEvent(new CustomEvent<NewOrderEvent>("new-order", { detail: o }));
}

export function useOnNewOrder(handler: (o: NewOrderEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<NewOrderEvent>).detail);
    bus?.addEventListener("new-order", fn);
    return () => bus?.removeEventListener("new-order", fn);
  }, []);
}
