/**
 * El dominio de las cuentas silenciosas de acompañante.
 *
 * `auth.admin.createUser` exige un correo, y un hijo de ocho años no tiene. Se
 * inventa uno en un dominio **no enrutable**: nadie lo lee ni le llega nada.
 *
 * Por eso no debe enseñarse nunca. Que el organizador vea
 * `acompanante-a1b2…@interno.runticket.hn` bajo el nombre de un niño no solo no
 * sirve de nada: sugiere que se le puede escribir ahí.
 */
export const DOMINIO_INTERNO = "@interno.runticket.hn";

export function esCorreoInterno(correo: string | null | undefined): boolean {
  return Boolean(correo?.endsWith(DOMINIO_INTERNO));
}

/** El correo tal cual, o null si es una dirección inventada que no lleva a nadie. */
export function correoUtil(correo: string | null | undefined): string | null {
  return !correo || esCorreoInterno(correo) ? null : correo;
}
