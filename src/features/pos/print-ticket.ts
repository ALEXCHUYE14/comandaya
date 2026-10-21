import type { BusinessSettings, OrderWithItems, Tenant } from "@/core/domain/types";
import { money, ORDER_TYPE_LABEL, PAYMENT_LABEL, ticketCode } from "@/core/domain/order-rules";

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Imprime un ticket de 80 mm (ticketeras térmicas) o 58 mm en una ventana aislada.
 * kind = "kitchen" omite precios (comanda para cocina).
 */
export function printTicket(order: OrderWithItems, tenant: Tenant, settings: BusinessSettings, kind: "customer" | "kitchen" = "customer") {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  const date = new Date(order.created_at).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
  const rows = order.order_items
    .map(
      (i) => `<tr><td class="q">${i.quantity}</td><td>${esc(i.product_name)}${i.notes ? `<div class="n">↳ ${esc(i.notes)}</div>` : ""}</td>${
        kind === "customer" ? `<td class="r">${money(i.line_total)}</td>` : ""
      }</tr>`,
    )
    .join("");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${ticketCode(order.ticket_number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.35 ui-monospace, "JetBrains Mono", Menlo, monospace; color:#000; width: 74mm; margin: 0 auto; }
  .c { text-align:center } .r { text-align:right; white-space:nowrap } .q { width: 22px; vertical-align: top; font-weight:700 }
  h1 { font-size: 15px; margin: 4px 0 2px } .big { font-size: 34px; font-weight: 800; letter-spacing: 1px; margin: 6px 0 }
  hr { border:0; border-top:1px dashed #000; margin:6px 0 } table { width:100%; border-collapse:collapse } td { padding: 2px 0 }
  .n { font-size: 11px; font-style: italic } .tot td { font-size: 14px; font-weight: 800 } img { max-width: 40mm; max-height: 22mm }
</style></head><body>
  <div class="c">
    ${settings.logo_url && kind === "customer" ? `<img src="${esc(settings.logo_url)}" alt="">` : ""}
    <h1>${esc(tenant.name)}</h1>
    ${kind === "customer" ? `${settings.tax_id ? `<div>${settings.tax_id.length === 11 ? "RUC" : "DNI"}: ${esc(settings.tax_id)}</div>` : ""}
    ${settings.address ? `<div>${esc(settings.address)}</div>` : ""}${settings.phone ? `<div>Tel: ${esc(settings.phone)}</div>` : ""}` : "<div><b>COMANDA COCINA</b></div>"}
    <hr><div>${kind === "customer" ? "TOKEN DE LLAMADO" : "PEDIDO"}</div>
    <div class="big">${ticketCode(order.ticket_number)}</div>
    <div><b>${ORDER_TYPE_LABEL[order.order_type]}${order.table ? ` · ${esc(order.table.label)}` : ""}</b>${order.customer_name ? ` · ${esc(order.customer_name)}` : ""}</div>
    <div>${date}</div>
  </div>
  <hr><table>${rows}</table>
  ${order.notes ? `<hr><div class="n">Nota: ${esc(order.notes)}</div>` : ""}
  ${kind === "customer" ? `<hr><table>
    ${Number(order.discount) > 0 ? `<tr><td>Subtotal</td><td class="r">${money(order.subtotal)}</td></tr><tr><td>Descuento</td><td class="r">-${money(order.discount)}</td></tr>` : ""}
    <tr class="tot"><td>TOTAL</td><td class="r">${money(order.total)}</td></tr>
    ${order.payment_status === "paid" && order.payment_method ? `<tr><td>Pagado con ${PAYMENT_LABEL[order.payment_method]}</td><td class="r">${money(order.amount_received ?? order.total)}</td></tr>` : "<tr><td>Estado</td><td class='r'>POR COBRAR</td></tr>"}
    ${Number(order.change_given) > 0 ? `<tr><td>Vuelto</td><td class="r">${money(order.change_given)}</td></tr>` : ""}
  </table><hr><div class="c">${esc(settings.ticket_footer)}</div><div class="c" style="font-size:10px;margin-top:4px">Documento no válido como comprobante de pago</div>` : ""}
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},250)}</script>
</body></html>`);
  w.document.close();
}
