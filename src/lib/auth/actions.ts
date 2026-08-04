"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_EMPRESA, getMembresiasActivas } from "@/lib/auth/session";

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // La empresa elegida es del usuario que se va, no del siguiente que entre.
  (await cookies()).delete(COOKIE_EMPRESA);
  redirect("/login");
}

/**
 * Fija la empresa sobre la que opera el panel. Se valida contra las membresías
 * reales antes de escribir la cookie: nadie debe poder abrirse paso a otra empresa
 * fabricando el valor. Tras cambiar se vuelve al listado, porque el evento que
 * estuviera abierto pertenece a la empresa anterior.
 */
export async function seleccionarEmpresaActiva(empresaId: string) {
  const membresias = await getMembresiasActivas();
  if (!membresias.some((m) => m.empresaId === empresaId)) {
    throw new Error("No tienes acceso a esa empresa.");
  }

  (await cookies()).set(COOKIE_EMPRESA, empresaId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/panel/eventos");
}

export async function aceptarInvitacionEmpresa(empresaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("aceptar_invitacion_empresa", { p_empresa_id: empresaId });
  if (error) {
    throw new Error("No se pudo aceptar la invitación: " + error.message);
  }
  revalidatePath("/panel");
}
