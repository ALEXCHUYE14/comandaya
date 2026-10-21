import { Skeleton } from "@/components/ui/empty";

/**
 * Pantalla de carga de cada sección (loading.tsx). Next la precarga con los enlaces del
 * menú: al tocar una sección el cambio es inmediato mientras llega el contenido.
 */
export function PageLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6 md:pr-36" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
