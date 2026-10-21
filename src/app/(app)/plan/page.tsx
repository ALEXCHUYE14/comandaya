import { PlanScreen } from "@/features/subscription/plan-screen";
import { isMercadoPagoConfigured } from "@/infrastructure/payments/mercadopago";

export const metadata = { title: "Mi plan" };

export default function PlanPage() {
  return <PlanScreen onlinePayments={isMercadoPagoConfigured()} />;
}
