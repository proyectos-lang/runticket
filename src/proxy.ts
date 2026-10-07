import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { consultaCanonica } from "@/lib/eventos/filtros";

export function proxy(request: NextRequest) {
  // El catálogo solo acepta sus filtros: cualquier otra cosa en la URL (un
  // parámetro repetido, un valor inventado) se redirige a la versión limpia
  // **antes** de renderizar. Hacerlo en la página no bastaba: con el armazón
  // estático, la redirección salía como un refresco en el cliente y la URL
  // sucia viajaba igual dentro de la respuesta.
  if (request.nextUrl.pathname === "/eventos") {
    const limpia = consultaCanonica(request.nextUrl.searchParams);
    if (limpia !== null) {
      const url = request.nextUrl.clone();
      url.search = limpia;
      return NextResponse.redirect(url, 307);
    }
  }
  return updateSession(request);
}

export const config = {
  // Fuera también los archivos de la app instalable (manifest, service worker,
  // página sin conexión, iconos): no tienen sesión que refrescar.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|fuentes/|\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
