import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PROTEGIDAS = ["/admin", "/panel", "/portal"];

const COOKIE_CSRF = "rt_csrf";

export async function updateSession(request: NextRequest) {
  // Token anti-CSRF de doble envío (ver lib/csrf.ts). Se escribe también en la
  // petición para que la página que se renderiza ahora mismo ya pueda leerlo.
  if (!request.cookies.get(COOKIE_CSRF)) {
    const token = crypto.randomUUID().replace(/-/g, "");
    request.cookies.set(COOKIE_CSRF, token);
  }
  const tokenCsrf = request.cookies.get(COOKIE_CSRF)!.value;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if needed. Do not add logic between
  // createServerClient and this call, or sessions may randomly expire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verificación optimista únicamente (¿hay sesión o no?). La autorización real por rol
  // (super_admin / admin_empresa / operador / corredor) se resuelve en cada Server
  // Component/Action contra la base de datos — ver src/lib/auth/session.ts.
  const esRutaProtegida = RUTAS_PROTEGIDAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  supabaseResponse.cookies.set(COOKIE_CSRF, tokenCsrf, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  if (esRutaProtegida && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Con la consulta incluida: el QR del dorsal lleva `?codigo=` y sin esto se
    // perdía al pasar por el login, dejando al operador en el buscador vacío.
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
