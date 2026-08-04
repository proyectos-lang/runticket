import { z } from "zod";

export const loginSchema = z.object({
  correo: z.email("Introduce un correo electrónico válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

export const registroSchema = z.object({
  nombres: z.string().trim().min(2, "Introduce tu nombre.").max(80),
  apellidos: z.string().trim().min(2, "Introduce tus apellidos.").max(80),
  correo: z.email("Introduce un correo electrónico válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export const recuperarPasswordSchema = z.object({
  correo: z.email("Introduce un correo electrónico válido."),
});

export const actualizarPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmarPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });
