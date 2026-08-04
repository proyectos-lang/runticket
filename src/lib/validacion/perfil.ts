import { z } from "zod";
import { opcional } from "./comun";

export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export const TALLAS = ["XS", "S", "M", "L", "XL", "XXL", "4-6", "8-10", "12-14"] as const;
export const NIVELES_EXPERIENCIA = [
  { valor: "principiante", etiqueta: "Principiante" },
  { valor: "intermedio", etiqueta: "Intermedio" },
  { valor: "avanzado", etiqueta: "Avanzado" },
  { valor: "competitivo", etiqueta: "Competitivo" },
] as const;
export const ORIGENES = [
  "Redes sociales",
  "Un amigo o familiar",
  "El organizador",
  "Búsqueda en internet",
  "Otro",
] as const;

export const perfilSchema = z.object({
  nombres: z.string().trim().min(2, "Introduce tus nombres.").max(80),
  apellidos: z.string().trim().min(2, "Introduce tus apellidos.").max(80),
  telefono: opcional(
    z.string().trim().regex(/^\+?[0-9\s-]{8,20}$/, "Introduce un teléfono válido con código de país.")
  ),
  fechaNacimiento: z
    .string()
    .min(1, "Introduce tu fecha de nacimiento.")
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d < new Date() && d > new Date("1900-01-01");
    }, "Fecha de nacimiento no válida."),
  sexo: z.enum(["masculino", "femenino", "otro"], { message: "Selecciona una opción." }),
  documentoIdentidad: opcional(z.string().trim().max(40)),
  paisId: opcional(z.uuid("Selecciona un país.")),
  departamentoId: opcional(z.uuid()),
  ciudadId: opcional(z.uuid()),
  nacionalidad: opcional(z.string().trim().max(60)),
  tallaPredeterminada: opcional(z.string().trim().max(20)),
  tipoSangre: opcional(z.enum(TIPOS_SANGRE)),
  contactoEmergenciaNombre: z.string().trim().min(2, "Introduce un contacto de emergencia.").max(80),
  contactoEmergenciaParentesco: opcional(z.string().trim().max(40)),
  contactoEmergenciaTelefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, "Introduce un teléfono de emergencia válido."),
  ocupacion: opcional(z.string().trim().max(80)),
  comoSeEntero: opcional(z.string().trim().max(80)),
  nivelExperiencia: opcional(z.enum(["principiante", "intermedio", "avanzado", "competitivo"])),
});

export type PerfilInput = z.infer<typeof perfilSchema>;

/** Campos sin los que no se puede completar una inscripción. */
export function perfilCompleto(perfil: {
  nombres: string | null;
  apellidos: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
}): boolean {
  return Boolean(
    perfil.nombres &&
      perfil.apellidos &&
      perfil.fecha_nacimiento &&
      perfil.sexo &&
      perfil.contacto_emergencia_nombre &&
      perfil.contacto_emergencia_telefono
  );
}
