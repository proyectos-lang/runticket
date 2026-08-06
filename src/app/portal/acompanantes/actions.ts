"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acompananteSchema } from "@/lib/validacion/acompanantes";
import { altaDeAcompanante, perfilDeAcompanante } from "@/lib/acompanantes/alta";

export type AcompananteState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/**
 * Da de alta o actualiza a un acompañante desde la lista del portal.
 *
 * El alta en sí vive en `@/lib/acompanantes/alta`, porque el formulario de
 * inscripción también deja añadir a alguien sin salir de él y las dos vías
 * tienen que crear exactamente la misma cuenta silenciosa.
 */
export async function guardarAcompanante(
  acompananteId: string | null,
  _prevState: AcompananteState,
  formData: FormData
): Promise<AcompananteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/acompanantes");

  const parsed = acompananteSchema.safeParse({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    sexo: formData.get("sexo"),
    parentesco: formData.get("parentesco"),
    correo: formData.get("correo"),
    documentoIdentidad: formData.get("documentoIdentidad"),
    tallaPredeterminada: formData.get("tallaPredeterminada"),
    contactoEmergenciaNombre: formData.get("contactoEmergenciaNombre"),
    contactoEmergenciaTelefono: formData.get("contactoEmergenciaTelefono"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  const admin = createAdminClient();

  // ── Edición ────────────────────────────────────────────────────────────────
  if (acompananteId) {
    const { data: relacion } = await supabase
      .from("acompanantes")
      .select("usuario_id")
      .eq("id", acompananteId)
      .eq("titular_id", user.id)
      .maybeSingle();
    if (!relacion) return { status: "error", message: "Ese acompañante no es tuyo." };

    const { error } = await admin
      .from("perfiles")
      .update(perfilDeAcompanante(d))
      .eq("id", relacion.usuario_id);
    if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

    await admin.from("acompanantes").update({ parentesco: d.parentesco }).eq("id", acompananteId);
    revalidatePath("/portal/acompanantes");
    return { status: "guardado" };
  }

  // ── Alta ───────────────────────────────────────────────────────────────────
  const resultado = await altaDeAcompanante(user.id, d);
  if (!resultado.ok) return { status: "error", message: resultado.message };

  revalidatePath("/portal/acompanantes");
  return { status: "guardado" };
}

/**
 * Quita a un acompañante de la lista.
 *
 * **No borra su cuenta ni sus inscripciones**: si ya corrió una carrera, su
 * dorsal, su resultado y su certificado son suyos y tienen que sobrevivir. Solo
 * deja de aparecer para inscribirlo de nuevo.
 */
export async function quitarAcompanante(acompananteId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/acompanantes");

  const { error } = await supabase
    .from("acompanantes")
    .delete()
    .eq("id", acompananteId)
    .eq("titular_id", user.id);
  if (error) throw new Error("No se pudo quitar: " + error.message);

  revalidatePath("/portal/acompanantes");
}
