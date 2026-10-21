import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#121212] p-12 text-[#eee8e0] lg:flex lg:flex-col lg:justify-between">
        <div className="grain absolute inset-0 opacity-40" />
        <Link href="/" className="relative"><Brand /></Link>
        <div className="relative max-w-md">
          <p className="font-mono text-sm text-[#e07a4c]">#027 · Ceviche mixto x2 · Mesa 4</p>
          <h2 className="mt-4 text-5xl font-extrabold leading-[1.05]">
            Adiós a la comanda de papel.
          </h2>
          <p className="mt-4 text-lg text-[#a1978c]">
            Caja, cocina y carta QR conectadas en tiempo real. Pensado para el local de al paso que
            no para de vender.
          </p>
        </div>
        <p className="relative text-sm text-[#a1978c]">Yape · Plin · Efectivo · Tarjeta</p>
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:invisible"><Brand /></Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
