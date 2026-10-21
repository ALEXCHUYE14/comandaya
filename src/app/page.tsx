import Link from "next/link";
import { ArrowRight, ChefHat, QrCode, Smartphone, Wallet, Zap } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Zap, title: "Caja al toque", text: "Toma el pedido en segundos desde el celular o la tablet, con token de llamado automático." },
  { icon: ChefHat, title: "Pantalla de cocina", text: "Las comandas llegan solas con campanita y semáforo de tiempo: verde, ámbar, rojo." },
  { icon: QrCode, title: "Carta QR que vende", text: "Tu cliente pide desde su mesa o para llevar y ve en vivo cuándo está listo." },
  { icon: Wallet, title: "Yape, Plin y efectivo", text: "Muestra tu QR al cobrar y calcula el vuelto sin errores." },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" asChild><Link href="/login">Entrar</Link></Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
            <Smartphone className="size-4" /> Para cevicherías, broasterías, hamburgueserías y dark kitchens
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.02] sm:text-6xl">
            El cuaderno de pedidos <span className="text-accent">ya fue.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            MAFC Comanda conecta tu caja, tu cocina y la carta QR en tiempo real. Menos gritos, cero comandas
            perdidas y clientes que saben exactamente cuándo sale su plato.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link href="/registro">Crear mi negocio <ArrowRight /></Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/login">Ya tengo cuenta</Link></Button>
          </div>
        </div>

        {/* Mock de comanda */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-accent/15 blur-2xl" />
          <div className="rotate-[-2deg] rounded-[2rem] border border-line bg-surface p-5 shadow-2xl">
            <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between rounded-t-[2rem] bg-amber px-5 py-3 text-[#231700]">
              <span className="font-mono text-3xl font-extrabold">#027</span>
              <span className="font-mono text-2xl font-bold">06:41</span>
            </div>
            <p className="mb-3 text-sm font-bold text-muted">Mesa 4 · QR</p>
            {[["2", "Ceviche mixto", "sin cebolla"], ["1", "Leche de tigre", null], ["3", "Chicha morada 1L", null]].map(([q, n, note]) => (
              <div key={n} className="flex gap-3 py-1.5 text-lg">
                <span className="font-mono font-extrabold text-accent">{q}</span>
                <span className="font-semibold">{n}{note && <span className="block text-sm italic text-danger">↳ {note}</span>}</span>
              </div>
            ))}
            <div className="mt-4 grid h-14 place-items-center rounded-xl bg-olive font-bold text-white dark:text-[#10140a]">Listo para entregar</div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-3xl border border-line bg-surface p-5">
            <f.icon className="mb-3 size-7 text-accent" />
            <h2 className="text-lg font-bold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
