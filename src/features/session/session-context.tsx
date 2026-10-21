"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { BusinessSettings, MySubscription, Tenant, UserProfile } from "@/core/domain/types";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

export interface SessionValue {
  profile: UserProfile;
  tenant: Tenant;
  settings: BusinessSettings;
  /** Plan MAFC (null si la base aún no tiene planes). */
  subscription?: MySubscription | null;
}

interface Ctx extends SessionValue {
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ initial, children }: { initial: SessionValue; children: React.ReactNode }) {
  const [value, setValue] = useState(initial);

  // router.refresh() (p. ej. tras pagar el plan) trae una suscripción nueva desde el servidor
  const freshSubscription = initial.subscription;
  useEffect(() => {
    setValue((v) => (v.subscription === freshSubscription ? v : { ...v, subscription: freshSubscription }));
  }, [freshSubscription]);

  const refresh = useCallback(async () => {
    const ctx = await businessRepo.context(getSupabase(), value.profile.id);
    if (ctx.tenant && ctx.settings && ctx.profile) {
      // Conserva la suscripción: refresh sólo recarga negocio y ajustes
      setValue((v) => ({ ...v, profile: ctx.profile!, tenant: ctx.tenant!, settings: ctx.settings! }));
    }
  }, [value.profile.id]);

  return <SessionContext.Provider value={{ ...value, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
