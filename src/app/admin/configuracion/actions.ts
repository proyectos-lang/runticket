"use server";

import { createClient } from "@/lib/supabase/server";
import { esSuperAdmin } from "@/lib/auth/session";
import { actualizarPasswordSchema } from "@/lib/validacion/auth";
import { auditar } from "@/lib/seguridad";

export type PasswordState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Partial<Record<"password" | "confirmarPassword", string[]>>;
};

/**
 * Cambia la contraseña de quien está en sesión.
 *
 * No se pide la contraseña actual: es una decisión consciente del producto, no
 * un olvido. A cambio, el cambio queda en la bitácora, que es el único rastro
 * que quedaría si alguien aprovechara una sesión abierta.
 *
 * `updateUser` actúa siempre sobre el usuario del token, nunca sobre un id que
 * venga del formulario, así que no hay forma de apuntar a otra cuenta.
 */
export async function cambiarMiPassword(
  _prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  if (!(await esSuperAdmin())) {
    return { status: "error", message: "No autorizado." };
  }

  const parsed = actualizarPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmarPassword: formData.get("confirmarPassword"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    // Supabase rechaza la contraseña si es idéntica a la actual o si no cumple
    // la política del proyecto; su mensaje es más útil que uno genérico.
    return { status: "error", message: "No se pudo cambiar: " + error.message };
  }

  await auditar({
    accion: "cuenta.password_cambiada",
    entidad: "perfiles",
  });

  return { status: "guardado" };
}
