"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { esSuperAdmin } from "@/lib/auth/session";
import { crearUsuarioSchema } from "@/lib/validacion/usuarios";
import { auditar } from "@/lib/seguridad";
import type { RolPlataforma } from "@/lib/supabase/database.types";

/**
 * Cambia el rol de plataforma. El trigger `proteger_rol_plataforma` vuelve a
 * comprobarlo en la base de datos: nadie puede ascenderse a sí mismo por la API.
 */
export async function cambiarRolPlataforma(usuarioId: string, rol: RolPlataforma) {
  if (!(await esSuperAdmin())) throw new Error("No autorizado.");

  const admin = createAdminClient();

  // Quitarse el propio super_admin dejaría la plataforma sin quien la gobierne si
  // es el último; y aunque no lo fuera, es casi siempre un accidente.
  if (rol !== "super_admin") {
    const { count } = await admin
      .from("perfiles")
      .select("*", { count: "exact", head: true })
      .eq("rol_plataforma", "super_admin")
      .neq("id", usuarioId);
    if ((count ?? 0) === 0) {
      throw new Error("Es el único super administrador de la plataforma. Nombra a otro primero.");
    }
  }

  const { error } = await admin.from("perfiles").update({ rol_plataforma: rol }).eq("id", usuarioId);
  if (error) throw new Error("No se pudo cambiar el rol: " + error.message);

  revalidatePath("/admin/usuarios");
}

export type CrearUsuarioState = {
  status: "idle" | "error" | "creado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/**
 * Da de alta una cuenta con contraseña y, si se indica, la mete en una empresa
 * ya activa.
 *
 * Se diferencia de `invitarMiembro` (ficha de la empresa) en que **no depende
 * del correo**: aquella envía una invitación que la persona tiene que aceptar, y
 * mientras no lo haga su membresía queda en `invitado`, un estado que las
 * funciones de rol de la base de datos no reconocen. Aquí la cuenta queda
 * utilizable en el acto, que es lo que hace falta para montar un entorno o para
 * dar de alta a alguien cuyo correo no recibe nada todavía.
 */
export async function crearUsuario(
  _prevState: CrearUsuarioState,
  formData: FormData
): Promise<CrearUsuarioState> {
  if (!(await esSuperAdmin())) return { status: "error", message: "No autorizado." };

  const parsed = crearUsuarioSchema.safeParse({
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    correo: formData.get("correo"),
    password: formData.get("password"),
    rolPlataforma: formData.get("rolPlataforma"),
    empresaId: formData.get("empresaId"),
    rolEmpresa: formData.get("rolEmpresa"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  // La empresa se comprueba antes de crear la cuenta: si el id no vale, es
  // preferible no dejar un usuario suelto sin membresía.
  if (d.empresaId) {
    const { data: empresa } = await admin
      .from("empresas")
      .select("id")
      .eq("id", d.empresaId)
      .maybeSingle();
    if (!empresa) return { status: "error", message: "Esa empresa ya no existe." };
  }

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: d.correo,
    password: d.password,
    // Sin confirmación por correo: es un alta manual y el super-admin responde
    // de que la dirección es correcta. Si no, la cuenta no podría entrar nunca.
    email_confirm: true,
  });
  if (errorAuth || !creado.user) {
    const yaExiste = /already|registered|exists/i.test(errorAuth?.message ?? "");
    return {
      status: "error",
      message: yaExiste
        ? "Ya hay una cuenta con ese correo. Búscala en la lista y añádela a la empresa desde su ficha."
        : "No se pudo crear la cuenta: " + (errorAuth?.message ?? "error desconocido"),
    };
  }
  const usuarioId = creado.user.id;

  // El disparador `handle_new_user` ya creó la fila de perfil con el correo; aquí
  // solo se completan nombre y rol.
  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({
      nombres: d.nombres,
      apellidos: d.apellidos,
      rol_plataforma: d.rolPlataforma,
    })
    .eq("id", usuarioId);
  if (errorPerfil) {
    return { status: "error", message: "Cuenta creada, pero falló el perfil: " + errorPerfil.message };
  }

  if (d.empresaId && d.rolEmpresa) {
    // `activo` y no `invitado`: no hay invitación que aceptar, y en `invitado`
    // las funciones de rol de la base de datos no lo reconocerían como miembro.
    const { error: errorMiembro } = await admin.from("empresa_miembros").upsert(
      { empresa_id: d.empresaId, usuario_id: usuarioId, rol: d.rolEmpresa, estado: "activo" },
      { onConflict: "empresa_id,usuario_id" }
    );
    if (errorMiembro) {
      return {
        status: "error",
        message: "Cuenta creada, pero no se pudo asociar a la empresa: " + errorMiembro.message,
      };
    }
  }

  await auditar({
    accion: "usuario.creado",
    entidad: "perfiles",
    entidadId: usuarioId,
    empresaId: d.empresaId ?? null,
    datosNuevos: {
      correo: d.correo,
      rol_plataforma: d.rolPlataforma,
      rol_empresa: d.rolEmpresa ?? null,
    },
  });

  revalidatePath("/admin/usuarios");
  if (d.empresaId) revalidatePath(`/admin/empresas/${d.empresaId}`);
  return { status: "creado" };
}
