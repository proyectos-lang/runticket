"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { actualizarPasswordSchema } from "@/lib/validacion/auth";

export type ActualizarPasswordState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<"password" | "confirmarPassword", string[]>>;
};

export async function actualizarPassword(
  _prevState: ActualizarPasswordState,
  formData: FormData
): Promise<ActualizarPasswordState> {
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
    return { status: "error", message: "No se pudo actualizar la contraseña: " + error.message };
  }

  redirect("/login");
}
