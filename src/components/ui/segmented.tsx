"use client";

import { cn } from "@/core/lib/cn";

/** Selector segmentado táctil (reemplaza tabs para opciones cortas). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted transition-all [&_svg]:size-4",
            value === o.value && "bg-surface text-ink shadow-sm",
          )}
        >
          {o.icon}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
