"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Calculator,
  ChefHat,
  LayoutGrid,
  LogOut,
  QrCode,
  Settings2,
  ShoppingBasket,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { can, ROLE_LABEL, ticketCode } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { unlockAudio } from "@/core/lib/sound";
import { emitNewOrder, useOrdersRealtime, type LiveState } from "@/features/orders/use-orders";
import { useSession } from "@/features/session/session-context";
import { PlanBanner } from "@/features/subscription/plan-banner";
import { getSupabase } from "@/infrastructure/supabase/client";
import type { AppRole } from "@/core/domain/types";

/** short: etiqueta de la barra inferior móvil (hasta 7 ítems en 360 px). */
const NAV: { href: string; label: string; short?: string; icon: React.ElementType; allow: (r: AppRole) => boolean }[] = [
  { href: "/pos", label: "Caja", icon: ShoppingBasket, allow: can.sell },
  { href: "/cuadre", label: "Cuadre de caja", short: "Cuadre", icon: Calculator, allow: can.charge },
  { href: "/cocina", label: "Cocina", icon: ChefHat, allow: can.kitchen },
  { href: "/reportes", label: "Reportes", icon: BarChart3, allow: can.manage },
  { href: "/catalogo", label: "Carta", icon: LayoutGrid, allow: can.manage },
  { href: "/mesas", label: "Mesas y QR", short: "Mesas", icon: QrCode, allow: can.manage },
  { href: "/ajustes", label: "Ajustes", icon: Settings2, allow: can.manage },
];

function LiveDot({ state }: { state: LiveState }) {
  const label = state === "live" ? "En vivo" : state === "offline" ? "Sin conexión" : "Conectando";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        state === "live" && "bg-olive-soft text-olive",
        state === "offline" && "bg-danger-soft text-danger",
        state === "connecting" && "bg-amber-soft text-amber",
      )}
    >
      {state === "offline" ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, tenant, settings } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const nav = NAV.filter((n) => n.allow(profile.role));

  const live = useOrdersRealtime(tenant.id, (o) => {
    emitNewOrder(o);
    if (o.source === "qr" && !pathname.startsWith("/cocina")) {
      toast.info(`Nuevo pedido desde la carta QR ${ticketCode(o.ticket_number)}`);
    }
  });

  // Desbloquea el audio en el primer toque (requisito de los navegadores)
  useEffect(() => {
    const fn = () => unlockAudio();
    window.addEventListener("pointerdown", fn, { once: true });
    return () => window.removeEventListener("pointerdown", fn);
  }, []);

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* Barra lateral (tablet/escritorio) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center gap-2 border-r border-line bg-surface py-4 md:flex xl:w-60 xl:items-stretch xl:px-3">
        <Link href="/pos" className="mb-4 flex items-center gap-2.5 xl:px-2">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="" className="size-10 rounded-xl object-cover" />
          ) : (
            <BrandMark className="size-10" />
          )}
          <span className="hidden min-w-0 xl:block">
            <span className="block truncate font-[family-name:var(--font-display)] font-bold leading-tight">{tenant.name}</span>
            <span className="text-xs text-muted">{ROLE_LABEL[profile.role]}</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "group flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink xl:h-12 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-[15px]",
                  active && "bg-accent/10 text-accent hover:bg-accent/15 hover:text-accent",
                )}
              >
                <n.icon className="size-[22px] xl:size-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col items-center gap-1 xl:flex-row xl:justify-between">
          <ThemeToggle />
          <button onClick={logout} aria-label="Cerrar sesión" className="grid size-12 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-danger">
            <LogOut className="size-5" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabecera móvil */}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="" className="size-9 rounded-xl object-cover" />
            ) : (
              <BrandMark />
            )}
            <span className="truncate font-[family-name:var(--font-display)] font-bold">{tenant.name}</span>
          </div>
          <div className="flex items-center">
            <LiveDot state={live} />
            <ThemeToggle />
            <button onClick={logout} aria-label="Cerrar sesión" className="grid size-12 place-items-center rounded-xl text-muted">
              <LogOut className="size-5" />
            </button>
          </div>
        </header>
        <div className="no-print absolute right-5 top-4 z-30 hidden md:block">
          <LiveDot state={live} />
        </div>

        <PlanBanner />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>

        {/* Navegación inferior (móvil, alcance del pulgar) */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 pb-safe pt-1 backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={cn("flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold text-muted", active && "text-accent")}>
                <n.icon className="size-6 shrink-0" />
                <span className="max-w-full truncate">{n.short ?? n.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
