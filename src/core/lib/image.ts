/** Perfiles de compresión: menos KB = menos Egress en Supabase y carga más rápida. */
export const IMAGE_PRESETS = {
  /** Fotos de platos: se ven a ~130 px en la lista y a ~600 px en el detalle. */
  product: { maxSide: 800, quality: 0.8, maxBytes: 150_000 },
  /** Logo: se ve pequeño en cabeceras y tickets. */
  logo: { maxSide: 512, quality: 0.85, maxBytes: 120_000 },
} as const;

type Options = { maxSide?: number; quality?: number; maxBytes?: number };

async function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
}

/** Reduce la imagen en el navegador (ahorra datos móviles y Storage). SVG se sube tal cual. */
export async function downscaleImage(file: File, { maxSide = 1200, quality = 0.85, maxBytes = 400_000 }: Options = {}): Promise<File> {
  if (file.type === "image/svg+xml" || typeof createImageBitmap === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato que el navegador no sabe decodificar: lo valida el bucket
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= maxBytes) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Safari antiguo no codifica WebP y devuelve PNG (más pesado): en ese caso, JPEG.
  let blob = await encode(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    ctx.globalCompositeOperation = "destination-over"; // JPEG no tiene transparencia: fondo blanco
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode(canvas, "image/jpeg", quality);
  }
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${file.name.replace(/\.\w+$/, "") || "imagen"}.${ext}`, { type: blob.type });
}
