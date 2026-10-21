// Entidades del dominio. Reflejan las tablas de supabase/schema.sql.

export type AppRole = "owner" | "admin" | "cashier" | "waiter" | "kitchen";
export type OrderStatus = "pending" | "preparing" | "ready" | "closed" | "cancelled";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "cash" | "card" | "yape" | "plin";
export type OrderSource = "pos" | "qr";
export type Station = "kitchen" | "bar";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface UserProfile {
  id: string;
  tenant_id: string | null;
  full_name: string;
  email: string | null;
  role: AppRole;
  is_active: boolean;
}

export interface BusinessSettings {
  tenant_id: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  logo_url: string | null;
  yape_qr_url: string | null;
  yape_number: string | null;
  plin_qr_url: string | null;
  plin_number: string | null;
  welcome_message: string | null;
  ticket_footer: string | null;
  currency: string;
  timezone: string;
  accept_qr_orders: boolean;
  kds_sound: boolean;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  station: Station;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface DiningTable {
  id: string;
  tenant_id: string;
  kind: "table" | "counter";
  label: string;
  capacity: number | null;
  public_code: string;
  is_active: boolean;
  sort_order: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  station: Station;
  unit_price: number;
  quantity: number;
  notes: string | null;
  line_total: number;
  created_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  ticket_number: number;
  business_date: string;
  order_type: OrderType;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount: number;
  total: number;
  amount_received: number | null;
  change_given: number | null;
  source: OrderSource;
  tracking_token: string;
  started_at: string | null;
  ready_at: string | null;
  closed_at: string | null;
  paid_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table: Pick<DiningTable, "id" | "label"> | null;
}

/** Línea de carrito antes de enviar el pedido (POS y carta pública). */
export interface CartLine {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

// ---- Contratos de las RPC públicas ----

export interface PublicMenu {
  tenant: { id: string; name: string; slug: string };
  settings: {
    logo_url: string | null;
    welcome_message: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    currency: string;
    accept_qr_orders: boolean;
    yape_qr_url: string | null;
    yape_number: string | null;
    plin_qr_url: string | null;
    plin_number: string | null;
  };
  categories: { id: string; name: string }[];
  products: Pick<
    Product,
    "id" | "category_id" | "name" | "description" | "price" | "image_url" | "is_available"
  >[];
  tables: { code: string; label: string }[];
}

/** Respuesta de la RPC sales_report (ver supabase/schema.sql 5.7b). */
export interface SalesReport {
  totals: { sales: number; orders: number; discounts: number; avg_ticket: number };
  cancelled: { orders: number; amount: number; paid_amount: number };
  unpaid: { orders: number; amount: number };
  by_method: { method: PaymentMethod | null; orders: number; total: number }[];
  by_type: { type: OrderType; orders: number; total: number }[];
  by_source: { source: OrderSource; orders: number; total: number }[];
  by_day: { day: string; orders: number; total: number }[];
  by_hour: { hour: number; orders: number; total: number }[];
  top_products: { name: string; qty: number; total: number }[];
  cancellations: {
    ticket: number;
    day: string;
    total: number;
    payment_status: PaymentStatus;
    reason: string | null;
    by_name: string | null;
    at: string | null;
  }[];
}

// ---- Caja (RPCs cash_* en supabase/schema.sql 5.7c) ----

export interface CashMovement {
  id: string;
  kind: "in" | "out";
  amount: number;
  reason: string;
  at: string;
  by_name: string | null;
}

export interface CashSummary {
  opening: number;
  cash_sales: number;
  yape: number;
  plin: number;
  card: number;
  total_sales: number;
  orders: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  cancelled_paid: { orders: number; amount: number };
  movements: CashMovement[];
}

export interface CashCurrent {
  id: string;
  opened_at: string;
  opening_amount: number;
  notes: string | null;
  opened_by_name: string | null;
  summary: CashSummary;
  unpaid_orders: number;
}

export interface CashClosed {
  id: string;
  opened_at: string;
  closed_at: string;
  opening_amount: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  notes: string | null;
  summary: CashSummary;
  opened_by_name: string | null;
  closed_by_name: string | null;
}

// ---- Planes MAFC (RPCs my_subscription / admin_* en supabase/schema.sql 5.7d) ----

export type SubscriptionState = "trial" | "active" | "grace" | "suspended" | "free";
export type SubscriptionPayMethod = "yape" | "plin" | "transfer" | "cash" | "card" | "mercadopago" | "other";

export interface SubscriptionInfo {
  state: SubscriptionState;
  has_access: boolean;
  plan_name: string;
  monthly_price: number;
  trial_ends_at: string;
  paid_until: string | null;
  access_end: string;
  grace_end: string;
  days_left: number;
  override: "suspended" | "free" | null;
}

export interface PlatformPayTo {
  yape_number: string | null;
  yape_qr_url: string | null;
  plin_number: string | null;
  whatsapp: string | null;
  bank_info: string | null;
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  months: number;
  method: SubscriptionPayMethod;
  reference?: string | null;
  period_from: string;
  period_to: string;
  created_at: string;
  voided_at?: string | null;
}

export interface MySubscription extends SubscriptionInfo {
  tenant: { id: string; name: string; slug: string };
  role: AppRole;
  pay_to: PlatformPayTo;
  payments: SubscriptionPayment[];
}

export interface AdminTenantRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  subscription: SubscriptionInfo | null;
  notes: string | null;
  owner: { name: string | null; email: string | null } | null;
  whatsapp: string | null;
  phone: string | null;
  staff: number;
  orders_30d: number;
  last_order_at: string | null;
  last_payment_at: string | null;
}

export interface PlatformSettings extends PlatformPayTo {
  plan_name: string;
  monthly_price: number;
  trial_days: number;
  grace_days: number;
}

export interface PublicOrder {
  ticket_number: number;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  customer_name: string | null;
  table_label: string | null;
  total: number;
  created_at: string;
  started_at: string | null;
  ready_at: string | null;
  items: { name: string; quantity: number; line_total: number; notes: string | null }[];
  business: {
    name: string;
    slug: string;
    logo_url: string | null;
    yape_qr_url: string | null;
    yape_number: string | null;
    plin_qr_url: string | null;
    plin_number: string | null;
    ticket_footer: string | null;
  };
}
