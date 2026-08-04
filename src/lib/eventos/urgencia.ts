import { diasHasta } from "@/lib/format";
import type { EventoPublico } from "@/lib/eventos/consultas";

/**
 * Qué carrera se pinta en naranja en el listado.
 *
 * El diseño la llama «urgencia» y la ejemplifica con «últimos cupos». Contar
 * cupos exige una llamada `security definer` por evento —`inscripciones` no es
 * legible por anónimos—, así que en una lista de 30 carreras serían 30 viajes
 * al servidor para pintar un borde.
 *
 * Se usa en su lugar la urgencia que sí se deriva de los datos que la lista ya
 * trae y que además es la que de verdad aprieta al corredor: que el plazo de
 * inscripción esté a punto de cerrarse. En la ficha del evento, donde sí se
 * consultan los cupos, se muestran los cupos reales.
 */
const DIAS_DE_CIERRE = 7;
const DIAS_DE_SALIDA = 10;

export function esUrgente(evento: EventoPublico): boolean {
  if (evento.estado !== "publicado") return false;
  if (evento.fechaLimiteInscripcion) {
    const dias = diasHasta(evento.fechaLimiteInscripcion);
    return dias >= 0 && dias <= DIAS_DE_CIERRE;
  }
  const dias = diasHasta(evento.fechaInicio);
  return dias >= 0 && dias <= DIAS_DE_SALIDA;
}

/** Texto que acompaña al borde naranja. Null cuando no hay urgencia que contar. */
export function motivoDeUrgencia(evento: EventoPublico): string | null {
  if (!esUrgente(evento)) return null;
  const fecha = evento.fechaLimiteInscripcion ?? evento.fechaInicio;
  const dias = diasHasta(fecha);
  if (dias <= 0) return "Cierra hoy";
  if (dias === 1) return "Cierra mañana";
  return `Cierra en ${dias} días`;
}
