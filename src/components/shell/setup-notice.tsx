import { Database } from "lucide-react";
import { Brand } from "@/components/brand";

export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      <Brand />
      <div className="rounded-3xl border border-line bg-surface p-6">
        <Database className="mb-3 size-8 text-accent" />
        <h1 className="text-2xl font-bold">Falta conectar Supabase</h1>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          <li>Ejecuta <code className="font-mono text-ink">supabase/schema.sql</code> en el SQL Editor.</li>
          <li>Copia <code className="font-mono text-ink">.env.example</code> a <code className="font-mono text-ink">.env.local</code> y completa la URL y la anon key.</li>
          <li>Reinicia <code className="font-mono text-ink">npm run dev</code>.</li>
        </ol>
      </div>
    </div>
  );
}
