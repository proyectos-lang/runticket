/**
 * Las clases del botón, **sin `"use client"`**.
 *
 * Viven aparte de `Boton.tsx` a propósito. Ese archivo es un módulo de cliente
 * —necesita `useEffect` para el aviso de la regla de oro—, y una función
 * exportada desde un módulo de cliente no se puede **llamar** desde un
 * componente de servidor: React la convierte en una referencia al cliente y
 * lanza «Attempted to call claseBoton() from the server but it's on the
 * client». Compila sin quejarse y revienta al renderizar.
 *
 * Como esto son cadenas de texto y nada más, aquí lo pueden usar los dos lados.
 */

export type VarianteBoton = "primaria" | "secundaria" | "fantasma" | "peligro";
export type TamanoBoton = "sm" | "md" | "lg";

/**
 * La primaria va en versalitas y peso 800: en el diseño aprobado la acción se
 * grita («INSCRIBIRME AHORA», «PAGAR L 503.00»). Las demás variantes acompañan
 * y se quedan en caja baja, que es lo que las hace secundarias.
 */
export const VARIANTES: Record<VarianteBoton, string> = {
  primaria: "bg-naranja font-extrabold uppercase tracking-wide text-tinta hover:bg-naranja-suave",
  secundaria: "border border-linea-fuerte bg-superficie font-medium text-texto hover:border-texto/25",
  fantasma: "font-medium text-atenuado hover:bg-superficie-2 hover:text-texto",
  peligro: "border border-red-500/35 font-medium text-red-300 hover:bg-red-500/10",
};

/**
 * `h-11` son los 44px de área táctil que pide el diseño. Sube el ritmo vertical
 * respecto a los ~38px de antes, así que los formularios largos se leen más
 * espaciados: es intencionado.
 */
export const TAMANOS: Record<TamanoBoton, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-8 text-sm",
};

/* Radio de 6px: la píldora se reserva a chips y filtros. */
export const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-55";

/**
 * Las mismas clases para un `<a>` corriente.
 *
 * Existe para los enlaces que no pasan por `next/link` —el `wa.me` del
 * organizador, la descarga de un fichero— y que, sin esto, acababan copiando la
 * cadena a mano y separándose del componente en cuanto alguien tocaba una.
 *
 * No dispara el aviso de la regla de oro: un enlace de salida o una descarga no
 * son la acción principal de la pantalla.
 */
export function claseBoton(
  variante: VarianteBoton = "secundaria",
  tamano: TamanoBoton = "md",
  extra = ""
) {
  return `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`.trim();
}
