"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, errorMessage } from "@/core/lib/cn";
import { downscaleImage, IMAGE_PRESETS } from "@/core/lib/image";
import { businessRepo, type AssetKind } from "@/infrastructure/repositories/business.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

export function ImageUpload({
  tenantId,
  kind,
  value,
  onChange,
  label,
  className,
  square = true,
  keepOriginal = false,
  preset,
}: {
  tenantId: string;
  kind: AssetKind;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  className?: string;
  square?: boolean;
  /** Los QR de pago no se recomprimen para no perder legibilidad. */
  keepOriginal?: boolean;
  /** Perfil de compresión (tamaño máximo y calidad). */
  preset?: keyof typeof IMAGE_PRESETS;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecciona una imagen");
    // Las fotos del celular pesan mucho, pero se comprimen antes de subir.
    if (file.size > (keepOriginal ? 5 : 20) * 1024 * 1024) return toast.error(`La imagen supera ${keepOriginal ? 5 : 20} MB`);
    setBusy(true);
    try {
      const ready = keepOriginal ? file : await downscaleImage(file, preset ? IMAGE_PRESETS[preset] : undefined);
      if (ready.size > 5 * 1024 * 1024) throw new Error("La imagen supera 5 MB incluso comprimida");
      const url = await businessRepo.uploadAsset(getSupabase(), tenantId, kind, ready);
      onChange(url);
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo subir la imagen"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-semibold">{label}</p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void handle(e.dataTransfer.files[0]); }}
        className={cn("group relative overflow-hidden rounded-2xl border-2 border-dashed border-line bg-surface-2", square ? "aspect-square" : "aspect-video")}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="size-full bg-white object-contain" />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-sm font-semibold text-muted">
            <ImagePlus className="size-7" /> Subir imagen
          </button>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-surface/70"><Loader2 className="size-7 animate-spin text-accent" /></div>}
        {value && !busy && (
          <div className="absolute inset-x-2 bottom-2 flex gap-2">
            <button type="button" onClick={() => input.current?.click()} className="h-10 flex-1 rounded-xl bg-ink/85 text-sm font-bold text-bg backdrop-blur">Cambiar</button>
            <button type="button" aria-label="Quitar imagen" onClick={() => onChange(null)} className="grid size-10 place-items-center rounded-xl bg-danger text-white">
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
    </div>
  );
}
