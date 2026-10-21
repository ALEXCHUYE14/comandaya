"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/core/lib/cn";

// Clave histórica: no se renombra para no perder la preferencia guardada en los equipos
export const THEME_KEY = "comandaya-theme";

/** Se inyecta en <head> para aplicar el tema antes del primer pintado (sin parpadeo). */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", next ? "#121212" : "#f5f1ea");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className={cn("grid size-12 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink", className)}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
