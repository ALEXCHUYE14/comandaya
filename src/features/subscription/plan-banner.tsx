"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, TriangleAlert } from "lucide-react";
import { can } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";
import { useSession } from "@/features/session/session-context";
import { longDate } from "./pay-instructions";

/** Aviso de prueba o vencimiento. Sólo lo ven dueño y administrador; nunca bloquea la venta. */
export function PlanBanner() {
  const { profile, subscription: s } = useSession();
  const pathname = usePathname();
  if (!s || !can.manage(profile.role) || pathname.startsWith("/plan")) return null;

  let tone: "info" | "warn" | "danger";
  let text: string;
  if (s.state === "trial") {
    tone = s.days_left <= 2 ? "warn" : "info";
    text = s.days_left <= 0 ? "Tu prueba gratis termina hoy." : `Prueba gratis: te ${s.days_left === 1 ? "queda 1 día" : `quedan ${s.days_left} días`}.`;
  } else if (s.state === "grace") {
    tone = "danger";
    text = `Tu plan venció. Paga antes del ${longDate(s.grace_end)} para no perder el acceso.`;
  } else if (s.state === "active" && s.days_left <= 3) {
    tone = "warn";
    text = s.days_left <= 0 ? "Tu plan vence hoy." : `Tu plan vence en ${s.days_left === 1 ? "1 día" : `${s.days_left} días`}.`;
  } else {
    return null;
  }

  return (
    <Link
      href="/plan"
      className={cn(
        "no-print flex items-center gap-2 px-4 py-2 text-sm font-semibold md:pr-36",
        tone === "info" && "bg-accent/10 text-accent",
        tone === "warn" && "bg-amber-soft text-amber",
        tone === "danger" && "bg-danger-soft text-danger",
      )}
    >
      {tone === "info" ? <Clock3 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1">{text}</span>
      <span className="shrink-0 underline">{s.state === "trial" ? "Ver plan" : "Pagar ahora"}</span>
    </Link>
  );
}
