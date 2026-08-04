import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RolEmpresa } from "@/lib/supabase/database.types";

export async function getUsuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getPerfilActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("perfiles").select("*").eq("id", user.id).maybeSingle();
  return data;
}

export async function esSuperAdmin() {
  const perfil = await getPerfilActual();
  return perfil?.rol_plataforma === "super_admin";
}

export type MembresiaEmpresa = {
  empresaId: string;
  rol: RolEmpresa;
  nombreComercial: string;
  slug: string;
};

/** Empresas donde el usuario actual tiene membresía activa (admin_empresa u operador). */
export async function getMembresiasActivas(): Promise<MembresiaEmpresa[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: membresias } = await supabase
    .from("empresa_miembros")
    .select("empresa_id, rol")
    .eq("usuario_id", user.id)
    .eq("estado", "activo");
  if (!membresias || membresias.length === 0) return [];

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nombre_comercial, slug")
    .in(
      "id",
      membresias.map((m) => m.empresa_id)
    );

  return membresias
    .map((m) => {
      const empresa = empresas?.find((e) => e.id === m.empresa_id);
      return {
        empresaId: m.empresa_id,
        rol: m.rol,
        nombreComercial: empresa?.nombre_comercial ?? "",
        slug: empresa?.slug ?? "",
      };
    })
    // Orden determinista: Postgres no garantiza ninguno sin ORDER BY, y como la
    // primera membresía es la que se usa por defecto, sin esto el rol efectivo
    // podía cambiar entre sesiones y hacer desaparecer módulos del panel.
    // Los administradores van antes que los operadores para que, si el usuario
    // es ambas cosas en empresas distintas, entre con el rol más capaz.
    .sort(
      (a, b) =>
        Number(b.rol === "admin_empresa") - Number(a.rol === "admin_empresa") ||
        a.nombreComercial.localeCompare(b.nombreComercial, "es")
    );
}

export async function getMembresiaDeEmpresa(empresaId: string): Promise<MembresiaEmpresa | null> {
  const membresias = await getMembresiasActivas();
  return membresias.find((m) => m.empresaId === empresaId) ?? null;
}

export const COOKIE_EMPRESA = "rt_empresa";

/**
 * Empresa sobre la que opera el panel. Sale de una cookie que solo escribe
 * `seleccionarEmpresaActiva`, y **siempre se valida contra las membresías reales**:
 * una cookie manipulada o una membresía revocada no deben dar acceso.
 */
export async function getEmpresaActivaDelPanel(): Promise<MembresiaEmpresa> {
  const membresias = await getMembresiasActivas();
  if (membresias.length === 0) {
    redirect("/panel");
  }

  const elegida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  return membresias.find((m) => m.empresaId === elegida) ?? membresias[0];
}

/**
 * True cuando el usuario tiene varias empresas y todavía no ha elegido una
 * válida. El layout lo usa para pedirle que escoja en vez de meterlo en una al
 * azar: entrar como operador en la empresa equivocada hace desaparecer medio
 * panel sin explicación.
 */
export async function necesitaElegirEmpresa(): Promise<boolean> {
  const membresias = await getMembresiasActivas();
  if (membresias.length <= 1) return false;
  const elegida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  return !membresias.some((m) => m.empresaId === elegida);
}

/** Usar al inicio de Server Actions que crean/editan eventos, categorías, tallas, etc. */
export async function requireAdminEmpresaActivo(): Promise<MembresiaEmpresa> {
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") {
    throw new Error("Solo un administrador de la empresa puede realizar esta acción.");
  }
  return membresia;
}

/**
 * Guarda por recurso: comprueba la membresía sobre la empresa **dueña del recurso**,
 * no sobre la que esté activa en la cookie. Sin esto, alguien con dos membresías
 * podría actuar sobre la empresa B teniendo seleccionada la A.
 */
export async function requireAdminDeEmpresa(empresaId: string): Promise<MembresiaEmpresa> {
  const membresia = await getMembresiaDeEmpresa(empresaId);
  if (!membresia || membresia.rol !== "admin_empresa") {
    throw new Error("No tienes permisos de administrador sobre esta empresa.");
  }
  return membresia;
}

/** Igual que la anterior, resolviendo primero a qué empresa pertenece el evento. */
export async function requireAdminDeEvento(eventoId: string): Promise<{
  membresia: MembresiaEmpresa;
  empresaId: string;
}> {
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("empresa_id")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) throw new Error("El evento no existe.");

  return { membresia: await requireAdminDeEmpresa(evento.empresa_id), empresaId: evento.empresa_id };
}

/** Versión que también acepta operador: check-in y consulta de inscritos. */
export async function requireMiembroDeEvento(eventoId: string): Promise<{
  membresia: MembresiaEmpresa;
  empresaId: string;
}> {
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("empresa_id")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) throw new Error("El evento no existe.");

  const membresia = await getMembresiaDeEmpresa(evento.empresa_id);
  if (!membresia) throw new Error("No tienes acceso a este evento.");
  return { membresia, empresaId: evento.empresa_id };
}

export type InvitacionPendiente = {
  empresaId: string;
  nombreComercial: string;
};

/** Invitaciones (empresa_miembros en estado 'invitado') aún no aceptadas por el usuario actual. */
export async function getInvitacionesPendientes(): Promise<InvitacionPendiente[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: invitaciones } = await supabase
    .from("empresa_miembros")
    .select("empresa_id")
    .eq("usuario_id", user.id)
    .eq("estado", "invitado");
  if (!invitaciones || invitaciones.length === 0) return [];

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nombre_comercial")
    .in(
      "id",
      invitaciones.map((i) => i.empresa_id)
    );

  return invitaciones.map((i) => ({
    empresaId: i.empresa_id,
    nombreComercial: empresas?.find((e) => e.id === i.empresa_id)?.nombre_comercial ?? "",
  }));
}
