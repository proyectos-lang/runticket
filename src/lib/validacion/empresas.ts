import { z } from "zod";
import { opcional } from "./comun";

/**
 * Estado del formulario de ficha de empresa.
 *
 * Vive aquí y no junto a una de las dos acciones porque **hay dos**: la de la
 * consola de plataforma y la del panel de la propia empresa. El formulario es
 * uno solo y no puede depender de un módulo de servidor concreto.
 */
export type EmpresaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Usa solo minúsculas, números y guiones.");

const datosEmpresaSchema = z.object({
  nombreComercial: z.string().trim().min(2, "Introduce el nombre comercial.").max(120),
  correoContacto: opcional(z.email("Correo inválido.")),
  telefonoContacto: opcional(z.string().trim().max(30)),
  rtn: opcional(z.string().trim().max(30)),
});

/**
 * El alta **no lleva slug**: lo deriva el servidor del nombre comercial y, si ya
 * está cogido, le añade un número. Pedirlo a mano era hacer que un
 * super-administrador inventara una dirección en el momento de dar de alta a un
 * cliente, que es cuando menos le importa y más fácil es equivocarse.
 *
 * La edición sí lo lleva: cuando la empresa ya tiene enlaces compartidos,
 * cambiar su dirección pública es una decisión, no un descuido.
 */
export const crearEmpresaSchema = datosEmpresaSchema;

export const editarEmpresaSchema = datosEmpresaSchema.extend({
  slug: slugSchema,
  colorPrimario: opcional(
    z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal, por ejemplo #10b981.")
  ),
  colorSecundario: opcional(
    z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal, por ejemplo #0ea5e9.")
  ),
});

// `invitarAdminSchema` se eliminó con la acción huérfana que lo usaba: el alta
// de miembros pasa toda por `invitarMiembroSchema`, que además pide el rol.
export const invitarMiembroSchema = z.object({
  correo: z.email("Introduce un correo electrónico válido."),
  rol: z.enum(["admin_empresa", "operador"], { message: "Selecciona el rol." }),
});
