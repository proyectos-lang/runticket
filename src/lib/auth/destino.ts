import "server-only";
import { esSuperAdmin, getMembresiasActivas } from "./session";

export type Ambito = {
  /** A dónde pertenece esta persona: su área principal. */
  href: "/admin" | "/panel" | "/portal";
  /** Cómo llamarlo en un botón, que no es lo mismo en las tres. */
  etiqueta: string;
};

/**
 * Dónde vive cada quien dentro de la aplicación.
 *
 * **Una sola definición, usada por el login y por la cabecera pública.** Vivía
 * solo dentro de la acción de login, y esa fue la causa de un fallo que parecía
 * de permisos y no lo era: quien administra una empresa entraba bien a `/panel`,
 * pero en cuanto pisaba el sitio público la cabecera le ofrecía «Mi cuenta» →
 * `/portal` y ahí se quedaba, viendo pantallas de corredor. No había **ningún**
 * enlace a `/panel` fuera del propio panel, así que la única vuelta era escribir
 * la URL a mano. Desde fuera se lee como «no me deja entrar como administrador».
 *
 * El orden importa y es el mismo que el del login: la consola de plataforma
 * manda sobre el panel de empresa, y el panel sobre el portal. Quien es las tres
 * cosas —lo normal en un organizador que además corre— aterriza en la de más
 * alcance, y desde su menú llega al resto.
 */
export async function ambitoDelUsuario(): Promise<Ambito> {
  if (await esSuperAdmin()) {
    return { href: "/admin", etiqueta: "Consola" };
  }
  const membresias = await getMembresiasActivas();
  if (membresias.length > 0) {
    return { href: "/panel", etiqueta: "Mi panel" };
  }
  return { href: "/portal", etiqueta: "Mi cuenta" };
}
