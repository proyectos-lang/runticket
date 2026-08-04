"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilSchema } from "@/lib/validacion/perfil";
import { rutaInternaSegura } from "@/lib/seguridad";

export type PerfilState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function guardarPerfil(
  _prevState: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/perfil");

  const parsed = perfilSchema.safeParse({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    telefono: formData.get("telefono"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    sexo: formData.get("sexo"),
    documentoIdentidad: formData.get("documentoIdentidad"),
    paisId: formData.get("paisId"),
    departamentoId: formData.get("departamentoId"),
    ciudadId: formData.get("ciudadId"),
    nacionalidad: formData.get("nacionalidad"),
    tallaPredeterminada: formData.get("tallaPredeterminada"),
    tipoSangre: formData.get("tipoSangre"),
    contactoEmergenciaNombre: formData.get("contactoEmergenciaNombre"),
    contactoEmergenciaParentesco: formData.get("contactoEmergenciaParentesco"),
    contactoEmergenciaTelefono: formData.get("contactoEmergenciaTelefono"),
    ocupacion: formData.get("ocupacion"),
    comoSeEntero: formData.get("comoSeEntero"),
    nivelExperiencia: formData.get("nivelExperiencia"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const d = parsed.data;

  // `|| null` en vez de un helper: los campos opcionales llegan como "" desde el
  // formulario y así se conserva el tipo literal de los que son enumerados.
  const { error } = await supabase
    .from("perfiles")
    .update({
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono || null,
      fecha_nacimiento: d.fechaNacimiento,
      sexo: d.sexo,
      documento_identidad: d.documentoIdentidad || null,
      pais_id: d.paisId || null,
      departamento_id: d.departamentoId || null,
      ciudad_id: d.ciudadId || null,
      nacionalidad: d.nacionalidad || null,
      talla_predeterminada: d.tallaPredeterminada || null,
      tipo_sangre: d.tipoSangre || null,
      contacto_emergencia_nombre: d.contactoEmergenciaNombre,
      contacto_emergencia_parentesco: d.contactoEmergenciaParentesco || null,
      contacto_emergencia_telefono: d.contactoEmergenciaTelefono,
      ocupacion: d.ocupacion || null,
      como_se_entero: d.comoSeEntero || null,
      nivel_experiencia: d.nivelExperiencia || null,
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: "No se pudo guardar el perfil: " + error.message };
  }

  revalidatePath("/portal/perfil");

  // Si venía del flujo de inscripción, vuelve a donde estaba.
  const destino = rutaInternaSegura(formData.get("next"));
  if (destino) redirect(destino);

  return { status: "guardado" };
}
