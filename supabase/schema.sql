-- =============================================================================
--  MAFC Comanda · POS gastronómico multi-tenant
--  Migración inicial para Supabase (PostgreSQL 15+)
--
--  Ejecutar completo en: Supabase Dashboard → SQL Editor → New query → Run
--  El script es re-ejecutable: usa IF NOT EXISTS / DROP ... IF EXISTS.
--
--  Contenido
--   0. Extensiones y tipos
--   1. Tablas (tenants, users_profile, business_settings, categories,
--      products, tables_or_tokens, orders, order_items, ticket_counters,
--      qr_order_throttle, cash_sessions, cash_movements, platform_admins,
--      platform_settings, tenant_subscriptions, subscription_payments,
--      billing_checkouts)
--   2. Funciones auxiliares de seguridad (tenant actual, roles)
--   3. Triggers (updated_at, correlativo de tickets, totales, sellos de
--      tiempo por estado, guardas de rol, broadcast realtime al cliente)
--   4. Row Level Security
--   5. RPCs (onboarding, equipo, POS, carta pública, tracking, reportes, caja y planes MAFC)
--   6. Storage (logos, QR Yape/Plin, fotos de productos)
--   7. Realtime
--   8. Carta en vivo (broadcast de productos y datos del negocio)
-- =============================================================================

-- gen_random_uuid() es nativo desde PostgreSQL 13: no se requieren extensiones.

-- -----------------------------------------------------------------------------
-- 0. TIPOS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'cashier', 'waiter', 'kitchen');
exception when duplicate_object then null; end $$;

-- En Espera → En Preparación → Listo para Entrega → Cerrado (o Anulado)
do $$ begin
  create type public.order_status as enum ('pending', 'preparing', 'ready', 'closed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_type as enum ('dine_in', 'takeaway', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'card', 'yape', 'plin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_source as enum ('pos', 'qr');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. TABLAS
-- -----------------------------------------------------------------------------

-- Negocios (tenant raíz)
create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null unique
              check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Perfil de usuario ↔ negocio + rol
create table if not exists public.users_profile (
  id          uuid primary key references auth.users (id) on delete cascade,
  tenant_id   uuid references public.tenants (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  role        public.app_role not null default 'cashier',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists users_profile_tenant_idx on public.users_profile (tenant_id);

-- Ajustes y marca blanca (1:1 con tenant)
create table if not exists public.business_settings (
  tenant_id         uuid primary key references public.tenants (id) on delete cascade,
  legal_name        text,
  tax_id            text check (tax_id is null or tax_id ~ '^[0-9]{8}([0-9]{3})?$'), -- DNI (8) o RUC (11)
  address           text,
  phone             text,
  whatsapp          text,
  email             text,
  instagram         text,
  facebook          text,
  tiktok            text,
  logo_url          text,
  yape_qr_url       text,
  yape_number       text,
  plin_qr_url       text,
  plin_number       text,
  welcome_message   text default '¡Bienvenido! Pide desde tu celular y te avisamos cuando esté listo.',
  ticket_footer     text default '¡Gracias por tu preferencia!',
  currency          text not null default 'PEN',
  timezone          text not null default 'America/Lima',
  accept_qr_orders  boolean not null default true,
  kds_sound         boolean not null default true,
  updated_at        timestamptz not null default now()
);

-- Categorías de la carta
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, tenant_id)
);
create index if not exists categories_tenant_idx on public.categories (tenant_id, sort_order);

-- Productos
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  category_id   uuid,
  name          text not null check (char_length(name) between 1 and 80),
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  image_url     text,
  station       text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  is_available  boolean not null default true,   -- agotado hoy
  is_active     boolean not null default true,   -- visible en el sistema
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, tenant_id),
  -- FK compuesta: la categoría debe ser del mismo negocio
  foreign key (category_id, tenant_id)
    references public.categories (id, tenant_id) on delete set null (category_id)
);
create index if not exists products_tenant_idx on public.products (tenant_id, category_id, sort_order);

-- Mesas / puntos de atención (el QR de mesa usa public_code)
create table if not exists public.tables_or_tokens (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  kind         text not null default 'table' check (kind in ('table', 'counter')),
  label        text not null check (char_length(label) between 1 and 30),
  capacity     int check (capacity is null or capacity between 1 and 50),
  public_code  text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, tenant_id)
);
create index if not exists tables_tenant_idx on public.tables_or_tokens (tenant_id, sort_order);

-- Correlativo diario de tickets (sólo accesible vía funciones SECURITY DEFINER)
create table if not exists public.ticket_counters (
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  business_date  date not null,
  last_number    int not null default 0,
  primary key (tenant_id, business_date)
);

-- Registro breve de pedidos QR para frenar spam (sólo funciones SECURITY DEFINER)
create table if not exists public.qr_order_throttle (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  client_ip   text,
  created_at  timestamptz not null default now()
);
create index if not exists qr_order_throttle_idx on public.qr_order_throttle (tenant_id, created_at);

-- Turnos de caja (apertura → cierre con arqueo). Una caja abierta por negocio.
--   Sólo se escriben vía RPC (open/close/add_cash_movement): nadie edita un cuadre a mano.
create table if not exists public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  opened_by       uuid references public.users_profile (id) on delete set null,
  opened_at       timestamptz not null default now(),
  opening_amount  numeric(10, 2) not null default 0 check (opening_amount >= 0),
  closed_by       uuid references public.users_profile (id) on delete set null,
  closed_at       timestamptz,
  expected_cash   numeric(10, 2),
  counted_cash    numeric(10, 2) check (counted_cash is null or counted_cash >= 0),
  difference      numeric(10, 2),
  summary         jsonb,                       -- foto del cuadre al cerrar
  notes           text check (notes is null or char_length(notes) <= 300)
);
create unique index if not exists cash_sessions_one_open on public.cash_sessions (tenant_id) where closed_at is null;
create index if not exists cash_sessions_tenant_idx on public.cash_sessions (tenant_id, opened_at desc);

-- Ingresos y egresos de efectivo durante el turno (compra de hielo, pago a delivery…)
create table if not exists public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  session_id  uuid not null references public.cash_sessions (id) on delete cascade,
  kind        text not null check (kind in ('in', 'out')),
  amount      numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  reason      text not null check (char_length(reason) between 2 and 120),
  created_by  uuid references public.users_profile (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cash_movements_session_idx on public.cash_movements (session_id, created_at);

-- ── Plataforma MAFC: suscripciones de los negocios ──────────────────────────
-- Administradores de MAFC (no pertenecen a ningún negocio en particular).
-- Alta manual en el SQL Editor:
--   insert into public.platform_admins (user_id) select id from auth.users where email = 'TU_CORREO';
create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Configuración única del plan y de cómo pagarle a MAFC
create table if not exists public.platform_settings (
  id             boolean primary key default true check (id),
  plan_name      text not null default 'MAFC Comanda',
  monthly_price  numeric(10, 2) not null default 30 check (monthly_price >= 0),
  trial_days     int not null default 7 check (trial_days between 0 and 90),
  grace_days     int not null default 3 check (grace_days between 0 and 30),
  yape_number    text,
  yape_qr_url    text,
  plin_number    text,
  whatsapp       text,
  bank_info      text check (bank_info is null or char_length(bank_info) <= 300),
  updated_at     timestamptz not null default now()
);
-- Datos de cobro iniciales de MAFC (editables luego en /mafc → Plan y cobro)
insert into public.platform_settings (id, yape_number, plin_number, whatsapp)
values (true, '924996961', '924996961', '924996961')
on conflict (id) do nothing;

-- Suscripción de cada negocio. Acceso hasta max(fin de prueba, pagado hasta) + días de gracia.
--   override: 'suspended' (suspensión manual) o 'free' (cortesía, sin cobro)
create table if not exists public.tenant_subscriptions (
  tenant_id      uuid primary key references public.tenants (id) on delete cascade,
  trial_ends_at  timestamptz not null default (now() + interval '7 days'),
  paid_until     timestamptz,
  override       text check (override in ('suspended', 'free')),
  notes          text check (notes is null or char_length(notes) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Pagos registrados por MAFC (Yape, Plin, transferencia…)
create table if not exists public.subscription_payments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  amount       numeric(10, 2) not null check (amount >= 0),
  months       int not null check (months between 1 and 24),
  method       text not null check (method in ('yape', 'plin', 'transfer', 'cash', 'other')),
  reference    text check (reference is null or char_length(reference) <= 120),
  period_from  timestamptz not null,
  period_to    timestamptz not null,
  recorded_by  uuid references auth.users (id) on delete set null,
  voided_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists subscription_payments_tenant_idx on public.subscription_payments (tenant_id, created_at desc);
-- Pagos en línea (Mercado Pago): método tarjeta / billetera y n.º de pago del proveedor (sin duplicados)
alter table public.subscription_payments drop constraint if exists subscription_payments_method_check;
alter table public.subscription_payments add constraint subscription_payments_method_check
  check (method in ('yape', 'plin', 'transfer', 'cash', 'card', 'mercadopago', 'other'));
alter table public.subscription_payments add column if not exists provider_payment_id text;
create unique index if not exists subscription_payments_provider_uq
  on public.subscription_payments (provider_payment_id) where provider_payment_id is not null;

-- Intentos de pago en línea. El webhook confirma contra la API de Mercado Pago y recién
-- ahí se extiende el plan: el monto lo fija el servidor, nunca el navegador.
create table if not exists public.billing_checkouts (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  months               int not null check (months between 1 and 24),
  amount               numeric(10, 2) not null check (amount > 0),
  status               text not null default 'pending' check (status in ('pending', 'paid')),
  provider_payment_id  text,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);
create index if not exists billing_checkouts_tenant_idx on public.billing_checkouts (tenant_id, created_at desc);

-- Negocios que ya existían antes de los planes: arrancan con su prueba desde hoy
insert into public.tenant_subscriptions (tenant_id, trial_ends_at)
select t.id, now() + make_interval(days => (select trial_days from public.platform_settings))
from public.tenants t
where not exists (select 1 from public.tenant_subscriptions s where s.tenant_id = t.id);

-- Pedidos
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  ticket_number   int not null default 0,          -- lo asigna el trigger
  business_date   date not null default current_date,
  order_type      public.order_type not null default 'takeaway',
  table_id        uuid,
  customer_name   text check (customer_name is null or char_length(customer_name) <= 60),
  customer_phone  text check (customer_phone is null or char_length(customer_phone) <= 20),
  notes           text check (notes is null or char_length(notes) <= 300),
  status          public.order_status not null default 'pending',
  payment_status  public.payment_status not null default 'unpaid',
  payment_method  public.payment_method,
  subtotal        numeric(10, 2) not null default 0,
  discount        numeric(10, 2) not null default 0 check (discount >= 0),
  total           numeric(10, 2) not null default 0,
  amount_received numeric(10, 2),
  change_given    numeric(10, 2),
  source          public.order_source not null default 'pos',
  tracking_token  uuid not null unique default gen_random_uuid(),
  created_by      uuid references auth.users (id) on delete set null,
  started_at      timestamptz,
  ready_at        timestamptz,
  closed_at       timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, business_date, ticket_number),
  foreign key (table_id, tenant_id)
    references public.tables_or_tokens (id, tenant_id) on delete set null (table_id)
);
-- Auditoría de anulaciones (quién y por qué)
alter table public.orders add column if not exists cancelled_by uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists cancel_reason text
  check (cancel_reason is null or char_length(cancel_reason) <= 200);
-- Turno de caja en el que se cobró (lo asigna el trigger al cobrar)
alter table public.orders add column if not exists cash_session_id uuid references public.cash_sessions (id) on delete set null;
create index if not exists orders_cash_session_idx on public.orders (cash_session_id) where cash_session_id is not null;
create index if not exists orders_board_idx on public.orders (tenant_id, status, created_at);
create index if not exists orders_day_idx on public.orders (tenant_id, business_date desc);

-- Ítems del pedido (snapshot de nombre y precio)
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  order_id      uuid not null,
  product_id    uuid,
  product_name  text not null default '',
  station       text not null default 'kitchen',
  unit_price    numeric(10, 2) not null default 0 check (unit_price >= 0),
  quantity      int not null check (quantity between 1 and 99),
  notes         text check (notes is null or char_length(notes) <= 140),
  line_total    numeric(10, 2) generated always as (unit_price * quantity) stored,
  created_at    timestamptz not null default now(),
  foreign key (order_id, tenant_id)
    references public.orders (id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id)
    references public.products (id, tenant_id) on delete set null (product_id)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- -----------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES DE SEGURIDAD
-- -----------------------------------------------------------------------------

-- Estado de la suscripción de un negocio (prueba, activo, gracia, suspendido o cortesía)
create or replace function public._subscription_info(p_tenant uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with x as (
    select s.*, ps.monthly_price, ps.grace_days, ps.plan_name, t.is_active as tenant_active,
           greatest(s.trial_ends_at, coalesce(s.paid_until, s.trial_ends_at)) as access_end
    from public.tenant_subscriptions s
    join public.tenants t on t.id = s.tenant_id
    cross join public.platform_settings ps
    where s.tenant_id = p_tenant
  ),
  y as (
    select x.*, x.access_end + make_interval(days => x.grace_days) as grace_end,
      case
        when not x.tenant_active or x.override = 'suspended' then 'suspended'
        when x.override = 'free' then 'free'
        when now() < x.access_end then
          case when x.paid_until is not null and x.paid_until > now() then 'active' else 'trial' end
        when now() < x.access_end + make_interval(days => x.grace_days) then 'grace'
        else 'suspended'
      end as state
    from x
  )
  select jsonb_build_object(
    'state', y.state,
    'has_access', y.state <> 'suspended',
    'plan_name', y.plan_name,
    'monthly_price', y.monthly_price,
    'trial_ends_at', y.trial_ends_at,
    'paid_until', y.paid_until,
    'access_end', y.access_end,
    'grace_end', y.grace_end,
    'days_left', ceil(extract(epoch from (y.access_end - now())) / 86400)::int,
    'override', y.override
  )
  from y
$$;

-- ¿El negocio puede usar el sistema? Sin fila de suscripción no se bloquea (falla abierta).
create or replace function public.tenant_has_access(p_tenant uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((public._subscription_info(p_tenant) ->> 'has_access')::boolean, true)
$$;

-- Negocio del usuario autenticado (null si no pertenece a ninguno o está suspendido).
-- Todas las políticas RLS dependen de esta función: un negocio suspendido no lee ni
-- escribe nada, aunque llame a la API directamente.
create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select up.tenant_id
  from public.users_profile up
  join public.tenants t on t.id = up.tenant_id and t.is_active
  where up.id = auth.uid() and up.is_active and public.tenant_has_access(up.tenant_id)
$$;

-- ¿El usuario es administrador de la plataforma MAFC?
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
$$;

-- ¿El usuario tiene alguno de estos roles en su negocio?
create or replace function public.has_role(p_roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users_profile up
    where up.id = auth.uid() and up.is_active and up.role = any (p_roles)
  )
$$;

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS
-- -----------------------------------------------------------------------------

-- 3.1 updated_at automático
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tenants', 'users_profile', 'business_settings', 'categories',
                           'products', 'tables_or_tokens', 'orders', 'platform_settings',
                           'tenant_subscriptions']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- 3.1b Todo negocio nuevo arranca con su periodo de prueba
create or replace function public.tg_tenants_start_trial()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.tenant_subscriptions (tenant_id, trial_ends_at)
  values (new.id, now() + make_interval(days => coalesce((select trial_days from public.platform_settings), 7)))
  on conflict (tenant_id) do nothing;
  return null;
end $$;

drop trigger if exists tenants_start_trial on public.tenants;
create trigger tenants_start_trial after insert on public.tenants
  for each row execute function public.tg_tenants_start_trial();

-- 3.2 Correlativo de ticket por negocio y día (atómico, sin carreras)
create or replace function public.next_ticket_number(p_tenant uuid, p_date date)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v int;
begin
  insert into public.ticket_counters as tc (tenant_id, business_date, last_number)
  values (p_tenant, p_date, 1)
  on conflict (tenant_id, business_date)
    do update set last_number = tc.last_number + 1
  returning tc.last_number into v;
  return v;
end $$;

create or replace function public.tg_orders_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_tz text;
begin
  select bs.timezone into v_tz from public.business_settings bs where bs.tenant_id = new.tenant_id;
  new.business_date  := (now() at time zone coalesce(v_tz, 'America/Lima'))::date;
  new.ticket_number  := public.next_ticket_number(new.tenant_id, new.business_date);
  new.tracking_token := gen_random_uuid();
  new.subtotal := 0;
  new.total    := 0;
  if new.order_type <> 'dine_in' then
    new.table_id := null;
  end if;
  return new;
end $$;

drop trigger if exists orders_before_insert on public.orders;
create trigger orders_before_insert before insert on public.orders
  for each row execute function public.tg_orders_before_insert();

-- 3.3 Sellos de tiempo por cambio de estado, total y guardas de rol
--     La base de datos valida lo mismo que la interfaz: aunque alguien llame
--     a la API directamente, no puede cobrar, descontar ni anular sin permiso.
create or replace function public.tg_orders_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_money_changed boolean;
  v_session       uuid;
begin
  -- El turno de caja sólo lo asigna este trigger al cobrar. Un usuario no puede
  -- sacar una venta del cuadre; sí lo puede la base (borrado de turno → null).
  if pg_trigger_depth() <= 1 then
    new.cash_session_id := old.cash_session_id;
  end if;

  -- Campos inmutables
  new.tenant_id      := old.tenant_id;
  new.ticket_number  := old.ticket_number;
  new.business_date  := old.business_date;
  new.tracking_token := old.tracking_token;
  new.created_at     := old.created_at;
  new.created_by     := old.created_by;
  new.source         := old.source;

  -- El subtotal siempre sale de los ítems (no se acepta el que mande el cliente)
  new.subtotal := coalesce((select sum(oi.line_total) from public.order_items oi
                            where oi.order_id = old.id), 0);

  v_money_changed := new.payment_status is distinct from old.payment_status
                  or new.payment_method is distinct from old.payment_method
                  or new.discount is distinct from old.discount
                  or new.amount_received is distinct from old.amount_received
                  or new.change_given is distinct from old.change_given;

  -- Un pedido cerrado o anulado no se reabre
  if old.status in ('closed', 'cancelled') and new.status is distinct from old.status then
    raise exception 'El pedido ya está %', case old.status when 'closed' then 'cerrado' else 'anulado' end;
  end if;

  -- Lo cobrado no se modifica
  if old.payment_status = 'paid' and v_money_changed then
    raise exception 'El pedido ya fue cobrado: no se puede cambiar el pago ni el descuento';
  end if;

  -- Guardas por rol (sólo personal con sesión; las funciones internas sin sesión pasan)
  if auth.uid() is not null and not public.has_role(array['owner', 'admin', 'cashier']::public.app_role[]) then
    if public.has_role(array['kitchen']::public.app_role[])
       and (v_money_changed or (new.status in ('closed', 'cancelled') and new.status is distinct from old.status)) then
      raise exception 'El rol de cocina no puede cobrar, descontar ni cerrar pedidos';
    end if;
    if v_money_changed then
      raise exception 'Sólo caja o administración pueden cobrar o aplicar descuentos';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      raise exception 'Sólo caja o administración pueden anular pedidos';
    end if;
    if new.status = 'closed' and old.status <> 'closed' and old.payment_status <> 'paid' then
      raise exception 'Sólo caja puede cerrar un pedido sin cobrar';
    end if;
  end if;

  -- Auditoría de anulación: quién y por qué (no se puede reescribir después)
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_by  := auth.uid();
    new.cancel_reason := nullif(left(trim(coalesce(new.cancel_reason, '')), 200), '');
  else
    new.cancelled_by  := old.cancelled_by;
    new.cancel_reason := old.cancel_reason;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'preparing' then new.started_at := coalesce(new.started_at, now());
      when 'ready'     then new.ready_at   := coalesce(new.ready_at, now());
      when 'closed'    then new.closed_at  := now();
      when 'cancelled' then new.closed_at  := now();
      else null;
    end case;
  end if;

  new.total := greatest(new.subtotal - new.discount, 0);

  -- Al cobrar, el vuelto lo calcula el servidor con el total real
  if new.payment_status = 'paid' and old.payment_status = 'unpaid' then
    if new.payment_method is null then
      raise exception 'Indica el método de pago';
    end if;
    if new.payment_method = 'cash' then
      new.amount_received := coalesce(new.amount_received, new.total);
      if new.amount_received < new.total then
        raise exception 'El monto recibido (S/ %) es menor al total (S/ %)', new.amount_received, new.total;
      end if;
      new.change_given := new.amount_received - new.total;
    else
      new.amount_received := new.total;
      new.change_given    := 0;
    end if;
    new.paid_at := now();
    -- Entra al turno de caja abierto (si no hay caja abierta, queda sin turno)
    select cs.id into v_session from public.cash_sessions cs
     where cs.tenant_id = old.tenant_id and cs.closed_at is null;
    new.cash_session_id := v_session;
  elsif new.payment_status = 'unpaid' then
    new.paid_at := null;
  end if;

  return new;
end $$;

drop trigger if exists orders_before_update on public.orders;
create trigger orders_before_update before update on public.orders
  for each row execute function public.tg_orders_before_update();

-- 3.4 Ítems: snapshot de nombre/precio/estación desde el producto (no se confía en el cliente)
create or replace function public.tg_order_items_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare p record;
begin
  select pr.name, pr.price, pr.station, pr.is_active, pr.is_available
    into p
  from public.products pr
  where pr.id = new.product_id and pr.tenant_id = new.tenant_id;

  if not found then
    raise exception 'Producto no válido para este negocio';
  end if;
  if not p.is_active or not p.is_available then
    raise exception 'El producto "%" no está disponible', p.name;
  end if;

  new.product_name := p.name;
  new.unit_price   := p.price;
  new.station      := p.station;
  return new;
end $$;

drop trigger if exists order_items_before_insert on public.order_items;
create trigger order_items_before_insert before insert on public.order_items
  for each row execute function public.tg_order_items_before_insert();

-- 3.5 Recalcular subtotal/total del pedido cuando cambian sus ítems
create or replace function public.recalc_order_totals(p_order uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.orders o
     set subtotal = coalesce((select sum(oi.line_total) from public.order_items oi
                              where oi.order_id = p_order), 0)
   where o.id = p_order;
end $$;

create or replace function public.tg_order_items_after_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_order_totals(old.order_id);
    return old;
  end if;
  perform public.recalc_order_totals(new.order_id);
  return new;
end $$;

drop trigger if exists order_items_after_change on public.order_items;
create trigger order_items_after_change
  after insert or update or delete on public.order_items
  for each row execute function public.tg_order_items_after_change();

-- 3.5b Ítems: no se tocan en pedidos cobrados/cerrados y el precio no se edita a mano
create or replace function public.tg_order_items_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  o    record;
begin
  -- Acciones automáticas de llaves foráneas (borrar pedido/negocio en cascada,
  -- producto eliminado → product_id null): las hace la base, no un usuario
  if tg_op <> 'INSERT' and pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  foreach v_id in array array_remove(array[
    case when tg_op <> 'INSERT' then old.order_id end,
    case when tg_op <> 'DELETE' then new.order_id end], null)
  loop
    select ord.status, ord.payment_status into o from public.orders ord where ord.id = v_id;
    if found and (o.payment_status = 'paid' or o.status in ('closed', 'cancelled')) then
      raise exception 'El pedido ya fue cobrado o cerrado: no se pueden cambiar sus productos';
    end if;
  end loop;

  if tg_op = 'UPDATE' then
    -- Sólo cantidad y nota son editables; el resto es la foto del momento de la venta
    new.tenant_id    := old.tenant_id;
    new.order_id     := old.order_id;
    new.product_id   := old.product_id;
    new.product_name := old.product_name;
    new.station      := old.station;
    new.unit_price   := old.unit_price;
    new.created_at   := old.created_at;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists order_items_guard on public.order_items;
create trigger order_items_guard before insert or update or delete on public.order_items
  for each row execute function public.tg_order_items_guard();

-- 3.6 Guardas sobre users_profile: nadie se auto-asciende ni cambia de negocio
create or replace function public.tg_users_profile_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id and old.tenant_id is not null then
    raise exception 'No se puede mover un usuario a otro negocio';
  end if;
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if old.id = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol o estado';
    end if;
    if new.role = 'owner' and not public.has_role(array['owner']::public.app_role[]) then
      raise exception 'Sólo el propietario puede asignar el rol propietario';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists users_profile_guard on public.users_profile;
create trigger users_profile_guard before update on public.users_profile
  for each row execute function public.tg_users_profile_guard();

-- 3.7 Personal no administrador sólo puede marcar productos como agotados/disponibles
create or replace function public.tg_products_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.has_role(array['owner', 'admin']::public.app_role[])
     and (to_jsonb(new) - 'is_available' - 'updated_at')
         is distinct from (to_jsonb(old) - 'is_available' - 'updated_at') then
    raise exception 'Sólo puedes cambiar la disponibilidad del producto';
  end if;
  return new;
end $$;

drop trigger if exists products_guard on public.products;
create trigger products_guard before update on public.products
  for each row execute function public.tg_products_guard();

-- 3.8 Broadcast al cliente final (tracking público sin exponer la tabla)
--     Canal público: "order:<tracking_token>"  evento: "status"
create or replace function public.tg_orders_broadcast_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status then
    begin
      perform realtime.send(
        jsonb_build_object(
          'status', new.status,
          'payment_status', new.payment_status,
          'ready_at', new.ready_at,
          'updated_at', new.updated_at
        ),
        'status',
        'order:' || new.tracking_token::text,
        false
      );
    exception when others then
      -- Si Realtime Broadcast no está disponible, el cliente usa polling.
      null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists orders_broadcast_status on public.orders;
create trigger orders_broadcast_status after update on public.orders
  for each row execute function public.tg_orders_broadcast_status();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.tenants           enable row level security;
alter table public.users_profile     enable row level security;
alter table public.business_settings enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.tables_or_tokens  enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.ticket_counters   enable row level security; -- sin políticas: sólo funciones
alter table public.qr_order_throttle enable row level security; -- sin políticas: sólo funciones
alter table public.cash_sessions     enable row level security; -- lectura para caja; escritura sólo vía RPC
alter table public.cash_movements    enable row level security;
-- Plataforma MAFC: sin políticas, todo pasa por RPCs que validan is_platform_admin()
alter table public.platform_admins       enable row level security;
alter table public.platform_settings     enable row level security;
alter table public.tenant_subscriptions  enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.billing_checkouts     enable row level security;

drop policy if exists cash_sessions_select on public.cash_sessions;
create policy cash_sessions_select on public.cash_sessions for select to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin', 'cashier']::public.app_role[])));
drop policy if exists cash_movements_select on public.cash_movements;
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin', 'cashier']::public.app_role[])));

-- tenants
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select to authenticated
  using (id = (select public.current_tenant_id()));
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update to authenticated
  using (id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin']::public.app_role[])))
  with check (id = (select public.current_tenant_id()));

-- users_profile
drop policy if exists profile_select on public.users_profile;
create policy profile_select on public.users_profile for select to authenticated
  using (id = auth.uid() or tenant_id = (select public.current_tenant_id()));
drop policy if exists profile_update on public.users_profile;
create policy profile_update on public.users_profile for update to authenticated
  using (id = auth.uid()
         or (tenant_id = (select public.current_tenant_id())
             and (select public.has_role(array['owner', 'admin']::public.app_role[]))))
  with check (id = auth.uid() or tenant_id = (select public.current_tenant_id()));

-- business_settings
drop policy if exists settings_select on public.business_settings;
create policy settings_select on public.business_settings for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
drop policy if exists settings_update on public.business_settings;
create policy settings_update on public.business_settings for update to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin']::public.app_role[])))
  with check (tenant_id = (select public.current_tenant_id()));

-- Catálogo (categories, products, tables_or_tokens): todo el equipo lee, admin escribe
do $$
declare t text;
begin
  foreach t in array array['categories', 'products', 'tables_or_tokens']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                    using (tenant_id = (select public.current_tenant_id()))', t);
    execute format('drop policy if exists %1$s_write on public.%1$I', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated
                    using (tenant_id = (select public.current_tenant_id())
                           and (select public.has_role(array[''owner'',''admin'']::public.app_role[])))
                    with check (tenant_id = (select public.current_tenant_id())
                           and (select public.has_role(array[''owner'',''admin'']::public.app_role[])))', t);
  end loop;
end $$;

-- Productos: caja y mozos pueden marcar "agotado" (is_available)
drop policy if exists products_availability on public.products;
create policy products_availability on public.products for update to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['cashier', 'waiter', 'kitchen']::public.app_role[])))
  with check (tenant_id = (select public.current_tenant_id()));

-- orders
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (tenant_id = (select public.current_tenant_id())
              and (select public.has_role(array['owner', 'admin', 'cashier', 'waiter']::public.app_role[])));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin']::public.app_role[])));

-- order_items
drop policy if exists items_select on public.order_items;
create policy items_select on public.order_items for select to authenticated
  using (tenant_id = (select public.current_tenant_id()));
drop policy if exists items_write on public.order_items;
create policy items_write on public.order_items for all to authenticated
  using (tenant_id = (select public.current_tenant_id())
         and (select public.has_role(array['owner', 'admin', 'cashier', 'waiter']::public.app_role[])))
  with check (tenant_id = (select public.current_tenant_id())
              and (select public.has_role(array['owner', 'admin', 'cashier', 'waiter']::public.app_role[])));

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------

-- 5.1 Onboarding: crea el negocio y deja al usuario como propietario
create or replace function public.create_tenant(
  p_business_name text,
  p_slug          text,
  p_full_name     text,
  p_seed_demo     boolean default true
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_tenant uuid;
  c_cev uuid; c_bro uuid; c_ham uuid; c_beb uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if exists (select 1 from public.users_profile where id = v_uid and tenant_id is not null) then
    raise exception 'Tu usuario ya pertenece a un negocio';
  end if;

  insert into public.tenants (name, slug)
  values (trim(p_business_name), lower(trim(p_slug)))
  returning id into v_tenant;

  insert into public.users_profile (id, tenant_id, full_name, email, role)
  values (v_uid, v_tenant, coalesce(nullif(trim(p_full_name), ''), 'Propietario'),
          (select email from auth.users where id = v_uid), 'owner')
  on conflict (id) do update
    set tenant_id = excluded.tenant_id, role = 'owner', full_name = excluded.full_name,
        is_active = true;

  insert into public.business_settings (tenant_id, legal_name)
  values (v_tenant, trim(p_business_name));

  if p_seed_demo then
    insert into public.categories (tenant_id, name, sort_order) values (v_tenant, 'Ceviches', 1) returning id into c_cev;
    insert into public.categories (tenant_id, name, sort_order) values (v_tenant, 'Broaster', 2) returning id into c_bro;
    insert into public.categories (tenant_id, name, sort_order) values (v_tenant, 'Hamburguesas', 3) returning id into c_ham;
    insert into public.categories (tenant_id, name, sort_order) values (v_tenant, 'Bebidas', 4) returning id into c_beb;

    insert into public.products (tenant_id, category_id, name, description, price, station, sort_order) values
      (v_tenant, c_cev, 'Ceviche clásico',  'Pescado del día, limón, ají limo, camote y choclo', 22.00, 'kitchen', 1),
      (v_tenant, c_cev, 'Ceviche mixto',    'Pescado, pulpo, langostinos y conchas',             28.00, 'kitchen', 2),
      (v_tenant, c_cev, 'Leche de tigre',   'Con chicharrón de pota',                            12.00, 'kitchen', 3),
      (v_tenant, c_bro, '1/4 Broaster',     'Con papas fritas y ensalada',                       15.00, 'kitchen', 1),
      (v_tenant, c_bro, 'Alitas x6',        'BBQ o acevichadas',                                 16.00, 'kitchen', 2),
      (v_tenant, c_ham, 'Hamburguesa royal','Carne, huevo, queso, plátano',                      14.00, 'kitchen', 1),
      (v_tenant, c_ham, 'Salchipapa',       'Papas nativas y hot dog',                            10.00, 'kitchen', 2),
      (v_tenant, c_beb, 'Chicha morada 1L', 'Hecha en casa',                                       8.00, 'bar', 1),
      (v_tenant, c_beb, 'Inca Kola 500ml',  null,                                                  4.00, 'bar', 2),
      (v_tenant, c_beb, 'Limonada frozen',  null,                                                  7.00, 'bar', 3);

    insert into public.tables_or_tokens (tenant_id, label, capacity, sort_order)
    select v_tenant, 'Mesa ' || g, 4, g from generate_series(1, 6) g;
  end if;

  return v_tenant;
end $$;

-- 5.2 Agregar personal: el trabajador crea su cuenta y el dueño lo vincula por correo
create or replace function public.add_staff_member(p_email text, p_role public.app_role, p_full_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_user   uuid;
  v_name   text;
begin
  if v_tenant is null or not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'No autorizado';
  end if;
  if p_role = 'owner' and not public.has_role(array['owner']::public.app_role[]) then
    raise exception 'Sólo el propietario puede asignar otro propietario';
  end if;

  select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
    into v_user, v_name
  from auth.users u where lower(u.email) = lower(trim(p_email));

  if v_user is null then
    raise exception 'No existe una cuenta con ese correo. Pídele que se registre primero.';
  end if;
  if exists (select 1 from public.users_profile
             where id = v_user and tenant_id is not null and tenant_id <> v_tenant) then
    raise exception 'Ese usuario ya pertenece a otro negocio';
  end if;

  insert into public.users_profile (id, tenant_id, full_name, email, role, is_active)
  values (v_user, v_tenant, coalesce(nullif(trim(p_full_name), ''), v_name), lower(trim(p_email)), p_role, true)
  on conflict (id) do update
    set tenant_id = v_tenant, role = p_role, is_active = true,
        full_name = coalesce(nullif(trim(p_full_name), ''), public.users_profile.full_name);
  return v_user;
end $$;

-- 5.3 Inserción interna de pedido (atómica: cabecera + ítems)
--     p_items: [{ "product_id": uuid, "quantity": int, "notes": text }]
create or replace function public._insert_order(
  p_tenant        uuid,
  p_order_type    public.order_type,
  p_table_id      uuid,
  p_customer_name text,
  p_customer_phone text,
  p_notes         text,
  p_items         jsonb,
  p_source        public.order_source,
  p_created_by    uuid
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_item  jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Demasiados productos en un solo pedido';
  end if;
  if p_order_type = 'dine_in' and p_table_id is null then
    raise exception 'Selecciona una mesa';
  end if;

  insert into public.orders (tenant_id, order_type, table_id, customer_name, customer_phone,
                             notes, source, created_by)
  values (p_tenant, p_order_type, p_table_id, nullif(trim(p_customer_name), ''),
          nullif(trim(p_customer_phone), ''), nullif(trim(p_notes), ''), p_source, p_created_by)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (tenant_id, order_id, product_id, quantity, notes)
    values (p_tenant, v_order.id,
            (v_item ->> 'product_id')::uuid,
            least(greatest(coalesce((v_item ->> 'quantity')::int, 1), 1), 99),
            nullif(left(trim(coalesce(v_item ->> 'notes', '')), 140), ''));
  end loop;

  select * into v_order from public.orders where id = v_order.id;
  return v_order;
end $$;

-- 5.4 Pedido desde la caja / mozo
create or replace function public.pos_create_order(
  p_order_type     public.order_type,
  p_items          jsonb,
  p_table_id       uuid default null,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_notes          text default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null
     or not public.has_role(array['owner', 'admin', 'cashier', 'waiter']::public.app_role[]) then
    raise exception 'No autorizado';
  end if;
  return public._insert_order(v_tenant, p_order_type, p_table_id, p_customer_name,
                              p_customer_phone, p_notes, p_items, 'pos', auth.uid());
end $$;

-- 5.5 Carta pública (anon): datos de marca, categorías, productos y mesas
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'tenant', jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug),
    'settings', jsonb_build_object(
      'logo_url', bs.logo_url, 'welcome_message', bs.welcome_message,
      'address', bs.address, 'phone', bs.phone, 'whatsapp', bs.whatsapp,
      'instagram', bs.instagram, 'facebook', bs.facebook, 'tiktok', bs.tiktok,
      'currency', bs.currency, 'accept_qr_orders', bs.accept_qr_orders,
      'yape_qr_url', bs.yape_qr_url, 'yape_number', bs.yape_number,
      'plin_qr_url', bs.plin_qr_url, 'plin_number', bs.plin_number
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name)
      from public.categories c
      where c.tenant_id = t.id and c.is_active
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'category_id', p.category_id, 'name', p.name,
        'description', p.description, 'price', p.price, 'image_url', p.image_url,
        'is_available', p.is_available
      ) order by p.sort_order, p.name)
      from public.products p
      where p.tenant_id = t.id and p.is_active
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('code', tb.public_code, 'label', tb.label)
                       order by tb.sort_order, tb.label)
      from public.tables_or_tokens tb
      where tb.tenant_id = t.id and tb.is_active
    ), '[]'::jsonb)
  )
  from public.tenants t
  left join public.business_settings bs on bs.tenant_id = t.id
  where t.slug = lower(p_slug) and t.is_active and public.tenant_has_access(t.id)
$$;

-- 5.5b Límite anti-spam de la carta QR
--      Por dispositivo (IP): 12 pedidos cada 10 min (alcanza para un wifi de local lleno).
--      Por negocio: 60 pedidos QR cada 5 min (frena ataques desde muchas IPs).
create or replace function public._check_qr_rate(p_tenant uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_headers json;
  v_ip      text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    -- cf-connecting-ip lo pone Cloudflare (no se puede falsificar desde el cliente)
    v_ip := nullif(trim(split_part(coalesce(v_headers ->> 'cf-connecting-ip',
                                            v_headers ->> 'x-real-ip',
                                            v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  exception when others then
    v_ip := null;
  end;

  delete from public.qr_order_throttle
   where tenant_id = p_tenant and created_at < now() - interval '1 hour';

  if v_ip is not null and (
       select count(*) from public.qr_order_throttle q
       where q.tenant_id = p_tenant and q.client_ip = v_ip
         and q.created_at > now() - interval '10 minutes') >= 12 then
    raise exception 'Hiciste muchos pedidos seguidos. Espera unos minutos o pide en caja.';
  end if;
  if (select count(*) from public.qr_order_throttle q
      where q.tenant_id = p_tenant and q.created_at > now() - interval '5 minutes') >= 60 then
    raise exception 'Estamos recibiendo muchos pedidos en este momento. Intenta en unos minutos o pide en caja.';
  end if;

  insert into public.qr_order_throttle (tenant_id, client_ip) values (p_tenant, v_ip);
end $$;

-- 5.6 Auto-pedido del cliente desde la carta QR (anon)
create or replace function public.place_public_order(
  p_slug           text,
  p_order_type     public.order_type,
  p_items          jsonb,
  p_table_code     text default null,
  p_customer_name  text default null,
  p_customer_phone text default null,
  p_notes          text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
  v_accept boolean;
  v_table  uuid;
  v_order  public.orders;
begin
  select t.id, coalesce(bs.accept_qr_orders, true)
    into v_tenant, v_accept
  from public.tenants t
  left join public.business_settings bs on bs.tenant_id = t.id
  where t.slug = lower(p_slug) and t.is_active and public.tenant_has_access(t.id);

  if v_tenant is null then
    raise exception 'Negocio no encontrado';
  end if;
  if not v_accept then
    raise exception 'Este negocio no está recibiendo pedidos en línea en este momento';
  end if;
  if p_order_type = 'dine_in' then
    select id into v_table from public.tables_or_tokens
    where tenant_id = v_tenant and public_code = p_table_code and is_active;
    if v_table is null then
      raise exception 'Mesa no válida';
    end if;
  elsif nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'Indica tu nombre para llamarte cuando esté listo';
  end if;

  perform public._check_qr_rate(v_tenant);

  v_order := public._insert_order(v_tenant, p_order_type, v_table, p_customer_name,
                                  p_customer_phone, p_notes, p_items, 'qr', null);

  return jsonb_build_object(
    'tracking_token', v_order.tracking_token,
    'ticket_number', v_order.ticket_number,
    'total', v_order.total
  );
end $$;

-- 5.7 Tracking público del pedido (anon) por token no adivinable
create or replace function public.get_public_order(p_token uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'ticket_number', o.ticket_number,
    'order_type', o.order_type,
    'status', o.status,
    'payment_status', o.payment_status,
    'customer_name', o.customer_name,
    'table_label', tb.label,
    'total', o.total,
    'created_at', o.created_at,
    'started_at', o.started_at,
    'ready_at', o.ready_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', oi.product_name, 'quantity', oi.quantity,
                                          'line_total', oi.line_total, 'notes', oi.notes)
                       order by oi.created_at)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'business', jsonb_build_object(
      'name', t.name, 'slug', t.slug, 'logo_url', bs.logo_url,
      'yape_qr_url', bs.yape_qr_url, 'yape_number', bs.yape_number,
      'plin_qr_url', bs.plin_qr_url, 'plin_number', bs.plin_number,
      'ticket_footer', bs.ticket_footer
    )
  )
  from public.orders o
  join public.tenants t on t.id = o.tenant_id
  left join public.business_settings bs on bs.tenant_id = o.tenant_id
  left join public.tables_or_tokens tb on tb.id = o.table_id
  where o.tracking_token = p_token
$$;

-- 5.7b Reporte de ventas (dueño/administrador). Todo se agrega en el servidor:
--      una sola llamada y una respuesta pequeña, sin descargar pedido por pedido.
--      Venta = pedido cobrado y no anulado. Rango por fecha de negocio (hora local).
create or replace function public.sales_report(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_tz     text;
begin
  if v_tenant is null or not public.has_role(array['owner', 'admin']::public.app_role[]) then
    raise exception 'No autorizado';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Rango de fechas inválido';
  end if;
  if p_to - p_from > 366 then
    raise exception 'El rango máximo es de un año';
  end if;
  select coalesce(bs.timezone, 'America/Lima') into v_tz
  from public.business_settings bs where bs.tenant_id = v_tenant;
  v_tz := coalesce(v_tz, 'America/Lima');

  return (
    with o as (
      select * from public.orders
      where tenant_id = v_tenant and business_date between p_from and p_to
    ),
    s as (select * from o where payment_status = 'paid' and status <> 'cancelled')
    select jsonb_build_object(
      'totals', (select jsonb_build_object(
          'sales', coalesce(sum(s.total), 0),
          'orders', count(*),
          'discounts', coalesce(sum(s.discount), 0),
          'avg_ticket', coalesce(round(avg(s.total), 2), 0)
        ) from s),
      'cancelled', (select jsonb_build_object(
          'orders', count(*),
          'amount', coalesce(sum(o.total), 0),
          'paid_amount', coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0)
        ) from o where o.status = 'cancelled'),
      'unpaid', (select jsonb_build_object('orders', count(*), 'amount', coalesce(sum(o.total), 0))
        from o where o.payment_status = 'unpaid' and o.status <> 'cancelled'),
      'by_method', coalesce((select jsonb_agg(x order by x.total desc) from (
          select s.payment_method as method, count(*) as orders, sum(s.total) as total
          from s group by s.payment_method) x), '[]'::jsonb),
      'by_type', coalesce((select jsonb_agg(x order by x.total desc) from (
          select s.order_type as type, count(*) as orders, sum(s.total) as total
          from s group by s.order_type) x), '[]'::jsonb),
      'by_source', coalesce((select jsonb_agg(x order by x.total desc) from (
          select s.source, count(*) as orders, sum(s.total) as total
          from s group by s.source) x), '[]'::jsonb),
      'by_day', coalesce((select jsonb_agg(x order by x.day) from (
          select s.business_date as day, count(*) as orders, sum(s.total) as total
          from s group by s.business_date) x), '[]'::jsonb),
      'by_hour', coalesce((select jsonb_agg(x order by x.hour) from (
          select extract(hour from (s.created_at at time zone v_tz))::int as hour,
                 count(*) as orders, sum(s.total) as total
          from s group by 1) x), '[]'::jsonb),
      'top_products', coalesce((select jsonb_agg(x order by x.total desc, x.qty desc) from (
          select oi.product_name as name, sum(oi.quantity) as qty, sum(oi.line_total) as total
          from public.order_items oi join s on s.id = oi.order_id
          group by oi.product_name order by sum(oi.line_total) desc limit 10) x), '[]'::jsonb),
      'cancellations', coalesce((select jsonb_agg(x order by x.at desc) from (
          select o.ticket_number as ticket, o.business_date as day, o.total, o.payment_status,
                 o.cancel_reason as reason, coalesce(nullif(up.full_name, ''), up.email) as by_name, o.closed_at as at
          from o left join public.users_profile up on up.id = o.cancelled_by
          where o.status = 'cancelled' order by o.closed_at desc nulls last limit 30) x), '[]'::jsonb)
    )
  );
end $$;

-- 5.7c Caja: apertura, movimientos, arqueo y cierre
--      Efectivo esperado = apertura + ventas en efectivo + ingresos − egresos.
--      Un pedido cobrado y luego anulado no suma (se asume devolución) y se
--      muestra aparte para que el dueño lo revise.
create or replace function public._cash_summary(p_session uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with cs as (select * from public.cash_sessions where id = p_session),
  o as (select * from public.orders where cash_session_id = p_session and payment_status = 'paid'),
  v as (select * from o where status <> 'cancelled'),
  m as (select * from public.cash_movements where session_id = p_session),
  calc as (
    select
      (select opening_amount from cs) as opening,
      coalesce((select sum(total) from v where payment_method = 'cash'), 0) as cash_sales,
      coalesce((select sum(amount) from m where kind = 'in'), 0) as cash_in,
      coalesce((select sum(amount) from m where kind = 'out'), 0) as cash_out
  )
  select jsonb_build_object(
    'opening', calc.opening,
    'cash_sales', calc.cash_sales,
    'yape', coalesce((select sum(total) from v where payment_method = 'yape'), 0),
    'plin', coalesce((select sum(total) from v where payment_method = 'plin'), 0),
    'card', coalesce((select sum(total) from v where payment_method = 'card'), 0),
    'total_sales', coalesce((select sum(total) from v), 0),
    'orders', (select count(*) from v),
    'cash_in', calc.cash_in,
    'cash_out', calc.cash_out,
    'expected_cash', calc.opening + calc.cash_sales + calc.cash_in - calc.cash_out,
    'cancelled_paid', jsonb_build_object(
      'orders', (select count(*) from o where status = 'cancelled'),
      'amount', coalesce((select sum(total) from o where status = 'cancelled'), 0)),
    'movements', coalesce((select jsonb_agg(jsonb_build_object(
        'id', mv.id, 'kind', mv.kind, 'amount', mv.amount, 'reason', mv.reason, 'at', mv.created_at,
        'by_name', coalesce(nullif(up.full_name, ''), up.email)) order by mv.created_at)
      from m mv left join public.users_profile up on up.id = mv.created_by), '[]'::jsonb)
  )
  from calc
$$;

create or replace function public._cash_guard()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null or not public.has_role(array['owner', 'admin', 'cashier']::public.app_role[]) then
    raise exception 'Sólo caja o administración pueden manejar la caja';
  end if;
  return v_tenant;
end $$;

-- Caja abierta con su cuadre en vivo (null si está cerrada)
create or replace function public.cash_current()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tenant uuid := public._cash_guard();
  s public.cash_sessions;
begin
  select * into s from public.cash_sessions where tenant_id = v_tenant and closed_at is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', s.id, 'opened_at', s.opened_at, 'opening_amount', s.opening_amount, 'notes', s.notes,
    'opened_by_name', (select coalesce(nullif(full_name, ''), email) from public.users_profile where id = s.opened_by),
    'summary', public._cash_summary(s.id),
    'unpaid_orders', (select count(*) from public.orders
                      where tenant_id = v_tenant and payment_status = 'unpaid'
                        and status not in ('cancelled', 'closed'))
  );
end $$;

create or replace function public.open_cash_session(p_opening numeric, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid := public._cash_guard();
  v_id     uuid;
begin
  if p_opening is null or p_opening < 0 or p_opening > 100000 then
    raise exception 'Monto de apertura inválido';
  end if;
  insert into public.cash_sessions (tenant_id, opened_by, opening_amount, notes)
  values (v_tenant, auth.uid(), round(p_opening, 2), nullif(left(trim(coalesce(p_notes, '')), 300), ''))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Ya hay una caja abierta. Ciérrala antes de abrir otra.';
end $$;

create or replace function public.add_cash_movement(p_kind text, p_amount numeric, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant  uuid := public._cash_guard();
  v_session uuid;
  v_id      uuid;
begin
  select id into v_session from public.cash_sessions where tenant_id = v_tenant and closed_at is null;
  if v_session is null then
    raise exception 'Abre la caja antes de registrar movimientos';
  end if;
  if p_kind not in ('in', 'out') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'Monto inválido';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception 'Escribe el motivo del movimiento';
  end if;
  insert into public.cash_movements (tenant_id, session_id, kind, amount, reason, created_by)
  values (v_tenant, v_session, p_kind, round(p_amount, 2), left(trim(p_reason), 120), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Cierre con arqueo: guarda la foto del cuadre; ya no se puede modificar
create or replace function public.close_cash_session(p_counted numeric, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant  uuid := public._cash_guard();
  s         public.cash_sessions;
  v_summary jsonb;
  v_expected numeric(10, 2);
begin
  if p_counted is null or p_counted < 0 or p_counted > 1000000 then
    raise exception 'Monto contado inválido';
  end if;
  select * into s from public.cash_sessions
   where tenant_id = v_tenant and closed_at is null for update;
  if not found then
    raise exception 'No hay una caja abierta';
  end if;

  v_summary  := public._cash_summary(s.id);
  v_expected := (v_summary ->> 'expected_cash')::numeric;

  update public.cash_sessions
     set closed_at = now(), closed_by = auth.uid(), summary = v_summary,
         expected_cash = v_expected, counted_cash = round(p_counted, 2),
         difference = round(p_counted, 2) - v_expected,
         notes = coalesce(nullif(left(trim(coalesce(p_notes, '')), 300), ''), notes)
   where id = s.id
  returning * into s;

  return jsonb_build_object(
    'id', s.id, 'opened_at', s.opened_at, 'closed_at', s.closed_at,
    'opening_amount', s.opening_amount, 'expected_cash', s.expected_cash,
    'counted_cash', s.counted_cash, 'difference', s.difference, 'notes', s.notes,
    'summary', s.summary,
    'opened_by_name', (select coalesce(nullif(full_name, ''), email) from public.users_profile where id = s.opened_by),
    'closed_by_name', (select coalesce(nullif(full_name, ''), email) from public.users_profile where id = s.closed_by)
  );
end $$;

-- Últimos cierres (historial y reimpresión)
create or replace function public.cash_history(p_limit int default 20)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_tenant uuid := public._cash_guard();
begin
  return coalesce((
    select jsonb_agg(x order by x.closed_at desc) from (
      select cs.id, cs.opened_at, cs.closed_at, cs.opening_amount, cs.expected_cash,
             cs.counted_cash, cs.difference, cs.notes, cs.summary,
             coalesce(nullif(o.full_name, ''), o.email) as opened_by_name,
             coalesce(nullif(c.full_name, ''), c.email) as closed_by_name
      from public.cash_sessions cs
      left join public.users_profile o on o.id = cs.opened_by
      left join public.users_profile c on c.id = cs.closed_by
      where cs.tenant_id = v_tenant and cs.closed_at is not null
      order by cs.closed_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) x
  ), '[]'::jsonb);
end $$;

-- 5.7d Suscripción: vista del negocio y panel de administración MAFC

-- Precio público del plan para la página de inicio (sólo datos comerciales, nada de cobro)
create or replace function public.public_plan()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('plan_name', ps.plan_name, 'monthly_price', ps.monthly_price,
                            'trial_days', ps.trial_days, 'grace_days', ps.grace_days)
  from public.platform_settings ps limit 1
$$;

-- Plan del negocio del usuario. No usa current_tenant_id() a propósito: un negocio
-- suspendido también debe poder ver cuánto debe y cómo pagar.
create or replace function public.my_subscription()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  up public.users_profile;
  ps public.platform_settings;
  v_manager boolean;
begin
  select * into up from public.users_profile where id = auth.uid() and is_active;
  if up.tenant_id is null then
    return null;
  end if;
  select * into ps from public.platform_settings limit 1;
  v_manager := up.role in ('owner', 'admin');
  return coalesce(public._subscription_info(up.tenant_id), '{}'::jsonb) || jsonb_build_object(
    'tenant', (select jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug) from public.tenants t where t.id = up.tenant_id),
    'role', up.role,
    'pay_to', jsonb_build_object(
      'yape_number', ps.yape_number, 'yape_qr_url', ps.yape_qr_url, 'plin_number', ps.plin_number,
      'whatsapp', ps.whatsapp, 'bank_info', ps.bank_info),
    'payments', case when v_manager then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'months', p.months, 'method', p.method,
                                          'period_from', p.period_from, 'period_to', p.period_to, 'created_at', p.created_at)
                       order by p.created_at desc)
      from public.subscription_payments p where p.tenant_id = up.tenant_id and p.voided_at is null), '[]'::jsonb)
      else '[]'::jsonb end
  );
end $$;

create or replace function public._platform_guard()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Sólo administradores de MAFC';
  end if;
end $$;

-- Todos los negocios con su estado, dueño y actividad
create or replace function public.admin_list_tenants()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select t.id, t.name, t.slug, t.created_at,
             public._subscription_info(t.id) as subscription,
             s.notes,
             (select jsonb_build_object('name', coalesce(nullif(up.full_name, ''), up.email), 'email', up.email)
                from public.users_profile up where up.tenant_id = t.id and up.role = 'owner'
                order by up.created_at limit 1) as owner,
             bs.whatsapp, bs.phone,
             (select count(*) from public.users_profile up where up.tenant_id = t.id and up.is_active) as staff,
             (select count(*) from public.orders o where o.tenant_id = t.id and o.created_at > now() - interval '30 days') as orders_30d,
             (select max(o.created_at) from public.orders o where o.tenant_id = t.id) as last_order_at,
             (select max(p.created_at) from public.subscription_payments p where p.tenant_id = t.id and p.voided_at is null) as last_payment_at
      from public.tenants t
      left join public.tenant_subscriptions s on s.tenant_id = t.id
      left join public.business_settings bs on bs.tenant_id = t.id
    ) x
  ), '[]'::jsonb);
end $$;

-- Pagos de un negocio (incluye anulados, para auditoría)
create or replace function public.admin_tenant_payments(p_tenant uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'amount', p.amount, 'months', p.months, 'method', p.method,
                                        'reference', p.reference, 'period_from', p.period_from, 'period_to', p.period_to,
                                        'created_at', p.created_at, 'voided_at', p.voided_at) order by p.created_at desc)
    from public.subscription_payments p where p.tenant_id = p_tenant
  ), '[]'::jsonb);
end $$;

-- Extiende el acceso desde el último vencimiento (o desde hoy si ya venció).
-- Si paga durante la prueba, no pierde los días de prueba que le quedan.
-- La usan el registro manual (panel MAFC) y la confirmación de Mercado Pago.
create or replace function public._extend_subscription(
  p_tenant uuid, p_months int, p_amount numeric, p_method text, p_reference text,
  p_recorded_by uuid, p_provider_payment_id text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  s      public.tenant_subscriptions;
  v_from timestamptz;
  v_to   timestamptz;
begin
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'Meses inválidos (1 a 24)';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Monto inválido';
  end if;
  select * into s from public.tenant_subscriptions where tenant_id = p_tenant for update;
  if not found then
    raise exception 'Negocio no encontrado';
  end if;

  v_from := greatest(now(), coalesce(s.paid_until, s.trial_ends_at), s.trial_ends_at);
  v_to   := v_from + make_interval(months => p_months);

  insert into public.subscription_payments (tenant_id, amount, months, method, reference, period_from, period_to,
                                            recorded_by, provider_payment_id)
  values (p_tenant, round(p_amount, 2), p_months, p_method, nullif(left(trim(coalesce(p_reference, '')), 120), ''),
          v_from, v_to, p_recorded_by, p_provider_payment_id);

  -- Pagar levanta una suspensión manual; la cortesía ('free') se mantiene
  update public.tenant_subscriptions
     set paid_until = v_to, override = case when override = 'suspended' then null else override end
   where tenant_id = p_tenant;
  return public._subscription_info(p_tenant);
end $$;

create or replace function public.admin_record_payment(
  p_tenant uuid, p_months int, p_amount numeric, p_method text, p_reference text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  return public._extend_subscription(p_tenant, p_months, p_amount, p_method, p_reference, auth.uid());
end $$;

-- Pago en línea, paso 1: el dueño elige meses; el monto lo calcula el servidor.
-- No usa current_tenant_id(): un negocio suspendido también tiene que poder pagar.
create or replace function public.billing_create_checkout(p_months int)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  up public.users_profile;
  ps public.platform_settings;
  c  public.billing_checkouts;
begin
  select * into up from public.users_profile where id = auth.uid() and is_active;
  if up.tenant_id is null or up.role not in ('owner', 'admin') then
    raise exception 'Sólo el dueño o un administrador pueden pagar el plan';
  end if;
  if p_months is null or p_months not in (1, 3, 6, 12) then
    raise exception 'Elige 1, 3, 6 o 12 meses';
  end if;
  select * into ps from public.platform_settings limit 1;
  if coalesce(ps.monthly_price, 0) <= 0 then
    raise exception 'El plan no tiene precio configurado';
  end if;
  -- Limpieza: intentos abandonados de más de 3 días
  delete from public.billing_checkouts
   where tenant_id = up.tenant_id and status = 'pending' and created_at < now() - interval '3 days';
  if (select count(*) from public.billing_checkouts
      where tenant_id = up.tenant_id and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'Demasiados intentos de pago. Espera unos minutos.';
  end if;

  insert into public.billing_checkouts (tenant_id, months, amount, created_by)
  values (up.tenant_id, p_months, round(ps.monthly_price * p_months, 2), auth.uid())
  returning * into c;

  return jsonb_build_object(
    'id', c.id, 'months', c.months, 'amount', c.amount, 'plan_name', ps.plan_name,
    'tenant', (select jsonb_build_object('name', t.name, 'slug', t.slug) from public.tenants t where t.id = up.tenant_id),
    'payer_email', (select email from auth.users where id = auth.uid())
  );
end $$;

-- Pago en línea, paso 2: sólo el servidor (service_role) lo llama, después de leer el
-- pago directamente de la API de Mercado Pago. Idempotente: el mismo pago no suma dos veces.
create or replace function public.billing_confirm_payment(
  p_checkout uuid, p_provider_payment_id text, p_amount numeric, p_currency text, p_method text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c public.billing_checkouts;
begin
  select * into c from public.billing_checkouts where id = p_checkout for update;
  if not found then
    raise exception 'Intento de pago no encontrado';
  end if;
  if c.status = 'paid' then
    return jsonb_build_object('status', 'already_paid', 'subscription', public._subscription_info(c.tenant_id));
  end if;
  if exists (select 1 from public.subscription_payments where provider_payment_id = p_provider_payment_id) then
    return jsonb_build_object('status', 'already_paid', 'subscription', public._subscription_info(c.tenant_id));
  end if;
  if upper(coalesce(p_currency, '')) <> 'PEN' then
    raise exception 'Moneda inválida: %', p_currency;
  end if;
  if p_amount is null or p_amount + 0.009 < c.amount then
    raise exception 'Monto pagado (%) menor al esperado (%)', p_amount, c.amount;
  end if;

  perform public._extend_subscription(c.tenant_id, c.months, p_amount,
    case when p_method in ('yape', 'card', 'mercadopago') then p_method else 'mercadopago' end,
    'Mercado Pago #' || p_provider_payment_id, c.created_by, p_provider_payment_id);
  update public.billing_checkouts
     set status = 'paid', provider_payment_id = p_provider_payment_id, paid_at = now()
   where id = c.id;
  return jsonb_build_object('status', 'paid', 'subscription', public._subscription_info(c.tenant_id));
end $$;

-- Anular un pago registrado por error: devuelve el vencimiento los meses que cubría
create or replace function public.admin_void_payment(p_payment uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare p public.subscription_payments;
begin
  perform public._platform_guard();
  select * into p from public.subscription_payments where id = p_payment and voided_at is null for update;
  if not found then
    raise exception 'Pago no encontrado o ya anulado';
  end if;
  update public.subscription_payments set voided_at = now() where id = p.id;
  update public.tenant_subscriptions
     set paid_until = case
           when paid_until is null then null
           when paid_until - make_interval(months => p.months) <= trial_ends_at then null
           else paid_until - make_interval(months => p.months) end
   where tenant_id = p.tenant_id;
  return public._subscription_info(p.tenant_id);
end $$;

-- Suspender, dar cortesía o volver a lo normal; también extender la prueba
create or replace function public.admin_set_subscription(
  p_tenant uuid, p_override text default null, p_extend_trial_days int default 0, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  if p_override is not null and p_override not in ('suspended', 'free') then
    raise exception 'Estado inválido';
  end if;
  if coalesce(p_extend_trial_days, 0) not between 0 and 90 then
    raise exception 'Días de prueba inválidos (0 a 90)';
  end if;
  update public.tenant_subscriptions
     set override = p_override,
         trial_ends_at = case when coalesce(p_extend_trial_days, 0) > 0
                              then greatest(trial_ends_at, now()) + make_interval(days => p_extend_trial_days)
                              else trial_ends_at end,
         notes = coalesce(nullif(left(trim(coalesce(p_notes, '')), 300), ''), notes)
   where tenant_id = p_tenant;
  if not found then
    raise exception 'Negocio no encontrado';
  end if;
  return public._subscription_info(p_tenant);
end $$;

create or replace function public.admin_get_platform_settings()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  return (select to_jsonb(ps) - 'id' from public.platform_settings ps limit 1);
end $$;

create or replace function public.admin_update_platform_settings(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._platform_guard();
  update public.platform_settings set
    plan_name     = coalesce(nullif(trim(p ->> 'plan_name'), ''), plan_name),
    monthly_price = coalesce((p ->> 'monthly_price')::numeric, monthly_price),
    trial_days    = coalesce((p ->> 'trial_days')::int, trial_days),
    grace_days    = coalesce((p ->> 'grace_days')::int, grace_days),
    yape_number   = nullif(trim(p ->> 'yape_number'), ''),
    yape_qr_url   = nullif(trim(p ->> 'yape_qr_url'), ''),
    plin_number   = nullif(trim(p ->> 'plin_number'), ''),
    whatsapp      = nullif(trim(p ->> 'whatsapp'), ''),
    bank_info     = nullif(left(trim(p ->> 'bank_info'), 300), '')
  where id;
  return (select to_jsonb(ps) - 'id' from public.platform_settings ps limit 1);
end $$;

-- 5.8 Permisos de ejecución
revoke execute on function public.next_ticket_number(uuid, date) from public, anon, authenticated;
revoke execute on function public.recalc_order_totals(uuid) from public, anon, authenticated;
revoke execute on function public._insert_order(uuid, public.order_type, uuid, text, text, text, jsonb, public.order_source, uuid) from public, anon, authenticated;
revoke execute on function public._check_qr_rate(uuid) from public, anon, authenticated;
revoke execute on function public.create_tenant(text, text, text, boolean) from public, anon;
revoke execute on function public.add_staff_member(text, public.app_role, text) from public, anon;
revoke execute on function public.pos_create_order(public.order_type, jsonb, uuid, text, text, text) from public, anon;

grant execute on function public.create_tenant(text, text, text, boolean) to authenticated;
grant execute on function public.add_staff_member(text, public.app_role, text) to authenticated;
grant execute on function public.pos_create_order(public.order_type, jsonb, uuid, text, text, text) to authenticated;
revoke execute on function public.sales_report(date, date) from public, anon;
grant execute on function public.sales_report(date, date) to authenticated;
revoke execute on function public._cash_summary(uuid) from public, anon, authenticated;
revoke execute on function public._cash_guard() from public, anon, authenticated;
revoke execute on function public.cash_current() from public, anon;
revoke execute on function public.open_cash_session(numeric, text) from public, anon;
revoke execute on function public.add_cash_movement(text, numeric, text) from public, anon;
revoke execute on function public.close_cash_session(numeric, text) from public, anon;
revoke execute on function public.cash_history(int) from public, anon;
grant execute on function public.cash_current() to authenticated;
grant execute on function public.open_cash_session(numeric, text) to authenticated;
grant execute on function public.add_cash_movement(text, numeric, text) to authenticated;
grant execute on function public.close_cash_session(numeric, text) to authenticated;
grant execute on function public.cash_history(int) to authenticated;
revoke execute on function public._subscription_info(uuid) from public, anon, authenticated;
revoke execute on function public._platform_guard() from public, anon, authenticated;
revoke execute on function public.my_subscription() from public, anon;
revoke execute on function public.admin_list_tenants() from public, anon;
revoke execute on function public.admin_tenant_payments(uuid) from public, anon;
revoke execute on function public.admin_record_payment(uuid, int, numeric, text, text) from public, anon;
revoke execute on function public.admin_void_payment(uuid) from public, anon;
revoke execute on function public.admin_set_subscription(uuid, text, int, text) from public, anon;
revoke execute on function public.admin_get_platform_settings() from public, anon;
revoke execute on function public.admin_update_platform_settings(jsonb) from public, anon;
grant execute on function public.my_subscription() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_list_tenants() to authenticated;
grant execute on function public.admin_tenant_payments(uuid) to authenticated;
grant execute on function public.admin_record_payment(uuid, int, numeric, text, text) to authenticated;
grant execute on function public.admin_void_payment(uuid) to authenticated;
grant execute on function public.admin_set_subscription(uuid, text, int, text) to authenticated;
grant execute on function public.admin_get_platform_settings() to authenticated;
grant execute on function public.admin_update_platform_settings(jsonb) to authenticated;
revoke execute on function public._extend_subscription(uuid, int, numeric, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.billing_create_checkout(int) from public, anon;
grant execute on function public.billing_create_checkout(int) to authenticated;
-- Confirmar un pago sólo desde el servidor (clave secreta de Supabase), nunca desde el navegador
revoke execute on function public.billing_confirm_payment(uuid, text, numeric, text, text) from public, anon, authenticated;
do $$ begin
  grant execute on function public.billing_confirm_payment(uuid, text, numeric, text, text) to service_role;
exception when undefined_object then null; end $$;
grant execute on function public.public_plan() to anon, authenticated;
grant execute on function public.get_public_menu(text) to anon, authenticated;
grant execute on function public.place_public_order(text, public.order_type, jsonb, text, text, text, text) to anon, authenticated;
grant execute on function public.get_public_order(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. STORAGE: bucket público de assets; escritura sólo en la carpeta del negocio
--    Ruta: <tenant_id>/<tipo>/<archivo>   (tipo = logo | yape | plin | products)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-assets', 'tenant-assets', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tenant_assets_insert" on storage.objects;
create policy "tenant_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-assets'
              and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
              and (select public.has_role(array['owner', 'admin']::public.app_role[])));

-- QR de cobro de MAFC (carpeta "platform/"): sólo administradores de la plataforma
drop policy if exists "platform_assets_insert" on storage.objects;
create policy "platform_assets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-assets'
              and (storage.foldername(name))[1] = 'platform'
              and (select public.is_platform_admin()));
drop policy if exists "platform_assets_delete" on storage.objects;
create policy "platform_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-assets'
         and (storage.foldername(name))[1] = 'platform'
         and (select public.is_platform_admin()));

drop policy if exists "tenant_assets_update" on storage.objects;
create policy "tenant_assets_update" on storage.objects for update to authenticated
  using (bucket_id = 'tenant-assets'
         and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
         and (select public.has_role(array['owner', 'admin']::public.app_role[])));

drop policy if exists "tenant_assets_delete" on storage.objects;
create policy "tenant_assets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-assets'
         and (storage.foldername(name))[1] = (select public.current_tenant_id())::text
         and (select public.has_role(array['owner', 'admin']::public.app_role[])));

-- -----------------------------------------------------------------------------
-- 7. REALTIME (WebSockets): cambios de pedidos para caja y cocina
-- -----------------------------------------------------------------------------
alter table public.orders replica identity full;
alter table public.order_items replica identity full;

do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'products']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8. CARTA EN VIVO (Broadcast): la carta pública se actualiza sin recargar
--    Canal público: "menu:<tenant_id>"
--      evento "product" → fila pública del producto (agotado, precio, foto…)
--      evento "refresh" → cambió la marca, categorías o mesas: la carta
--                         vuelve a pedir get_public_menu una sola vez
--    Sólo viajan datos que get_public_menu ya expone; las tablas siguen
--    cerradas por RLS para anon.
-- -----------------------------------------------------------------------------
create or replace function public.tg_menu_broadcast()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new    jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old    jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row    jsonb := coalesce(v_new, v_old);
  v_tenant text  := coalesce(v_row ->> 'tenant_id', v_row ->> 'id'); -- tenants usa "id"
begin
  -- Guardar sin cambios reales (sólo updated_at) no genera tráfico
  if tg_op = 'UPDATE' and (v_new - 'updated_at') = (v_old - 'updated_at') then
    return null;
  end if;

  begin
    if tg_table_name = 'products' and tg_op <> 'DELETE' then
      perform realtime.send(
        jsonb_build_object(
          'id', new.id, 'category_id', new.category_id, 'name', new.name,
          'description', new.description, 'price', new.price, 'image_url', new.image_url,
          'is_available', new.is_available, 'is_active', new.is_active,
          'sort_order', new.sort_order
        ),
        'product',
        'menu:' || v_tenant,
        false
      );
    else
      perform realtime.send(jsonb_build_object('table', tg_table_name), 'refresh', 'menu:' || v_tenant, false);
    end if;
  exception when others then
    -- Nunca bloquear el guardado: si Broadcast no está disponible, la carta
    -- se refresca al reconectar o al recargar.
    null;
  end;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['products', 'categories', 'tables_or_tokens', 'business_settings', 'tenants']
  loop
    execute format('drop trigger if exists menu_broadcast on public.%I', t);
    execute format('create trigger menu_broadcast after insert or update or delete on public.%I
                    for each row execute function public.tg_menu_broadcast()', t);
  end loop;
end $$;

-- Fin de la migración ✔
