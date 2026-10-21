import type { CashClosed, Tenant } from "@/core/domain/types";
import { money } from "@/core/domain/order-rules";

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const when = (iso: string) => new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });

/** Cuadre de caja en ticketera de 80 mm (mismo formato que el ticket de venta). */
export function printCashReport(c: CashClosed, tenant: Tenant) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  const s = c.summary;
  const diff = Number(c.difference);
  const row = (label: string, value: string, cls = "") => `<tr class="${cls}"><td>${label}</td><td class="r">${value}</td></tr>`;
  const movements = s.movements
    .map((m) => row(`${m.kind === "in" ? "+" : "−"} ${esc(m.reason)}`, money(m.amount)))
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Cuadre de caja</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.35 ui-monospace, "JetBrains Mono", Menlo, monospace; color:#000; width: 74mm; margin: 0 auto; }
  .c { text-align:center } .r { text-align:right; white-space:nowrap } h1 { font-size: 15px; margin: 4px 0 2px }
  hr { border:0; border-top:1px dashed #000; margin:6px 0 } table { width:100%; border-collapse:collapse } td { padding: 2px 0 }
  .tot td { font-size: 14px; font-weight: 800 } .s { font-size: 11px }
</style></head><body>
  <div class="c"><h1>${esc(tenant.name)}</h1><div><b>CUADRE DE CAJA</b></div>
    <div class="s">Apertura: ${when(c.opened_at)}${c.opened_by_name ? ` · ${esc(c.opened_by_name)}` : ""}</div>
    <div class="s">Cierre: ${when(c.closed_at)}${c.closed_by_name ? ` · ${esc(c.closed_by_name)}` : ""}</div></div>
  <hr><table>
    ${row("Ventas del turno", money(s.total_sales))}${row("Pedidos cobrados", String(s.orders))}
    ${row("Efectivo", money(s.cash_sales))}${row("Yape", money(s.yape))}${row("Plin", money(s.plin))}${row("Tarjeta", money(s.card))}
  </table><hr><table>
    ${row("Apertura", money(s.opening))}${row("+ Ventas en efectivo", money(s.cash_sales))}
    ${row("+ Ingresos", money(s.cash_in))}${row("− Egresos", money(s.cash_out))}
    ${row("EFECTIVO ESPERADO", money(c.expected_cash), "tot")}${row("Efectivo contado", money(c.counted_cash), "tot")}
    ${row(diff === 0 ? "CUADRA" : diff > 0 ? "SOBRANTE" : "FALTANTE", money(Math.abs(diff)), "tot")}
  </table>
  ${movements ? `<hr><div><b>Movimientos</b></div><table>${movements}</table>` : ""}
  ${Number(s.cancelled_paid.orders) > 0 ? `<hr><div class="s">Anulados ya cobrados: ${s.cancelled_paid.orders} · ${money(s.cancelled_paid.amount)} (no suman al efectivo)</div>` : ""}
  ${c.notes ? `<hr><div class="s">Nota: ${esc(c.notes)}</div>` : ""}
  <hr><div class="c s">Firma: ____________________</div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},250)}</script>
</body></html>`);
  w.document.close();
}
