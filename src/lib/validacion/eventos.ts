import { z } from "zod";
import { opcional } from "./comun";
import { DISCIPLINAS } from "@/lib/disciplinas";

/** Coordenada que puede venir vacía; el mapa escribe "" cuando no hay punto. */
const coordenadaOpcional = (min: number, max: number, mensaje: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(min, mensaje).max(max, mensaje).optional()
  );

const numeroOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0).optional()
);

/** Igual que numeroOpcional pero admite decimales (21.1 km, por ejemplo). */
const decimalOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive("La distancia debe ser mayor que cero.").optional()
);

export const crearEventoSchema = z.object({
  nombre: z.string().trim().min(3, "Introduce el nombre del evento.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, "Usa solo minúsculas, números y guiones."),
  // Límite holgado porque aquí llega HTML con etiquetas: la longitud real se
  // comprueba en el servidor **después** de sanear (`src/lib/sanitizar.ts`), o
  // el tope se gastaría en marcado que se va a descartar.
  descripcion: opcional(z.string().max(40000)),
  fechaInicio: z.string().min(1, "Selecciona la fecha y hora de inicio."),
  fechaLimiteInscripcion: opcional(z.string()),
  direccion: opcional(z.string().trim().max(300)),
});

export const editarEventoSchema = crearEventoSchema.extend({
  moneda: z.string().trim().length(3, "Usa el código de 3 letras, por ejemplo HNL."),
  zonaHoraria: z.string().trim().min(3).max(60),
  // Estos tres los lee la parte pública desde el rediseño (chip de disciplina,
  // filtro por departamento y bloque «Contenido del kit») y hasta ahora no había
  // por dónde rellenarlos: toda carrera se quedaba en el valor por defecto.
  disciplina: z.enum(DISCIPLINAS),
  departamentoId: opcional(z.uuid("Selecciona un departamento de la lista.")),
  /** Una línea por artículo; se convierte a `text[]` en la acción. */
  kitContenido: opcional(z.string().max(2000)),
});

/** Coordenadas y ruta: se guardan aparte del resto de datos del evento. */
export const ubicacionSchema = z.object({
  direccion: opcional(z.string().trim().max(300)),
  lat: coordenadaOpcional(-90, 90, "La latitud debe estar entre -90 y 90."),
  lng: coordenadaOpcional(-180, 180, "La longitud debe estar entre -180 y 180."),
  puntoEncuentroLat: coordenadaOpcional(-90, 90, "La latitud debe estar entre -90 y 90."),
  puntoEncuentroLng: coordenadaOpcional(-180, 180, "La longitud debe estar entre -180 y 180."),
});

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "Introduce el nombre de la categoría.").max(80),
  distanciaKm: decimalOpcional,
  // El selector de distancia y la ficha pública ya pintan el desnivel; faltaba
  // el campo para introducirlo. Admite 0 (una ruta llana) y no solo positivos.
  desnivelM: numeroOpcional,
  precioBase: z.coerce.number().min(0, "El precio no puede ser negativo."),
  cupoMaximo: numeroOpcional,
  edadMinima: numeroOpcional,
  edadMaxima: numeroOpcional,
  horaSalida: z.string().optional().or(z.literal("")),
});

export const precioEscalonadoSchema = z
  .object({
    categoriaId: z.uuid("Selecciona la categoría."),
    nombre: z.string().trim().min(1, "Ponle nombre al tramo, por ejemplo «Preventa».").max(80),
    precio: z.coerce.number().min(0, "El precio no puede ser negativo."),
    fechaInicio: z.string().min(1, "Indica desde cuándo aplica."),
    fechaFin: z.string().min(1, "Indica hasta cuándo aplica."),
  })
  .refine((d) => d.fechaFin > d.fechaInicio, {
    message: "La fecha de fin debe ser posterior a la de inicio.",
    path: ["fechaFin"],
  });

export const patrocinadorSchema = z.object({
  nombre: z.string().trim().min(1, "Introduce el nombre del patrocinador.").max(120),
  urlSitio: opcional(z.url("Introduce una dirección web válida, con https://")),
  /**
   * URL del logo ya subido a Storage. La forma se valida aquí y la **procedencia**
   * en el servidor con `urlPublicaValida`: que sea una URL no basta, tiene que
   * apuntar a la carpeta de este evento.
   */
  logoUrl: opcional(z.url()),
});

/**
 * Punto de retiro de kit. La tabla existía desde 0021 con sus políticas de
 * escritura completas y no había forma de dar uno de alta desde el panel.
 *
 * El horario es texto libre a propósito: los organizadores publican cosas como
 * «viernes 2–7 p. m. y sábado 9 a. m.–1 p. m.», que ninguna estructura razonable
 * representa sin estorbar.
 */
export const puntoEntregaSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle nombre al punto, por ejemplo «Tienda central».").max(120),
  direccion: opcional(z.string().trim().max(300)),
  horario: opcional(z.string().trim().max(200)),
  lat: coordenadaOpcional(-90, 90, "La latitud debe estar entre -90 y 90."),
  lng: coordenadaOpcional(-180, 180, "La longitud debe estar entre -180 y 180."),
});

export const tallaSchema = z.object({
  talla: z.string().trim().min(1, "Introduce la talla.").max(20),
  inventarioTotal: numeroOpcional,
});
