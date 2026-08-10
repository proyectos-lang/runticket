"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ambitoDelUsuario } from "@/lib/auth/destino";
import { loginSchema } from "@/lib/validacion/auth";
import { dentroDelLimite, MENSAJE_LIMITE, rutaInternaSegura } from "@/lib/seguridad";

export type LoginState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<"correo" | "password", string[]>>;
  /**
   * El correo que se intentó, devuelto para repintarlo.
   *
   * React 19 vacía los campos no controlados cuando termina una acción de
   * formulario, así que sin esto un fallo de contraseña obliga a reescribir
   * también el correo.
   */
  correo?: string;
};

export async function iniciarSesion(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const correoEscrito = typeof formData.get("correo") === "string" ? String(formData.get("correo")) : "";

  // Freno al probado sistemático de contraseñas.
  if (!(await dentroDelLimite("login"))) {
    return { status: "error", message: MENSAJE_LIMITE, correo: correoEscrito };
  }

  const parsed = loginSchema.safeParse({
    correo: formData.get("correo"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors, correo: correoEscrito };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.correo,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", message: "Correo o contraseña incorrectos.", correo: correoEscrito };
  }

  const next = rutaInternaSegura(formData.get("next"));
  if (next) redirect(next);

  // Misma regla que usa la cabecera pública: ver lib/auth/destino.ts.
  redirect((await ambitoDelUsuario()).href);
}
