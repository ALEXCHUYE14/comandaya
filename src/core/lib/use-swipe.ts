"use client";

import { useRef, useState } from "react";

/**
 * Gesto de deslizar horizontal (táctil y mouse).
 * Devuelve el desplazamiento actual para animar y dispara callbacks al superar el umbral.
 */
export function useSwipe({
  onSwipeRight,
  onSwipeLeft,
  threshold = 96,
}: {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number;
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const locked = useRef<"x" | "y" | null>(null);
  const [dx, setDx] = useState(0);

  const reset = () => {
    start.current = null;
    locked.current = null;
    setDx(0);
  };

  return {
    dx,
    progress: Math.min(Math.abs(dx) / threshold, 1),
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if ((e.target as HTMLElement).closest("button,a,input,textarea,select")) return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (!locked.current && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
          locked.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
          if (locked.current === "x") (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
        if (locked.current !== "x") return;
        const allowed = (mx > 0 && onSwipeRight) || (mx < 0 && onSwipeLeft) ? mx : mx * 0.15;
        setDx(Math.max(-160, Math.min(160, allowed)));
      },
      onPointerUp: () => {
        if (locked.current === "x") {
          if (dx >= threshold) onSwipeRight?.();
          else if (dx <= -threshold) onSwipeLeft?.();
        }
        reset();
      },
      onPointerCancel: reset,
    },
    style: {
      transform: dx ? `translateX(${dx}px)` : undefined,
      transition: dx ? "none" : "transform 220ms cubic-bezier(.22,1,.36,1)",
      touchAction: "pan-y" as const,
    },
  };
}
