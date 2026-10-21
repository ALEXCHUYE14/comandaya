"use client";

import { errorMessage } from "@/core/lib/cn";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, RefreshCw, Store, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/core/domain/order-rules";
import { businessRepo } from "@/infrastructure/repositories/business.repo";
import { getSupabase } from "@/infrastructure/supabase/client";

export function Onboarding({ email, fullName, deactivated }: { email: string; fullName: string; deactivated: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"owner" | "staff">("owner");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [owner, setOwner] = useState(fullName);
  const [seed, setSeed] = useState(true);
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await businessRepo.createTenant(getSupabase(), { name, slug, fullName: owner, seedDemo: seed });
      toast.success("¡Negocio creado! Ya puedes vender.");
      router.replace("/pos");
      router.refresh();
    } catch (err) {
      const msg = errorMessage(err, "Error");
      toast.error(msg.includes("duplicate") || msg.includes("unique") ? "Ese enlace ya está en uso, prueba otro" : msg);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <Brand />
        <div className="flex">
          <ThemeToggle />
          <button onClick={logout} aria-label="Cerrar sesión" className="grid size-12 place-items-center rounded-xl text-muted hover:bg-surface-2">
            <LogOut className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="text-3xl font-extrabold">Hola{owner ? `, ${owner.split(" ")[0]}` : ""} 👋</h1>
        <p className="mb-6 mt-1 text-muted">¿Cómo vas a usar MAFC Comanda?</p>

        <Segmented
          value={mode}
          onChange={setMode}
          className="mb-5"
          options={[
            { value: "owner", label: "Tengo un negocio", icon: <Store /> },
            { value: "staff", label: "Soy personal", icon: <UserRoundCheck /> },
          ]}
        />

        {mode === "owner" ? (
          <Card className="p-5">
            <form onSubmit={create} className="space-y-4">
              <Field label="Nombre del negocio">
                <Input required minLength={2} maxLength={80} value={name} placeholder="Cevichería El Chalán"
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }} />
              </Field>
              <Field label="Enlace de tu carta" hint={`Tu carta QR quedará en /carta/${slug || "tu-negocio"}`}>
                <Input required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
              </Field>
              <Field label="Tu nombre">
                <Input required value={owner} onChange={(e) => setOwner(e.target.value)} />
              </Field>
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 p-4">
                <span>
                  <span className="block font-semibold">Cargar carta de ejemplo</span>
                  <span className="text-sm text-muted">Ceviches, broaster, bebidas y 6 mesas. Puedes editarla luego.</span>
                </span>
                <Switch checked={seed} onCheckedChange={setSeed} />
              </label>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Store />}
                Crear mi negocio
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="p-5">
            <p className="text-muted">
              {deactivated
                ? "Tu acceso fue desactivado por el administrador del negocio."
                : "Pídele al dueño o administrador que te agregue desde Ajustes → Equipo con este correo:"}
            </p>
            <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 font-mono text-lg font-semibold">{email}</p>
            <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => router.refresh()}>
              <RefreshCw /> Ya me agregaron
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
