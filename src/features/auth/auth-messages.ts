import { errorMessage } from "@/core/lib/cn";

/** ¿Supabase rechazó el ingreso porque el correo aún no está confirmado? */
export function isEmailNotConfirmed(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "email_not_confirmed" || /email not confirmed/i.test(e?.message ?? "");
}

/** Mensajes de Supabase Auth en español (login, registro, confirmación y contraseña). */
export function authMessage(err: unknown): string {
  const msg = errorMessage(err, "Error inesperado");
  if (isEmailNotConfirmed(err)) return "Tu correo aún no está confirmado. Abre el enlace que te enviamos.";
  if (/invalid login|invalid credentials/i.test(msg)) return "Correo o contraseña incorrectos";
  if (/already registered|already been registered|user already exists/i.test(msg)) return "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.";
  if (/rate limit|security purposes|too many|after \d+ seconds/i.test(msg)) return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  if (/different from the old/i.test(msg)) return "La nueva contraseña debe ser distinta a la anterior.";
  if (/at least|weak|password should/i.test(msg)) return "La contraseña es muy débil: usa mínimo 8 caracteres.";
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(msg)) return "Ese correo no es válido. Revisa que esté bien escrito.";
  if (/expired|invalid/i.test(msg)) return "El enlace venció o ya se usó. Pide uno nuevo.";
  if (/fetch|network/i.test(msg)) return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  return msg;
}

/** A dónde vuelve el enlace de confirmación del correo (debe estar en Redirect URLs de Supabase). */
export const confirmRedirectUrl = () => `${window.location.origin}/login?confirmado=1`;
