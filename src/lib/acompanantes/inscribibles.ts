import { edadEnFecha } from "@/lib/format";
import type { CategoriaConCupo } from "@/lib/eventos/consultas";

export const ETIQUETA_PARENTESCO: Record<string, string> = {
  hijo: "Hijo o hija",
  pareja: "Pareja",
  familiar: "Familiar",
  otro: "Acompañante",
};

export type CategoriaParaAcompanante = {
  id: string;
  nombre: string;
  distancia_km: number | null;
  precio_vigente: number;
  elegible: boolean;
  motivo: string | null;
};

export type AcompananteInscribible = {
  /** Id de la relación en `acompanantes`, que es lo que espera la RPC. */
  id: string;
  nombre: string;
  parentesco: string;
  edad: number | null;
  tallaSugerida: string | null;
  /** Ya tiene inscripción activa en esta carrera. */
  yaInscrito: boolean;
  categorias: CategoriaParaAcompanante[];
};

export type PerfilDeAcompanante = {
  nombres: string | null;
  apellidos: string | null;
  fecha_nacimiento: string | null;
  talla_predeterminada: string | null;
};

/**
 * Qué puede correr un acompañante en una carrera concreta.
 *
 * La elegibilidad se calcula **por persona**, no por inscripción: el hijo de
 * ocho años no entra en la 21K aunque su padre sí. Son los mismos criterios que
 * aplica `inscribir_persona` en la base de datos, adelantados aquí para que el
 * formulario no ofrezca lo que la base va a rechazar. La base sigue siendo la
 * que decide: esto solo evita el viaje en balde.
 *
 * Vive aparte de la pantalla porque lo necesitan dos caminos —pintar la lista al
 * cargar y devolver a alguien recién dado de alta sin recargar—, y con dos copias
 * acabarían discrepando en cuanto se toque una regla.
 */
export function aAcompananteInscribible(args: {
  relacionId: string;
  parentesco: string;
  perfil: PerfilDeAcompanante | null | undefined;
  yaInscrito: boolean;
  categorias: CategoriaConCupo[];
  fechaEvento: string;
}): AcompananteInscribible {
  const { perfil } = args;
  const edad = perfil?.fecha_nacimiento
    ? edadEnFecha(perfil.fecha_nacimiento, args.fechaEvento)
    : null;

  return {
    id: args.relacionId,
    nombre: [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ") || "Sin nombre",
    parentesco: ETIQUETA_PARENTESCO[args.parentesco] ?? "Acompañante",
    edad,
    tallaSugerida: perfil?.talla_predeterminada ?? null,
    yaInscrito: args.yaInscrito,
    categorias: args.categorias.map((c) => {
      let motivo: string | null = null;
      if (edad === null) motivo = "Falta su fecha de nacimiento";
      else if (c.cupos_disponibles !== null && c.cupos_disponibles <= 0) motivo = "Cupo agotado";
      else if (c.edad_minima !== null && edad < c.edad_minima)
        motivo = `Solo desde ${c.edad_minima} años`;
      else if (c.edad_maxima !== null && edad > c.edad_maxima)
        motivo = `Solo hasta ${c.edad_maxima} años`;
      return {
        id: c.id,
        nombre: c.nombre,
        distancia_km: c.distancia_km,
        precio_vigente: Number(c.precio_vigente),
        elegible: motivo === null,
        motivo,
      };
    }),
  };
}
