import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_PREFIXES = ["/pos", "/cuadre", "/cocina", "/reportes", "/plan", "/mafc", "/catalogo", "/mesas", "/ajustes", "/bienvenida"];
const AUTH_PAGES = ["/login", "/registro"];

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas internas.
 * La autorización real vive en las políticas RLS de la base de datos.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLogged = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isLogged && PRIVATE_PREFIXES.some((p) => path.startsWith(p))) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("next", path);
    return NextResponse.redirect(to);
  }
  if (isLogged && AUTH_PAGES.includes(path)) {
    const to = request.nextUrl.clone();
    to.pathname = "/pos";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|manifest|carta/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
