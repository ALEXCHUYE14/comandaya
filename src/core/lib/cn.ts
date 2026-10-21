import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mensaje legible de cualquier error (Error nativo o PostgrestError/AuthError de Supabase). */
export function errorMessage(err: unknown, fallback = "Ocurrió un error"): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message || fallback;
  }
  return fallback;
}
