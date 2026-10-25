import { OrderTracking } from "@/features/public-menu/order-tracking";

export const metadata = { title: "Seguimiento de pedido", robots: { index: false, follow: false } };

export default async function TrackingPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  return <OrderTracking slug={slug} token={token} />;
}
