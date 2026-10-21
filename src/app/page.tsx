import Link from "next/link";
import {
  ArrowRight, BarChart3, Calculator, Check, ChefHat, ChevronDown, Cloud, ImageIcon, MessageCircle,
  Printer, QrCode, ShieldCheck, Smartphone, Store, Users, Wallet, Zap,
} from "lucide-react";
import { Brand, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { DEFAULT_PLAN, MAFC_TAGLINE, MAFC_WHATSAPP, MAFC_WHATSAPP_DISPLAY, type PublicPlan } from "@/core/domain/mafc";
import { money, whatsappLink } from "@/core/domain/order-rules";
import { isSupabaseConfigured } from "@/infrastructure/supabase/env";
import { getPublicServerSupabase } from "@/infrastructure/supabase/public-server";

// Página estática que se regenera cada hora: el precio sale del panel /mafc sin consultar en cada visita
export const revalidate = 3600;

/** Precio y días de prueba configurados en /mafc → Plan y cobro (con valores por defecto si falla). */
async function getPlan(): Promise<PublicPlan> {
  if (!isSupabaseConfigured) return DEFAULT_PLAN;
  try {
    const { data, error } = await getPublicServerSupabase().rpc("public_plan");
    if (error || !data) return DEFAULT_PLAN;
    const p = data as Partial<PublicPlan>;
    return {
      plan_name: p.plan_name || DEFAULT_PLAN.plan_name,
      monthly_price: Number(p.monthly_price ?? DEFAULT_PLAN.monthly_price),
      trial_days: Number(p.trial_days ?? DEFAULT_PLAN.trial_days),
      grace_days: Number(p.grace_days ?? DEFAULT_PLAN.grace_days),
    };
  } catch {
    return DEFAULT_PLAN;
  }
}

const FEATURES = [
  { icon: Zap, title: "Caja al toque", text: "Toma el pedido en segundos desde el celular o la tablet, con token de llamado automático." },
  { icon: ChefHat, title: "Pantalla de cocina", text: "Las comandas llegan solas con campanita y semáforo de tiempo: verde, ámbar, rojo." },
  { icon: QrCode, title: "Carta QR que vende", text: "Tu cliente pide desde su mesa o para llevar y ve en vivo cuándo está listo." },
  { icon: Wallet, title: "Yape, Plin y efectivo", text: "Muestra tu QR al cobrar y calcula el vuelto sin errores." },
  { icon: ImageIcon, title: "Carta con fotos en vivo", text: "Sube la foto de cada plato. Si se agota, en la carta se ve «Agotado» al instante." },
  { icon: Calculator, title: "Cuadre de caja", text: "Abre y cierra turno, registra gastos y sabe al sol cuánto debe haber en el cajón." },
  { icon: BarChart3, title: "Reportes y Excel", text: "Ventas por día y hora, lo más vendido, métodos de pago y anulaciones con su motivo." },
  { icon: Users, title: "Todo tu equipo", text: "Dueño, caja, mozos y cocina, cada uno con sus permisos. Sin límite de usuarios." },
];

const STEPS = [
  { n: "1", title: "Crea tu negocio", text: "Regístrate y elige tu enlace. Te dejamos una carta de ejemplo para que pruebes al instante." },
  { n: "2", title: "Carga tu carta y mesas", text: "Agrega tus platos con foto y precio, e imprime los QR de cada mesa desde el sistema." },
  { n: "3", title: "Vende y cobra", text: "Caja y cocina conectadas en vivo. Tus clientes también piden y siguen su pedido desde el celular." },
];

const PILLARS = [
  { icon: Cloud, title: "Sin instalar nada", text: "Funciona en el navegador del celular, tablet o PC. Si quieres, se instala como app." },
  { icon: Printer, title: "Ticketera térmica", text: "Imprime tickets y comandas en 80 mm desde el mismo sistema." },
  { icon: ShieldCheck, title: "Tus datos protegidos", text: "Cada negocio ve sólo lo suyo y cada rol sólo lo que le toca." },
];

export default async function Home() {
  const plan = await getPlan();
  // "S/ 30" se lee mejor que "S/ 30.00" en una página de venta; con céntimos se muestran completos
  const price = Number.isInteger(plan.monthly_price) ? `S/ ${plan.monthly_price}` : money(plan.monthly_price);
  const trial = plan.trial_days;
  const wa = whatsappLink(MAFC_WHATSAPP, "Hola MAFC, quiero información sobre MAFC Comanda para mi negocio.");
  const year = new Date().getFullYear();

  const FAQ = [
    { q: "¿Necesito instalar algo o comprar equipos?", a: "No. Funciona en el navegador de cualquier celular, tablet o computadora que ya tengas. Para imprimir tickets puedes usar tu ticketera térmica de 80 mm." },
    { q: `¿Qué pasa cuando terminan mis ${trial} días gratis?`, a: `Sigues con el plan de ${price} al mes. Pagas por Yape o Plin y envías tu comprobante por WhatsApp; tu acceso se extiende al confirmar el pago.` },
    { q: "Si me atraso con el pago, ¿pierdo mi información?", a: `No. Tienes ${plan.grace_days} días de gracia con un aviso. Si se suspende la cuenta, tus productos, ventas y reportes se conservan y vuelven apenas pagas.` },
    { q: "¿Mis clientes tienen que descargar una app para pedir?", a: "No. Escanean el QR de la mesa, ven tu carta con fotos y precios, y siguen su pedido en vivo desde el navegador." },
    { q: "¿Cuántos usuarios y pedidos incluye?", a: "Todos los que necesites: dueño, administradores, caja, mozos y cocina, sin límite de pedidos." },
    { q: "¿Emite boletas o facturas electrónicas?", a: "Por ahora no: el ticket del sistema es una nota de venta. Si necesitas algo a la medida de tu negocio, escríbenos." },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Brand />
          <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
            <a href="#funciones" className="hover:text-ink">Funciones</a>
            <a href="#como-funciona" className="hover:text-ink">Cómo funciona</a>
            <a href="#precio" className="hover:text-ink">Precio</a>
            <a href="#preguntas" className="hover:text-ink">Preguntas</a>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" asChild><Link href="/login">Entrar</Link></Button>
            <Button className="hidden sm:inline-flex" asChild><Link href="/registro">Prueba gratis</Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
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
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted">
            {[`${trial} días gratis`, "Sin tarjeta para empezar", `Luego ${price} al mes`].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5"><Check className="size-4 text-olive" /> {t}</li>
            ))}
          </ul>
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

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-20">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">Todo en un solo sistema</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Lo que necesitas para atender, cobrar y crecer</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl border border-line bg-surface p-5">
              <f.icon className="mb-3 size-7 text-accent" />
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-[#121212] text-[#eee8e0] dark:bg-[#1b1a18]">
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <div className="grain pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-wider text-[#e07a4c]">Cómo funciona</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold sm:text-4xl">Empiezas a vender hoy mismo, en 3 pasos</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#e07a4c] font-[family-name:var(--font-display)] text-xl font-extrabold text-[#1a0d06]">{s.n}</span>
                  <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-[#a1978c]">{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 grid gap-6 border-t border-white/10 pt-10 md:grid-cols-3">
              {PILLARS.map((p) => (
                <div key={p.title} className="flex gap-3">
                  <p.icon className="mt-0.5 size-6 shrink-0 text-[#e07a4c]" />
                  <div>
                    <h3 className="font-bold">{p.title}</h3>
                    <p className="mt-1 text-sm text-[#a1978c]">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Precio */}
      <section id="precio" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">Precio</p>
          <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Un solo plan, con todo incluido</h2>
          <p className="mt-3 text-muted">Sin contratos ni costos de instalación. Pruébalo gratis y decide después.</p>
        </div>
        <div className="relative mx-auto mt-10 max-w-md">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-accent/10 blur-2xl" />
          <div className="rounded-[2rem] border-2 border-accent/40 bg-surface p-7 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold">{plan.plan_name}</h3>
              <span className="rounded-full bg-olive-soft px-3 py-1 text-xs font-bold text-olive">{trial} días gratis</span>
            </div>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="tabular font-[family-name:var(--font-display)] text-5xl font-extrabold">{price}</span>
              <span className="font-semibold text-muted">/ mes</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              {[
                "Caja, pantalla de cocina y carta QR",
                "Carta digital con fotos que se actualiza en vivo",
                "Cuadre de caja, reportes y exportación a Excel",
                "Usuarios y pedidos ilimitados",
                "Pagos con Yape, Plin, efectivo y tarjeta",
                "Soporte directo por WhatsApp",
              ].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 text-olive" /> {t}</li>
              ))}
            </ul>
            <Button size="lg" className="mt-7 w-full" asChild><Link href="/registro">Empezar mis {trial} días gratis <ArrowRight /></Link></Button>
            <p className="mt-3 text-center text-xs text-muted">Pagas por Yape o Plin al terminar la prueba. Tus datos nunca se borran.</p>
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-20">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-8 divide-y divide-line rounded-3xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {f.q}
                <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Llamado final */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-accent px-6 py-12 text-accent-ink sm:px-12">
          <div className="grain pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-3xl font-extrabold sm:text-4xl">¿Listo para dejar el cuaderno?</h2>
              <p className="mt-2 text-lg opacity-90">Crea tu negocio en 2 minutos o escríbenos y te ayudamos a configurarlo.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="secondary" asChild><Link href="/registro"><Store /> Crear mi negocio</Link></Button>
              {wa && (
                <Button size="lg" variant="outline" className="border-accent-ink/30 bg-transparent text-accent-ink hover:bg-accent-ink/10" asChild>
                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Hablar por WhatsApp</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-3 max-w-xs text-sm text-muted">
              {MAFC_TAGLINE} de tu negocio. Caja, cocina y carta QR conectadas en tiempo real. Hecho en Perú.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold">Producto</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><a href="#funciones" className="hover:text-ink">Funciones</a></li>
              <li><a href="#como-funciona" className="hover:text-ink">Cómo funciona</a></li>
              <li><a href="#precio" className="hover:text-ink">Precio</a></li>
              <li><a href="#preguntas" className="hover:text-ink">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">Tu cuenta</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/login" className="hover:text-ink">Iniciar sesión</Link></li>
              <li><Link href="/registro" className="hover:text-ink">Crear mi negocio</Link></li>
              <li><Link href="/recuperar" className="hover:text-ink">Recuperar contraseña</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">Contacto</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {wa && (
                <li>
                  <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
                    <MessageCircle className="size-4 text-[#1fa855]" /> {MAFC_WHATSAPP_DISPLAY}
                  </a>
                </li>
              )}
              <li>Te ayudamos a configurar tu negocio</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-muted sm:flex-row">
            <p className="inline-flex items-center gap-2"><BrandMark className="size-4" /> © {year} MAFC · MAFC Comanda. Todos los derechos reservados.</p>
            <p>{MAFC_TAGLINE} · Hecho en Perú</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
