"use client";

import { useMemo, useRef, useState } from "react";
import { Ban, Search, X } from "lucide-react";
import type { Category, Product } from "@/core/domain/types";
import { initials, money } from "@/core/domain/order-rules";
import { cn } from "@/core/lib/cn";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Barra de búsqueda con autocompletado: ↑/↓ para moverse, Enter agrega. */
function SearchBox({
  products,
  query,
  onQuery,
  onPick,
}: {
  products: Product[];
  query: string;
  onQuery: (q: string) => void;
  onPick: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return [];
    return products
      .filter((p) => p.is_available && norm(p.name).includes(q))
      .sort((a, b) => norm(a.name).indexOf(q) - norm(b.name).indexOf(q))
      .slice(0, 6);
  }, [products, query]);

  function pick(p: Product) {
    onPick(p);
    onQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const s = suggestions[active];
            if (s) pick(s);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="product-suggestions"
        aria-autocomplete="list"
        placeholder="Buscar plato o bebida…"
        className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-12 text-base outline-none transition-shadow focus:border-accent focus:ring-4 focus:ring-ring"
      />
      {query && (
        <button
          onClick={() => onQuery("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-surface-2"
        >
          <X className="size-5" />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id="product-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl animate-fade-in"
        >
          {suggestions.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex h-12 w-full items-center justify-between px-4 text-left", i === active && "bg-surface-2")}
              >
                <span className="font-medium">{s.name}</span>
                <span className="tabular text-sm font-semibold text-muted">{money(s.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductTile({ product, qty, onAdd }: { product: Product; qty: number; onAdd: () => void }) {
  const [bump, setBump] = useState(0);
  const disabled = !product.is_available;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onAdd();
        setBump((b) => b + 1);
      }}
      className={cn(
        "group relative flex min-h-[112px] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-all active:scale-[0.97] hover:border-accent/50 hover:shadow-md",
        qty > 0 && "border-accent ring-2 ring-accent/25",
        disabled && "opacity-50 grayscale",
      )}
    >
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" loading="lazy" decoding="async" className="h-24 w-full bg-surface-2 object-cover" />
      ) : (
        <div className="grain flex h-14 items-end bg-surface-2 px-3 pb-1.5">
          <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-muted/50">
            {initials(product.name)}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between gap-1 p-3">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{product.name}</span>
        <span className="tabular text-sm font-bold text-accent">{money(product.price)}</span>
      </div>
      {qty > 0 && (
        <span
          key={bump}
          className="absolute right-2 top-2 grid min-w-8 animate-pop place-items-center rounded-full bg-accent px-2 py-1 text-sm font-extrabold text-accent-ink shadow"
        >
          {qty}
        </span>
      )}
      {bump > 0 && (
        <span key={`fly-${bump}`} className="pointer-events-none absolute bottom-10 right-4 animate-fly text-lg font-extrabold text-accent">
          +1
        </span>
      )}
      {disabled && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
          <Ban className="size-3" /> Agotado
        </span>
      )}
    </button>
  );
}

export function ProductPicker({
  categories,
  products,
  quantities,
  onAdd,
}: {
  categories: Category[];
  products: Product[];
  quantities: Record<string, number>;
  onAdd: (p: Product) => void;
}) {
  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");

  const visibleCats = categories.filter((c) => c.is_active && products.some((p) => p.category_id === c.id));
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return products.filter(
      (p) => (cat === "all" || p.category_id === cat) && (!q || norm(p.name).includes(q) || norm(p.description ?? "").includes(q)),
    );
  }, [products, cat, query]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <SearchBox products={products} query={query} onQuery={setQuery} onPick={onAdd} />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {[{ id: "all", name: "Todo" }, ...visibleCats].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
              cat === c.id ? "border-ink bg-ink text-bg" : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filtered.map((p) => (
          <ProductTile key={p.id} product={p} qty={quantities[p.id] ?? 0} onAdd={() => onAdd(p)} />
        ))}
      </div>
      {filtered.length === 0 && <p className="py-10 text-center text-muted">No hay productos que coincidan.</p>}
    </div>
  );
}
