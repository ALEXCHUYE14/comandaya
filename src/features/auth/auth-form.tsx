"use client";

import { errorMessage } from "@/core/lib/cn";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getSupabase } from "@/infrastructure/supabase/client";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
      return;
    }
    setLoading(true);
    const sb = getSupabase();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        router.replace(params.get("next") || "/pos");
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { full_name: form.fullName.trim() },
            emailRedirectTo: `${window.location.origin}/bienvenida`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Te enviamos un correo para confirmar tu cuenta. Luego inicia sesión.");
          router.replace("/login");
          return;
        }
        router.replace("/bienvenida");
        router.refresh();
      }
    } catch (err) {
      const msg = errorMessage(err, "Error inesperado");
      toast.error(msg.includes("Invalid login") ? "Correo o contraseña incorrectos" : msg);
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
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
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {mode === "login" ? "Entrar" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>¿Aún no tienes cuenta? <Link className="font-semibold text-accent" href="/registro">Regístrate</Link></>
        ) : (
          <>¿Ya tienes cuenta? <Link className="font-semibold text-accent" href="/login">Inicia sesión</Link></>
        )}
      </p>
    </form>
  );
}
