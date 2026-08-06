import { z } from "zod";
import { opcional } from "./comun";
import { TALLAS } from "./perfil";

export const PARENTESCOS = [
  { valor: "hijo", etiqueta: "Hijo o hija" },
  { valor: "pareja", etiqueta: "Pareja" },
  { valor: "familiar", etiqueta: "Otro familiar" },
  { valor: "otro", etiqueta: "Otra persona" },
] as const;

/**
 * Alta de un acompañante.
 *
 * Se piden exactamente los datos que la inscripción necesita y ni uno más:
 * nombre para el dorsal y el certificado, fecha de nacimiento porque la
 * categoría se valida por edad el día de la carrera, y sexo porque define la
 * clasificación. La talla es opcional; se elige al inscribir.
 *
 * El correo también es opcional a propósito: un hijo pequeño no tiene, y
 * exigirlo bloquearía justo el caso que motiva la función. Si se pone, esa
 * persona puede reclamar su cuenta más adelante con «recuperar contraseña».
 */
export const acompananteSchema = z.object({
  nombres: z.string().trim().min(2, "Introduce el nombre.").max(80),
  apellidos: z.string().trim().min(2, "Introduce los apellidos.").max(80),
  fechaNacimiento: z
    .string()
    .min(1, "La fecha de nacimiento define en qué categoría puede correr."),
  sexo: z.enum(["masculino", "femenino", "otro"], { message: "Selecciona una opción." }),
  parentesco: z.enum(["hijo", "pareja", "familiar", "otro"], {
    message: "Selecciona el parentesco.",
  }),
  correo: opcional(z.email("Ese correo no es válido.")),
  documentoIdentidad: opcional(z.string().trim().max(40)),
  tallaPredeterminada: opcional(z.enum(TALLAS)),
  contactoEmergenciaNombre: opcional(z.string().trim().max(120)),
  contactoEmergenciaTelefono: opcional(
    z.string().trim().regex(/^\+?[0-9\s-]{8,20}$/, "Introduce un teléfono válido.")
  ),
});

export type DatosAcompanante = z.infer<typeof acompananteSchema>;
