"use client";

import { useEffect, useState } from "react";
import type { PublicMenu } from "@/core/domain/types";
import { publicRepo } from "@/infrastructure/repositories/public.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

type PublicProduct = PublicMenu["products"][number];
/** Payload del trigger tg_menu_broadcast (evento "product"). */
type ProductEvent = PublicProduct & { is_active: boolean; sort_order: number };

function applyProductChange(menu: PublicMenu, e: ProductEvent): PublicMenu {
  const product: PublicProduct = {
    id: e.id,
    category_id: e.category_id,
    name: e.name,
    description: e.description,
    price: Number(e.price),
    image_url: e.image_url,
    is_available: e.is_available,
  };
  const exists = menu.products.some((p) => p.id === e.id);
  const products = !e.is_active
    ? menu.products.filter((p) => p.id !== e.id)
    : exists
      ? menu.products.map((p) => (p.id === e.id ? product : p))
      : [...menu.products, product];
  return { ...menu, products };
}

/**
 * Carta en vivo: escucha el canal Broadcast "menu:<tenant_id>".
 * - "product": aplica el cambio del producto sin pedir nada al servidor.
 * - "refresh": cambió la marca/categorías/mesas → una sola llamada a get_public_menu.
 * Sin WebSocket, refresca cada 2 min sólo con la pestaña visible.
 */
export function useLiveMenu(initial: PublicMenu): PublicMenu {
  const [menu, setMenu] = useState(initial);
  const { id: tenantId, slug } = initial.tenant;

  useEffect(() => {
    const sb = getSupabase();
    let live = false;
    let disposed = false;
    let lastFetch = Date.now(); // el servidor acaba de entregar la carta
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        lastFetch = Date.now();
        try {
          const fresh = await publicRepo.menu(sb, slug);
          if (fresh && !disposed) setMenu(fresh);
        } catch {
          // Sin red: la siguiente señal o el sondeo lo reintentan
        }
      }, 400); // agrupa ráfagas (p. ej. guardar varios ajustes a la vez)
    };

    const channel = sb
      .channel(`menu:${tenantId}`)
      .on("broadcast", { event: "product" }, ({ payload }) => {
        if (payload && typeof payload === "object" && "id" in payload) {
          setMenu((m) => applyProductChange(m, payload as ProductEvent));
        }
      })
      .on("broadcast", { event: "refresh" }, refetch)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          live = true;
          // Al reconectar (celular en segundo plano, señal débil) recupera lo perdido
          if (Date.now() - lastFetch > 15_000) refetch();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          live = false;
        }
      });

    const poll = setInterval(() => {
      if (!live && document.visibilityState === "visible") refetch();
    }, 120_000);

    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [tenantId, slug]);

  return menu;
}
