import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase con la sesión del usuario que hace la petición.
 *
 * Va envuelto en `cache()` de React: dentro de una misma petición, el layout, la
 * página y cada componente de servidor que lo pidan reciben **el mismo**
 * cliente en vez de construir uno cada vez. La caché vive solo lo que dura la
 * petición, así que no hay riesgo de cruzar sesiones entre usuarios.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; safe to ignore when
            // middleware is refreshing the session.
          }
        },
      },
    }
  );
});
