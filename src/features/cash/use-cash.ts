"use client";

import { useQuery } from "@tanstack/react-query";
import { cashRepo } from "@/infrastructure/repositories/cash.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

/** Se invalida desde useOrdersRealtime: cada cobro actualiza el cuadre en vivo. */
export const CASH_KEY = ["cash"] as const;

export function useCashCurrent(enabled = true) {
  return useQuery({
    queryKey: [...CASH_KEY, "current"],
    queryFn: () => cashRepo.current(getSupabase()),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Sólo "¿hay caja abierta?" para el aviso de la pantalla de venta. Clave propia para que
 * los cobros en vivo no la vuelvan a pedir; abrir/cerrar caja la invalida (prefijo CASH_KEY).
 */
export function useCashIsOpen(enabled = true) {
  return useQuery({
    queryKey: [...CASH_KEY, "status"],
    queryFn: async () => (await cashRepo.current(getSupabase())) !== null,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useCashHistory(enabled = true) {
  return useQuery({
    queryKey: [...CASH_KEY, "history"],
    queryFn: () => cashRepo.history(getSupabase()),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
