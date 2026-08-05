"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registroSchema } from "@/lib/validacion/auth";
import { dentroDelLimite, MENSAJE_LIMITE } from "@/lib/seguridad";

export type RegistroState = {
  status: "idle" | "error" | "revisa-correo";
  message?: string;
  errors?: Partial<Record<"nombres" | "apellidos" | "correo" | "password", string[]>>;
};

export async function registrarCuenta(_prevState: RegistroState, formData: FormData): Promise<RegistroState> {
  // Antes de tocar nada: el registro está abierto a internet y sin freno se
  // podrían crear cuentas en masa (y disparar correos de confirmación).
  if (!(await dentroDelLimite("registro"))) {
    return { status: "error", message: MENSAJE_LIMITE };
  }

  const parsed = registroSchema.safeParse({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    correo: formData.get("correo"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.correo,
    password: parsed.data.password,
    options: {
      /**
       * Sin esto, el enlace del correo lleva al Site URL —la portada— y quien
       * confirma acaba en la página de inicio sin saber si funcionó.
       *
       * Lo fija aquí y no solo en la plantilla porque la plantilla se pega a
       * mano en el panel de Supabase: mientras no se haya hecho, el correo por
       * defecto usa este destino y el flujo termina igual de bien.
       */
      emailRedirectTo: `${sitio}/auth/confirmar?next=/bienvenida`,
    },
  });

  if (error) {
    return { status: "error", message: "No se pudo crear la cuenta: " + error.message };
  }
  if (!data.user) {
    return { status: "error", message: "No se pudo crear la cuenta." };
  }

  // El trigger handle_new_user ya creó la fila en perfiles (id + correo). Completamos
  // nombres/apellidos con el cliente admin porque, si la confirmación de correo está
  // habilitada, todavía no hay sesión activa (auth.uid() sería null para el cliente normal).
  const admin = createAdminClient();
  await admin
    .from("perfiles")
    .update({
      nombres: parsed.data.nombres,
      apellidos: parsed.data.apellidos,
      terminos_aceptados_en: new Date().toISOString(),
    })
    .eq("id", data.user.id);

  if (!data.session) {
    return { status: "revisa-correo" };
  }

  redirect("/portal");
}
