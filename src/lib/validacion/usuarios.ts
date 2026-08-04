import { z } from "zod";
import { opcional } from "./comun";

/**
 * Alta de una cuenta desde la consola de plataforma.
 *
 * A diferencia de `invitarMiembroSchema`, aquí se fija una contraseña y la
 * cuenta queda utilizable en el acto. Es la vía para montar un entorno o dar de
 * alta a alguien que no puede recibir el correo de invitación; el flujo por
 * correo sigue viviendo en la ficha de cada empresa.
 */
export const crearUsuarioSchema = z
  .object({
    nombres: z.string().trim().min(2, "Introduce el nombre.").max(80),
    apellidos: z.string().trim().min(2, "Introduce los apellidos.").max(80),
    correo: z.email("Introduce un correo electrónico válido."),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    rolPlataforma: z.enum(["usuario", "super_admin"], {
      message: "Selecciona el rol de plataforma.",
    }),
    empresaId: opcional(z.uuid("Selecciona una empresa de la lista.")),
    rolEmpresa: opcional(z.enum(["admin_empresa", "operador"])),
  })
  // Sin rol no se puede crear la membresía, y crearla «a medias» dejaría a la
  // persona dentro de la empresa sin poder hacer nada.
  .refine((d) => !d.empresaId || !!d.rolEmpresa, {
    message: "Elige qué rol tendrá dentro de la empresa.",
    path: ["rolEmpresa"],
  });
