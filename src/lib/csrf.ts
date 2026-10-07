import "server-only";
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Token anti-CSRF de doble envío para los formularios de acceso.
 *
 * Las acciones de servidor de Next ya rechazan peticiones de otro origen
 * (comparan `Origin` con `Host`), así que esto es una segunda capa, pedida por
 * la auditoría de seguridad: el proxy deja una cookie aleatoria, el formulario
 * la repite en un campo oculto y la acción exige que coincidan. Un sitio ajeno
 * puede hacer que el navegador envíe la cookie, pero no puede leerla para
 * copiarla en el campo.
 */
export const COOKIE_CSRF = "rt_csrf";

/** El token de esta petición, para ponerlo en el campo oculto del formulario. */
export async function tokenCsrf(): Promise<string> {
  return (await cookies()).get(COOKIE_CSRF)?.value ?? "";
}

/** True si el campo `csrf` del formulario coincide con la cookie. */
export async function csrfValido(formData: FormData): Promise<boolean> {
  const enviado = formData.get("csrf");
  const esperado = (await cookies()).get(COOKIE_CSRF)?.value;
  if (typeof enviado !== "string" || !esperado || enviado.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado));
}

export const MENSAJE_CSRF = "La página llevaba demasiado tiempo abierta. Recárgala e inténtalo de nuevo.";
