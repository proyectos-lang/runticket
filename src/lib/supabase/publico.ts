import "server-only";
import { createClient as crearClienteBase } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente para los datos que ve cualquiera, **sin leer cookies**.
 *
 * Existe por una restricción dura del modelo de caché: dentro de un ámbito
 * `use cache` no se puede tocar `cookies()`, y el cliente de `server.ts` las lee
 * siempre para resolver la sesión. Con él, ninguna consulta pública podría
 * cachearse y las páginas del catálogo seguirían siendo dinámicas de por vida.
 *
 * No es un atajo: es lo correcto. Estas consultas responden lo mismo a todo el
 * mundo —qué carreras hay, cuánto cuestan, cuántos cupos quedan— y **deben** dar
 * lo mismo con sesión y sin ella, o la página cacheada mostraría a un visitante
 * lo que vio otro. Al no mandar el token, PostgREST aplica las políticas de
 * `anon`, que es exactamente el alcance que queremos: si una consulta pública se
 * apoyara sin querer en los permisos de alguien, aquí devuelve vacío en vez de
 * filtrar datos ajenos a una página cacheada.
 *
 * Para todo lo que dependa de quién mira —portal, panel, consola— sigue estando
 * `createClient()` de `server.ts`.
 */
export function createPublicClient() {
  return crearClienteBase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Sin sesión que persistir ni que refrescar: cada llamada es anónima y
        // no debe arrastrar estado entre peticiones del servidor.
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Etiquetas de caché del contenido público.
 *
 * Un solo sitio donde se nombran, porque las usan dos lados que tienen que
 * coincidir: las funciones que cachean y las acciones del panel que invalidan.
 * Cuando estaban sueltas, un `revalidateTag("evento")` contra un `cacheTag`
 * llamado `"eventos"` fallaba en silencio y la portada se quedaba con la carrera
 * vieja hasta que expiraba sola.
 */
export const TAG_EVENTOS = "eventos-publicos";
export const tagEvento = (slug: string) => `evento:${slug}`;
export const tagOrganizador = (slug: string) => `organizador:${slug}`;
