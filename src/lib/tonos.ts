/**
 * Vocabulario de tono compartido por las etiquetas de estado.
 *
 * `lib/estados.ts` y `lib/pagos.ts` guardaban clases de Tailwind: un cambio de
 * paleta obligaba a editar tablas de datos, y nada impedía que dos módulos
 * pintaran el mismo estado de distinto color. Aquí solo se declara *qué
 * significa* el estado; el color lo decide `<Chip>`.
 *
 * `acento` es el naranja y está reservado a la urgencia (últimos cupos, cierre
 * inminente). No es un estado más: si se usa para cualquier cosa deja de
 * llamar la atención, que es lo único que aporta.
 */
export type Tono = "neutro" | "exito" | "aviso" | "error" | "info" | "acento";

export type Estilo = { etiqueta: string; tono: Tono };
