"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, MailWarning, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getSupabase } from "@/infrastructure/supabase/client";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { AuthHeading } from "./auth-heading";
import { authMessage, confirmRedirectUrl, isEmailNotConfirmed } from "./auth-messages";
import { CheckEmailScreen, ResendConfirmationButton } from "./email-confirmation";

/** Aviso en el login al volver del enlace del correo. */
type LinkNotice = "confirmed" | "expired" | null;

export function AuthForm({ mode, title, subtitle }: { mode: "login" | "register"; title: string; subtitle: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  /** Registro exitoso: correo al que se envió la confirmación. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Login rechazado porque el correo no está confirmado. */
  const [unconfirmed, setUnconfirmed] = useState(false);
  /** Registro con un correo que ya tiene cuenta (Supabase no envía correo en ese caso). */
  const [duplicate, setDuplicate] = useState(false);
  const [linkNotice, setLinkNotice] = useState<LinkNotice>(null);

  // Vuelta desde el enlace de confirmación: /login?confirmado=1&code=… (o ?error_code=… si venció)
  useEffect(() => {
    if (mode !== "login") return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errCode = params.get("error_code") ?? hash.get("error_code") ?? params.get("error") ?? hash.get("error");
    const confirmed = params.get("confirmado") === "1" || params.has("code");
    if (!errCode && !confirmed) return;
    let alive = true;

    const cleanUrl = () => {
      const next = params.get("next");
      window.history.replaceState(null, "", next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    };

    (async () => {
      if (errCode) {
        if (alive) setLinkNotice("expired");
        cleanUrl();
        return;
      }
      // El cliente canjea el código del enlace al iniciar; getSession espera ese canje.
      const { data } = await getSupabase().auth.getSession();
      if (!alive) return;
      cleanUrl();
      if (data.session) {
        toast.success("¡Correo confirmado! Ya puedes crear tu negocio.");
        router.replace("/bienvenida");
        router.refresh();
        return;
      }
      // Confirmado en otro dispositivo o navegador: el correo ya quedó verificado, sólo falta entrar
      setLinkNotice("confirmed");
    })();
    return () => { alive = false; };
  }, [mode, params, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
      return;
    }
    setLoading(true);
    setUnconfirmed(false);
    setDuplicate(false);
    const sb = getSupabase();
    const email = form.email.trim();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password: form.password });
        if (error) {
          if (isEmailNotConfirmed(error)) {
            setUnconfirmed(true);
            return;
          }
          throw error;
        }
        router.replace(params.get("next") || "/pos");
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          email,
          password: form.password,
          options: { data: { full_name: form.fullName.trim() }, emailRedirectTo: confirmRedirectUrl() },
        });
        if (error) throw error;
        // Con la confirmación activa, Supabase responde "éxito" aunque el correo ya exista
        // (sin identidades y sin enviar nada): hay que avisarlo para que no espere un correo.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setDuplicate(true);
          return;
        }
        if (!data.session) {
          setSentTo(email);
          return;
        }
        router.replace("/bienvenida");
        router.refresh();
      }
    } catch (err) {
      toast.error(authMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === "email") {
      setUnconfirmed(false);
      setDuplicate(false);
    }
  };

  if (sentTo) {
    return <CheckEmailScreen email={sentTo} onBack={() => { setSentTo(null); setForm((f) => ({ ...f, password: "" })); }} />;
  }

  return (
    <>
      <AuthHeading title={title} subtitle={subtitle} />

      {linkNotice === "confirmed" && (
        <p role="status" className="mb-5 flex gap-2.5 rounded-2xl bg-olive-soft px-4 py-3 text-sm font-semibold text-olive">
          <CheckCircle2 className="size-5 shrink-0" /> ¡Tu correo quedó confirmado! Ya puedes iniciar sesión.
        </p>
      )}
      {linkNotice === "expired" && (
        <div role="alert" className="mb-5 space-y-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
          <p className="flex gap-2.5 font-semibold">
            <TriangleAlert className="size-5 shrink-0" />
            El enlace de confirmación venció o ya se usó. Si ya confirmaste, inicia sesión; si no, escribe tu correo y pide uno nuevo.
          </p>
          <ResendConfirmationButton email={form.email} />
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <Field label="Tu nombre">
            <Input required autoComplete="name" value={form.fullName} onChange={set("fullName")} placeholder="Rosa Quispe" />
          </Field>
        )}
        <Field label="Correo">
          <Input required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} placeholder="tucorreo@gmail.com" />
        </Field>
        <Field label="Contraseña" hint={mode === "register" ? "Mínimo 8 caracteres" : undefined}>
          <PasswordInput
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        {mode === "login" && (
          <p className="-mt-2 text-right text-sm">
            <Link className="font-semibold text-accent" href="/recuperar">¿Olvidaste tu contraseña?</Link>
          </p>
        )}

        {unconfirmed && (
          <div role="alert" className="space-y-3 rounded-2xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm text-amber">
            <p className="flex gap-2.5 font-semibold">
              <MailWarning className="size-5 shrink-0" />
              Aún no confirmas tu correo. Abre el enlace que te enviamos a {form.email.trim()} (revisa también Spam) para poder ingresar.
            </p>
            <ResendConfirmationButton email={form.email} />
          </div>
        )}
        {duplicate && (
          <p role="alert" className="flex gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            <TriangleAlert className="size-5 shrink-0" />
            <span>
              Ese correo ya tiene una cuenta. <Link href="/login" className="underline">Inicia sesión</Link> o{" "}
              <Link href="/recuperar" className="underline">recupera tu contraseña</Link>.
            </span>
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          {mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
        {mode === "register" && (
          <p className="text-center text-xs text-muted">Te enviaremos un correo para confirmar tu cuenta antes de ingresar.</p>
        )}
        <p className="text-center text-sm text-muted">
          {mode === "login" ? (
            <>¿Aún no tienes cuenta? <Link className="font-semibold text-accent" href="/registro">Regístrate</Link></>
          ) : (
            <>¿Ya tienes cuenta? <Link className="font-semibold text-accent" href="/login">Inicia sesión</Link></>
          )}
        </p>
      </form>
    </>
  );
}
