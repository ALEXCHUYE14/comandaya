import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

let adminClient: SupabaseClient | null = null;

/**
 * Cliente con la clave secreta de Supabase (service_role). SÓLO servidor: se usa para
 * confirmar pagos verificados con Mercado Pago. Nunca se expone al navegador.
 */
export function getAdminSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor");
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return adminClient;
}
