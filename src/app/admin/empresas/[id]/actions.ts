"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperAdmin } from "@/lib/auth/session";
import { editarEmpresaSchema, invitarMiembroSchema } from "@/lib/validacion/empresas";
import { urlPublicaValida, rutaDesdeUrlPublica } from "@/lib/storage/rutas";
import type { RolEmpresa, EstadoMembresia } from "@/lib/supabase/database.types";

export type EmpresaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

async function exigirSuperAdmin() {
  if (!(await esSuperAdmin())) throw new Error("No autorizado.");
}

export async function actualizarEmpresa(
  empresaId: string,
  _prevState: EmpresaState,
  formData: FormData
): Promise<EmpresaState> {
  await exigirSuperAdmin();

  const parsed = editarEmpresaSchema.safeParse({
    nombreComercial: formData.get("nombreComercial"),
    slug: formData.get("slug"),
    correoContacto: formData.get("correoContacto"),
    telefonoContacto: formData.get("telefonoContacto"),
    rtn: formData.get("rtn"),
    colorPrimario: formData.get("colorPrimario"),
    colorSecundario: formData.get("colorSecundario"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: previa } = await supabase
    .from("empresas")
    .select("slug")
    .eq("id", empresaId)
    .maybeSingle();

  const { error } = await supabase
    .from("empresas")
    .update({
      nombre_comercial: d.nombreComercial,
      slug: d.slug,
      correo_contacto: d.correoContacto || null,
      telefono_contacto: d.telefonoContacto || null,
      rtn: d.rtn || null,
      // La columna es NOT NULL con default '{}': se guarda el objeto vacío, no null.
      colores_marca: {
        ...(d.colorPrimario ? { primario: d.colorPrimario } : {}),
        ...(d.colorSecundario ? { secundario: d.colorSecundario } : {}),
      },
    })
    .eq("id", empresaId);

  if (error) {
    const mensaje = error.message.includes("empresas_slug_key")
      ? "Ese identificador de URL ya lo usa otra empresa."
      : "No se pudo guardar: " + error.message;
    return { status: "error", message: mensaje };
  }

  revalidatePath(`/admin/empresas/${empresaId}`);
  revalidatePath("/admin/empresas");
  // La landing pública cuelga del slug: hay que revalidar la vieja y la nueva.
  if (previa?.slug && previa.slug !== d.slug) revalidatePath(`/organizadores/${previa.slug}`);
  revalidatePath(`/organizadores/${d.slug}`);

  return { status: "guardado" };
}

/**
 * El logo lo sube el navegador directamente a Storage; aquí solo se guarda la URL
 * tras comprobar que apunta a la carpeta de esta empresa.
 */
export async function guardarLogo(empresaId: string, url: string) {
  await exigirSuperAdmin();
  if (!urlPublicaValida(url, "logos-empresa", empresaId)) {
    throw new Error("El logo no pertenece a esta empresa.");
  }

  const supabase = await createClient();
  const { data: previa } = await supabase
    .from("empresas")
    .select("slug, logo_url")
    .eq("id", empresaId)
    .maybeSingle();

  const { error } = await supabase.from("empresas").update({ logo_url: url }).eq("id", empresaId);
  if (error) throw new Error("No se pudo guardar el logo: " + error.message);

  const anterior = previa?.logo_url && rutaDesdeUrlPublica(previa.logo_url, "logos-empresa");
  if (anterior) await supabase.storage.from("logos-empresa").remove([anterior]);

  revalidatePath(`/admin/empresas/${empresaId}`);
  if (previa?.slug) revalidatePath(`/organizadores/${previa.slug}`);
}

export async function quitarLogo(empresaId: string) {
  await exigirSuperAdmin();
  const supabase = await createClient();

  const { data: previa } = await supabase
    .from("empresas")
    .select("slug, logo_url")
    .eq("id", empresaId)
    .maybeSingle();

  await supabase.from("empresas").update({ logo_url: null }).eq("id", empresaId);

  const ruta = previa?.logo_url && rutaDesdeUrlPublica(previa.logo_url, "logos-empresa");
  if (ruta) await supabase.storage.from("logos-empresa").remove([ruta]);

  revalidatePath(`/admin/empresas/${empresaId}`);
  if (previa?.slug) revalidatePath(`/organizadores/${previa.slug}`);
}

export type InvitarState = { status: "idle" | "error" | "invitado"; message?: string };

export async function invitarMiembro(
  empresaId: string,
  _prevState: InvitarState,
  formData: FormData
): Promise<InvitarState> {
  await exigirSuperAdmin();

  const parsed = invitarMiembroSchema.safeParse({
    correo: formData.get("correo"),
    rol: formData.get("rol"),
  });
  if (!parsed.success) {
    const primero = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { status: "error", message: primero ?? "Revisa los datos." };
  }
  const { correo, rol } = parsed.data;

  const admin = createAdminClient();
  const { data: perfil } = await admin
    .from("perfiles")
    .select("id")
    .ilike("correo", correo)
    .maybeSingle();

  let usuarioId = perfil?.id;
  if (!usuarioId) {
    const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { data, error } = await admin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: `${sitio}/auth/confirmar?next=/panel`,
    });
    if (error || !data.user) {
      return { status: "error", message: "No se pudo enviar la invitación: " + (error?.message ?? "") };
    }
    usuarioId = data.user.id;
  }

  const { error } = await admin
    .from("empresa_miembros")
    .upsert(
      { empresa_id: empresaId, usuario_id: usuarioId, rol, estado: "invitado" },
      { onConflict: "empresa_id,usuario_id" }
    );
  if (error) {
    return { status: "error", message: "No se pudo registrar la invitación: " + error.message };
  }

  revalidatePath(`/admin/empresas/${empresaId}`);
  return { status: "invitado" };
}

/**
 * Cuenta los administradores que de verdad pueden operar la empresa: solo cuentan
 * los `activo`. Un `invitado` todavía no ha aceptado, así que no pasa las funciones
 * de rol de la base de datos y no sirve como último responsable.
 */
async function otrosAdminsActivos(empresaId: string, excluyendoUsuarioId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("empresa_miembros")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("rol", "admin_empresa")
    .eq("estado", "activo")
    .neq("usuario_id", excluyendoUsuarioId);
  return count ?? 0;
}

/** Mensaje único para las tres operaciones que pueden dejar la empresa sin gobierno. */
const SIN_ADMIN =
  "Es el único administrador activo de la empresa. Nombra a otro antes de cambiarlo, o la empresa se queda sin quien la gestione.";

export async function cambiarRolMiembro(empresaId: string, usuarioId: string, rol: RolEmpresa) {
  await exigirSuperAdmin();

  if (rol !== "admin_empresa" && (await otrosAdminsActivos(empresaId, usuarioId)) === 0) {
    throw new Error(SIN_ADMIN);
  }

  const { error } = await createAdminClient()
    .from("empresa_miembros")
    .update({ rol })
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo cambiar el rol: " + error.message);

  revalidatePath(`/admin/empresas/${empresaId}`);
}

export async function cambiarEstadoMiembro(
  empresaId: string,
  usuarioId: string,
  estado: EstadoMembresia
) {
  await exigirSuperAdmin();

  if (estado !== "activo" && (await otrosAdminsActivos(empresaId, usuarioId)) === 0) {
    const { data: miembro } = await createAdminClient()
      .from("empresa_miembros")
      .select("rol")
      .eq("empresa_id", empresaId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (miembro?.rol === "admin_empresa") throw new Error(SIN_ADMIN);
  }

  const { error } = await createAdminClient()
    .from("empresa_miembros")
    .update({ estado })
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo cambiar el estado: " + error.message);

  revalidatePath(`/admin/empresas/${empresaId}`);
}

export async function eliminarMiembro(empresaId: string, usuarioId: string) {
  await exigirSuperAdmin();

  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("empresa_miembros")
    .select("rol")
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  if (miembro?.rol === "admin_empresa" && (await otrosAdminsActivos(empresaId, usuarioId)) === 0) {
    throw new Error(SIN_ADMIN);
  }

  const { error } = await admin
    .from("empresa_miembros")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("usuario_id", usuarioId);
  if (error) throw new Error("No se pudo quitar del equipo: " + error.message);

  revalidatePath(`/admin/empresas/${empresaId}`);
}
