"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acompananteSchema } from "@/lib/validacion/acompanantes";

export type AcompananteState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/** Los datos que la inscripción necesita de una persona. */
function aPerfil(d: ReturnType<typeof acompananteSchema.parse>) {
  return {
    nombres: d.nombres,
    apellidos: d.apellidos,
    fecha_nacimiento: d.fechaNacimiento,
    sexo: d.sexo,
    documento_identidad: d.documentoIdentidad || null,
    talla_predeterminada: d.tallaPredeterminada || null,
    contacto_emergencia_nombre: d.contactoEmergenciaNombre || null,
    contacto_emergencia_telefono: d.contactoEmergenciaTelefono || null,
  };
}

/**
 * Da de alta o actualiza a un acompañante.
 *
 * Crea por detrás una cuenta que **nunca recibe un correo ni puede iniciar
 * sesión**: `email_confirm: true` y sin contraseña, igual que hace el panel al
 * inscribir a alguien en la mesa. Hace falta porque `inscripciones.corredor_id`
 * exige un usuario; a cambio, el acompañante tiene perfil y todo lo demás
 * —categoría por edad, dorsal, resultados, certificado— funciona sin excepciones.
 *
 * Sin correo se genera una dirección interna que nadie usa jamás. Con correo, esa
 * persona puede reclamar su cuenta más adelante desde «recuperar contraseña».
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

    const { error } = await admin.from("perfiles").update(aPerfil(d)).eq("id", relacion.usuario_id);
    if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

    await admin.from("acompanantes").update({ parentesco: d.parentesco }).eq("id", acompananteId);
    revalidatePath("/portal/acompanantes");
    return { status: "guardado" };
  }

  // ── Alta ───────────────────────────────────────────────────────────────────
  let usuarioId: string | undefined;

  if (d.correo) {
    // Si ya hay cuenta con ese correo se reutiliza, en vez de fallar: es lo que
    // pasa cuando alguien inscribe a su pareja, que quizá ya se registró sola.
    const { data: existente } = await admin
      .from("perfiles")
      .select("id")
      .ilike("correo", d.correo)
      .maybeSingle();
    usuarioId = existente?.id;

    if (usuarioId === user.id) {
      return { status: "error", message: "Ese es tu propio correo." };
    }
  }

  if (!usuarioId) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      // Sin correo real se usa una dirección interna no enrutable: `createUser`
      // exige una y este acompañante no va a recibir nada nunca.
      email: d.correo || `acompanante-${crypto.randomUUID()}@interno.runticket.hn`,
      email_confirm: true,
      user_metadata: { nombres: d.nombres, apellidos: d.apellidos, gestionado_por: user.id },
    });
    if (error || !creado.user) {
      return {
        status: "error",
        message: "No se pudo crear el acompañante: " + (error?.message ?? "error desconocido"),
      };
    }
    usuarioId = creado.user.id;
  }

  const { error: errorPerfil } = await admin.from("perfiles").update(aPerfil(d)).eq("id", usuarioId);
  if (errorPerfil) {
    return { status: "error", message: "No se pudieron guardar sus datos: " + errorPerfil.message };
  }

  const { error: errorRelacion } = await admin
    .from("acompanantes")
    .upsert(
      { titular_id: user.id, usuario_id: usuarioId, parentesco: d.parentesco },
      { onConflict: "titular_id,usuario_id" }
    );
  if (errorRelacion) {
    return { status: "error", message: "No se pudo asociar: " + errorRelacion.message };
  }

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
