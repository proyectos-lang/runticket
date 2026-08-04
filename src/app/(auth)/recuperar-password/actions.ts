"use server";

import { createClient } from "@/lib/supabase/server";
import { recuperarPasswordSchema } from "@/lib/validacion/auth";
import { dentroDelLimite, MENSAJE_LIMITE } from "@/lib/seguridad";

export type RecuperarState = {
  status: "idle" | "error" | "enviado";
  message?: string;
  errors?: Partial<Record<"correo", string[]>>;
};

export async function solicitarRecuperacion(
  _prevState: RecuperarState,
  formData: FormData
): Promise<RecuperarState> {
  // Cada intento manda un correo: sin freno se puede usar para inundar la
  // bandeja de cualquier persona cuya dirección se conozca.
  if (!(await dentroDelLimite("recuperarPassword"))) {
    return { status: "error", message: MENSAJE_LIMITE };
  }

  const parsed = recuperarPasswordSchema.safeParse({ correo: formData.get("correo") });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(parsed.data.correo, {
    redirectTo: `${siteUrl}/auth/confirmar?next=/actualizar-password`,
  });

  // No confirmamos ni negamos si el correo existe, por seguridad.
  return { status: "enviado" };
}
