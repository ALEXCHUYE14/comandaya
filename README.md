# MAFC Comanda · POS gastronómico multi-tenant

Punto de venta, pantalla de cocina (KDS) y carta digital QR con seguimiento del pedido en tiempo real,
pensado para cevicherías al paso, broasterías, hamburgueserías, pizzerías y dark kitchens.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · componentes estilo shadcn
(Radix UI) · Lucide · Supabase (PostgreSQL + Auth + Storage + Realtime) · TanStack Query · Zustand.

---

## 1. Módulos

| Ruta | Módulo | Quién lo usa |
|---|---|---|
| `/pos` | **Caja / Mozo**: búsqueda con autocompletado, filtros por categoría, carrito persistente, modos *Al paso / Mesa / Delivery*, token de llamado automático, sumar ítems a la cuenta de una mesa, cobro en efectivo (teclado + vuelto), tarjeta, **Yape y Plin** (muestra el QR subido en Ajustes), tablero de pedidos en vivo con deslizar → avanzar estado e impresión de ticket/comanda 80 mm | Propietario, administrador, caja, mozo |
| `/cocina` | **KDS**: tarjetas por pedido con semáforo (verde < 5 min, ámbar 5–10, rojo > 10), alerta sonora al llegar una comanda por WebSocket, filtro Cocina/Barra, pantalla completa, ítems agregados marcados | Cocina, caja, administración |
| `/catalogo` | Categorías y productos con foto, estación (cocina/barra) y switch de **agotado** | Propietario, administrador |
| `/mesas` | Mesas, QR por mesa y QR general en **SVG/PNG**, hoja A4 imprimible | Propietario, administrador |
| `/ajustes` | Marca blanca: nombre, RUC/DNI, dirección, teléfono, redes, **logo**, **QR de Yape y Plin**, bienvenida, pie de ticket, encendido de pedidos QR y sonido, **equipo y roles** | Propietario, administrador |
| `/carta/[slug]` | **Carta pública** (PWA): categorías con scrollspy, animaciones al agregar, auto-pedido por mesa (`?mesa=código`), para llevar o delivery | Clientes (sin cuenta) |
| `/carta/[slug]/pedido/[token]` | **Seguimiento en vivo**: "Tu pedido se está preparando…" → "¡Tu pedido está listo!", con sonido y QR de pago | Clientes |

Estados del pedido: **En espera → En preparación → Listo para entrega → Cerrado** (o *Anulado*). El pago (`unpaid`/`paid`)
es independiente del estado, así se puede cobrar por adelantado (al paso) o al final (mesa).

---

## 2. Arquitectura (capas)

```
supabase/
  schema.sql                ← migración completa (tablas, RLS, triggers, RPCs, storage, realtime)
src/
  core/                     ← DOMINIO (sin dependencias de framework)
    domain/types.ts         ← entidades
    domain/order-rules.ts   ← máquina de estados, dinero en céntimos, vuelto, urgencia KDS, permisos
    lib/                    ← utilidades puras (cn, sonido Web Audio, gestos swipe, compresión de imágenes)
  infrastructure/           ← ADAPTADORES
    supabase/               ← clientes navegador/servidor/anónimo + variables de entorno
    repositories/           ← orders, catalog, business, public (única capa que habla con Supabase)
  features/                 ← CASOS DE USO + UI por módulo
    pos/ kds/ orders/ catalog/ tables/ settings/ public-menu/ onboarding/ auth/ session/
  stores/                   ← Zustand persistido (carrito de caja y carrito del cliente)
  components/               ← UI compartida (ui/*, shell, marca, tema, subida de imágenes)
  app/                      ← rutas de Next.js (sólo composición)
  proxy.ts                  ← refresca la sesión y protege rutas (antes "middleware")
```

**Seguridad multi-tenant:** cada tabla lleva `tenant_id` y RLS. Las claves foráneas compuestas
(`(category_id, tenant_id)`, `(order_id, tenant_id)`, etc.) impiden mezclar datos entre negocios incluso con errores
de código. Precios y nombres de los ítems los copia un trigger desde `products`: el cliente nunca fija el precio.
El público (anon) **no** tiene acceso a tablas: sólo a 3 funciones (`get_public_menu`, `place_public_order`,
`get_public_order`) y el seguimiento usa un token UUID no adivinable.

**Tiempo real:** caja y cocina escuchan `postgres_changes` filtrado por `tenant_id` (respeta RLS). El cliente final
escucha un canal **Broadcast** público `order:<token>` que emite un trigger, sin exponer la tabla `orders`.
React Query hace polling de respaldo si se cae el WebSocket, y el carrito vive en `localStorage` para no perder un
pedido a medio tomar.

**Roles:** `owner`, `admin`, `cashier`, `waiter`, `kitchen`. La BD los valida (cocina no puede cobrar ni descontar,
el personal sólo puede marcar productos agotados, nadie puede cambiarse su propio rol).

---

## 3. Puesta en marcha

### 3.1 Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, pega todo `supabase/schema.sql` y presiona **Run**. Es re-ejecutable.
3. **Authentication → URL Configuration**: agrega tu dominio (y `http://localhost:3000`) en *Site URL* /
   *Redirect URLs*. Para pruebas puedes desactivar *Confirm email* en **Authentication → Providers → Email**.
   **Recuperar contraseña:** en *Redirect URLs* agrega también `https://TU-DOMINIO/restablecer`
   (y `http://localhost:3000/restablecer`). Opcional, para que el enlace funcione aunque se abra en otro
   celular: en **Authentication → Emails → Reset Password** cambia el enlace por
   `{{ .SiteURL }}/restablecer?token_hash={{ .TokenHash }}&type=recovery`.
4. **Project Settings → API**: copia la *Project URL* y la *anon public key*.
5. **Panel MAFC (planes y cobros):** crea tu cuenta en `/registro` y luego, en el SQL Editor:
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'TU_CORREO';
   ```
   Entra a `/mafc` para ver los negocios, registrar pagos (S/ 30/mes por defecto), extender pruebas
   (7 días por defecto), suspender o dar cortesía. En **Plan y cobro** carga tu Yape/Plin y WhatsApp.
   Un negocio suspendido conserva sus datos; su caja y su carta QR se pausan hasta que pague.
6. **Cobro automático con Mercado Pago (opcional):** crea una aplicación en
   [Mercado Pago Developers](https://www.mercadopago.com.pe/developers/panel/app) (Checkout Pro) y agrega en el
   servidor (Vercel → Settings → Environment Variables) `MERCADOPAGO_ACCESS_TOKEN` y `SUPABASE_SERVICE_ROLE_KEY`.
   En la app de Mercado Pago → **Webhooks** apunta a `https://TU-DOMINIO/api/billing/webhook`, evento **Pagos**, y
   copia la clave secreta a `MERCADOPAGO_WEBHOOK_SECRET`. Prueba primero con credenciales de prueba (`TEST-…`).
   Sin estas variables el botón no aparece y todo sigue funcionando con el cobro manual por Yape.

> El script crea el bucket público `tenant-assets` (logos, QR de pago y fotos, máx. 5 MB) y agrega `orders`,
> `order_items` y `products` a la publicación `supabase_realtime`.
>
> **Carta en vivo:** la sección 8 del script crea el trigger `menu_broadcast`, que avisa por Broadcast
> (canal `menu:<tenant_id>`) cada cambio de producto (agotado, precio, foto) o de los datos del negocio.
> Si actualizas un proyecto existente, vuelve a ejecutar el script completo. En **Realtime → Settings**
> deja desactivado *"Private channels only"* (la carta y el seguimiento usan canales públicos).
>
> **Imágenes livianas:** las fotos se comprimen en el navegador a WebP (≈800 px, ~40–80 KB) antes de subir,
> se guardan con nombre único y `Cache-Control` de 1 año (el celular no las vuelve a descargar) y la
> foto reemplazada se borra del bucket.

### 3.2 Variables de entorno

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # en producción: https://tu-dominio.com (se usa en los QR)
```

### 3.3 Instalar y ejecutar

Requiere **Node.js 20.9+**.

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # verificación TypeScript
npm run build && npm start
```

### 3.4 Primer uso

1. `/registro` → crea tu cuenta → **"Tengo un negocio"** → nombre y enlace de la carta (con carta de ejemplo opcional).
2. **Ajustes**: sube logo y QR de Yape/Plin, completa RUC y datos del ticket.
3. **Mesas y QR**: imprime los QR de cada mesa y el QR general del mostrador.
4. Personal: cada trabajador se registra en `/registro`, elige **"Soy personal"** y el dueño lo agrega en
   **Ajustes → Equipo** con su correo y rol.
5. Abre `/cocina` en la tablet de cocina y toca **"Activar alertas sonoras"** (los navegadores exigen un toque).

---

## 4. Despliegue (Vercel / Netlify)

**Vercel:** importa el repositorio (o `vercel deploy`), agrega las 3 variables de entorno en *Settings → Environment
Variables* y despliega. No necesita configuración extra.

**Netlify:** *Add new site → Import*, build `npm run build`; el runtime de Next.js se detecta solo. Agrega las mismas
variables.

Después del primer deploy, actualiza `NEXT_PUBLIC_SITE_URL` con el dominio final y vuelve a imprimir los QR.

---

## 5. Comprimir la solución en un ZIP

Excluye dependencias y artefactos de compilación (se regeneran con `npm install` / `npm run build`):

**macOS / Linux**
```bash
cd ..
zip -r comandaya.zip comandaya -x "comandaya/node_modules/*" "comandaya/.next/*" "comandaya/.env.local" "comandaya/*.tsbuildinfo"
```

**Windows (PowerShell)**
```powershell
cd ..
Get-ChildItem comandaya -Exclude node_modules,.next,.env.local | Compress-Archive -DestinationPath comandaya.zip -Force
```

Nunca incluyas `.env.local` en el ZIP: compártelo por un canal privado.

---

## 6. Notas y siguientes pasos sugeridos

- El ticket impreso es un comprobante interno ("no válido como comprobante de pago"). Para boletas/facturas SUNAT,
  integra un OSE/PSE (Nubefact, APISUNAT, etc.) desde una Edge Function al cerrar el pedido.
- La confirmación de Yape/Plin es manual (el cajero verifica la notificación); ninguna de las dos expone una API
  pública de conciliación para negocios pequeños.
- `place_public_order` es anónima: si un local recibe spam, activa Cloudflare Turnstile o limita por IP con una
  Edge Function delante de la RPC.
- Los íconos de la PWA son SVG; si necesitas íconos PNG para iOS antiguos, agrega `public/icon-192.png` y
  `public/icon-512.png` y regístralos en `src/app/manifest.ts`.
