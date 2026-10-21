"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogRepo } from "@/infrastructure/repositories/catalog.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

export function useCategories() {
  return useQuery({ queryKey: ["catalog", "categories"], queryFn: () => catalogRepo.categories(getSupabase()), staleTime: 5 * 60_000 });
}

export function useProducts() {
  return useQuery({ queryKey: ["catalog", "products"], queryFn: () => catalogRepo.products(getSupabase()), staleTime: 5 * 60_000 });
}

export function useTables() {
  return useQuery({ queryKey: ["catalog", "tables"], queryFn: () => catalogRepo.tables(getSupabase()), staleTime: 5 * 60_000 });
}
