"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, MailWarning, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/infrastructure/supabase/client";
import { authMessage, confirmRedirectUrl } from "./auth-messages";

const COOLDOWN = 60; // Supabase limita los reenvíos: un correo por minuto

/** Reenvía el correo de confirmación, con espera entre intentos. */
export function ResendConfirmationButton({ email, variant = "outline" }: { email: string; variant?: "outline" | "primary" }) {
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    if (!email.trim()) return void toast.error("Escribe tu correo");
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: confirmRedirectUrl() },
      });
      if (error) throw error;
      toast.success("Te reenviamos el correo de confirmación");
      setWait(COOLDOWN);
    } catch (err) {
      toast.error(authMessage(err));
      setWait(COOLDOWN);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant={variant} className="w-full" disabled={busy || wait > 0} onClick={resend}>
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {wait > 0 ? `Reenviar en ${wait} s` : "Reenviar correo de confirmación"}
    </Button>
  );
}

/** Pantalla tras registrarse: no se puede entrar hasta confirmar el correo. */
export function CheckEmailScreen({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <div className="grid size-16 place-items-center rounded-3xl bg-accent/10 text-accent">
        <MailCheck className="size-8" />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold">Confirma tu correo</h1>
        <p className="mt-2 text-muted">
          Te enviamos un enlace a <b className="break-all text-ink">{email}</b>.
        </p>
      </div>

      <p className="flex gap-2.5 rounded-2xl border border-amber/30 bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
        <MailWarning className="size-5 shrink-0" />
        No podrás ingresar al sistema hasta que confirmes tu correo.
      </p>

      <ol className="space-y-2.5 text-[15px]">
        {[
          "Abre tu bandeja de entrada.",
          "Busca el correo de confirmación de tu cuenta (revisa también Spam o Promociones).",
          "Toca el enlace de confirmación y vuelve a iniciar sesión.",
        ].map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-bg">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2 pt-1">
        <Button asChild size="lg" className="w-full"><Link href="/login"><CheckCircle2 /> Ya confirmé, iniciar sesión</Link></Button>
        <ResendConfirmationButton email={email} />
      </div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> ¿Escribiste mal tu correo? Regístrate de nuevo
      </button>
    </div>
  );
}
