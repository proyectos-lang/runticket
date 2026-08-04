import { z } from "zod";
import { opcional } from "./comun";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Usa solo minúsculas, números y guiones.");

export const crearEmpresaSchema = z.object({
  nombreComercial: z.string().trim().min(2, "Introduce el nombre comercial.").max(120),
  slug: slugSchema,
  correoContacto: opcional(z.email("Correo inválido.")),
  telefonoContacto: opcional(z.string().trim().max(30)),
  rtn: opcional(z.string().trim().max(30)),
});

export const editarEmpresaSchema = crearEmpresaSchema.extend({
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
