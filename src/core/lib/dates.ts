// Fechas de negocio como texto "YYYY-MM-DD" (sin horas: evita desfases de zona horaria).

/** Fecha de hoy en la zona horaria del negocio. */
export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  }
}

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUtc(x);
}

export function startOfMonth(d: string): string {
  return `${d.slice(0, 7)}-01`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Todos los días del rango, inclusive (para no saltarse días sin ventas). */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const dayFmt = new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" });

/** "lun, 3 nov" */
export const formatDay = (d: string) => dayFmt.format(toUtc(d));
/** "3 nov" */
export const formatShortDay = (d: string) => shortFmt.format(toUtc(d));
