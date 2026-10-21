"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/core/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getSupabase } from "@/infrastructure/supabase/client";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";

/** Mensajes de Supabase Auth en español. */
function authMessage(err: unknown): string {
  const msg = errorMessage(err, "Error inesperado");
  if (/rate limit|security purposes|too many/i.test(msg)) return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  if (/different from the old/i.test(msg)) return "La nueva contraseña debe ser distinta a la anterior.";
  if (/at least|weak/i.test(msg)) return "La contraseña es muy débil: usa mínimo 8 caracteres.";
  if (/expired|invalid/i.test(msg)) return "El enlace venció o ya se usó. Pide uno nuevo.";
  return msg;
}

/** Paso 1: pedir el enlace por correo. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) return void toast.error("Configura Supabase en .env.local");
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(authMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-12 text-olive" />
        {/* Mismo mensaje exista o no la cuenta: no revela qué correos están registrados */}
        <p>Si existe una cuenta con <b>{email.trim()}</b>, te llegará un enlace para crear una nueva contraseña.</p>
        <p className="text-sm text-muted">Revisa también la carpeta de spam. Abre el enlace en este mismo dispositivo.</p>
        <Link className="inline-block font-semibold text-accent" href="/login">Volver a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Correo de tu cuenta">
        <Input required type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@gmail.com" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} Enviarme el enlace
      </Button>
      <p className="text-center text-sm text-muted">
        ¿La recordaste? <Link className="font-semibold text-accent" href="/login">Inicia sesión</Link>
      </p>
    </form>
  );
}

/** Paso 2: el enlace del correo abre esta pantalla para poner la nueva contraseña. */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [stage, setStage] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    let alive = true;
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && alive) setStage("ready");
    });

    (async () => {
      const tokenHash = params.get("token_hash");
      let ok = false;
      if (tokenHash) {
        // Plantilla de correo con token_hash: funciona aunque se abra en otro dispositivo
        const { error } = await sb.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        ok = !error;
      } else {
        // Enlace con ?code=: el cliente lo canjea solo al iniciar; aquí esperamos ese canje
        const { data } = await sb.auth.getSession();
        ok = Boolean(data.session);
      }
      if (!alive) return;
      setStage(ok ? "ready" : "invalid");
      // Limpia el código de la URL para que recargar no intente canjearlo otra vez
      if (ok && (tokenHash || params.get("code"))) window.history.replaceState(null, "", "/restablecer");
    })();

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return void toast.error("Usa mínimo 8 caracteres");
    if (password !== confirm) return void toast.error("Las contraseñas no coinciden");
    setSaving(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      router.replace("/pos");
      router.refresh();
    } catch (err) {
      toast.error(authMessage(err));
      setSaving(false);
    }
  }

  if (stage === "checking") {
    return <p className="flex items-center justify-center gap-2 py-10 text-muted"><Loader2 className="size-5 animate-spin" /> Verificando enlace…</p>;
  }
  if (stage === "invalid") {
    return (
      <div className="space-y-4 text-center">
        <TriangleAlert className="mx-auto size-12 text-amber" />
        <p>El enlace venció, ya se usó o se abrió en otro dispositivo.</p>
        <Button asChild size="lg" className="w-full"><Link href="/recuperar">Pedir un enlace nuevo</Link></Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
        <PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Repite la contraseña">
        <PasswordInput required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" /> : <ArrowRight />} Guardar y entrar
      </Button>
    </form>
  );
}
