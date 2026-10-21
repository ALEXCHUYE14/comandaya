// Datos de contacto de MAFC (la marca detrás de MAFC Comanda).
// Para cambiarlos, edita sólo este archivo. El precio y los días de prueba se editan en /mafc.

/** WhatsApp de ventas de MAFC: aparece al pie de cada carta digital y en la página de inicio. */
export const MAFC_WHATSAPP = "51924996961";
export const MAFC_WHATSAPP_DISPLAY = "+51 924 996 961";

export const MAFC_TAGLINE = "Software a medida";

/** Plan por defecto si la base aún no expone public_plan() (mismos valores que schema.sql). */
export const DEFAULT_PLAN = { plan_name: "MAFC Comanda", monthly_price: 30, trial_days: 7, grace_days: 3 };
export type PublicPlan = typeof DEFAULT_PLAN;
