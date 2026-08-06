/**
 * Los tramos de edad del producto, en su orden de lectura.
 *
 * Son **los mismos cortes** que aplica `metricas_evento` en SQL
 * (`0014_dia_de_carrera_y_resultados.sql:332-349`). Están aquí para que la
 * pantalla de métricas y el informe de inscritos no acaben repartiendo la gente
 * de forma distinta: dos tablas que dicen cosas distintas del mismo dato es peor
 * que no tener una de las dos.
 */
export const RANGOS_EDAD = [
  "Menor de 18",
  "18-29",
  "30-39",
  "40-49",
  "50-59",
  "60 o más",
] as const;

export type RangoEdad = (typeof RANGOS_EDAD)[number];

export function rangoDeEdad(edad: number | null): RangoEdad | null {
  if (edad === null) return null;
  if (edad < 18) return "Menor de 18";
  if (edad <= 29) return "18-29";
  if (edad <= 39) return "30-39";
  if (edad <= 49) return "40-49";
  if (edad <= 59) return "50-59";
  return "60 o más";
}
