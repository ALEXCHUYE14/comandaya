"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let browserClient: SupabaseClient | null = null;

/** Cliente único del navegador (comparte la conexión WebSocket de Realtime). */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      SUPABASE_URL || "http://localhost:54321",
      SUPABASE_ANON_KEY || "public-anon-key",
    );
  }
  return browserClient;
}
