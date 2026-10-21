"use client";

import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/core/lib/cn";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * Modal adaptable: hoja inferior en móvil (gesto natural del pulgar),
 * ventana centrada en tablet/escritorio.
 */
export function DialogContent({
  title,
  description,
  children,
  className,
  side = "auto",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  side?: "auto" | "right";
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col border-line bg-surface text-ink shadow-2xl focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-md border-l data-[state=open]:animate-slide-up sm:rounded-l-3xl"
            : "inset-x-0 bottom-0 rounded-t-3xl border-t data-[state=open]:animate-slide-up sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div>
            <D.Title className="font-[family-name:var(--font-display)] text-xl font-bold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Cerrar">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
