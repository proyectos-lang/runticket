import { z } from "zod";

/**
 * Envuelve un esquema para que acepte las tres formas en que un campo puede
 * llegar "vacío" desde un formulario:
 *   - `""`   → el campo se renderizó pero el usuario no lo llenó
 *   - `null` → el campo NO se renderizó (p. ej. los datos del tutor cuando el
 *              participante es mayor de edad); FormData.get() devuelve null
 *   - `undefined`
 *
 * Sin esto, `.optional()` rechaza el `null` y la validación falla por un campo
 * que ni siquiera estaba en pantalla.
 */
export const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), esquema.optional());
