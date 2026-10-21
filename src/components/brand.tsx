import { cn } from "@/core/lib/cn";

/**
 * Marca MAFC: cuatro bloques que encajan (software a medida).
 * Cada producto de la familia MAFC cambia sólo el 4.º bloque; en Comanda es un ticket.
 * Mantener sincronizado con public/icon.svg, public/icon-maskable.svg y src/app/icon.svg.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--accent)" />
      <rect x="7.5" y="7.5" width="11" height="11" rx="2.5" fill="var(--accent-ink)" />
      <rect x="21.5" y="7.5" width="11" height="11" rx="2.5" fill="var(--accent-ink)" opacity=".72" />
      <rect x="7.5" y="21.5" width="11" height="11" rx="2.5" fill="var(--accent-ink)" opacity=".72" />
      <path d="M21.5 24a2.5 2.5 0 0 1 2.5-2.5h6a2.5 2.5 0 0 1 2.5 2.5v8.5l-1.83-1.2-1.84 1.2-1.83-1.2-1.83 1.2-1.84-1.2-1.83 1.2Z" fill="var(--accent-ink)" />
      <path d="M24.5 25.5h5M24.5 28h3" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
        MAFC <span className="font-semibold text-accent">Comanda</span>
      </span>
    </span>
  );
}
