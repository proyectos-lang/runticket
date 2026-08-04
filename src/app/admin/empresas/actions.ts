"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esSuperAdmin } from "@/lib/auth/session";
import { crearEmpresaSchema } from "@/lib/validacion/empresas";

export type CrearEmpresaState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<"nombreComercial" | "slug" | "correoContacto" | "telefonoContacto" | "rtn", string[]>>;
};

export async function crearEmpresa(_prevState: CrearEmpresaState, formData: FormData): Promise<CrearEmpresaState> {
  if (!(await esSuperAdmin())) {
    return { status: "error", message: "No autorizado." };
  }

  const parsed = crearEmpresaSchema.safeParse({
    nombreComercial: formData.get("nombreComercial"),
    slug: formData.get("slug"),
    correoContacto: formData.get("correoContacto"),
    telefonoContacto: formData.get("telefonoContacto"),
    rtn: formData.get("rtn"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .insert({
      nombre_comercial: parsed.data.nombreComercial,
      slug: parsed.data.slug,
      correo_contacto: parsed.data.correoContacto || null,
      telefono_contacto: parsed.data.telefonoContacto || null,
      rtn: parsed.data.rtn || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "No se pudo crear la empresa: " + (error?.message ?? "") };
  }

  revalidatePath("/admin/empresas");
  redirect(`/admin/empresas/${data.id}`);
}

// Aquí vivían `InvitarAdminState` e `invitarAdminEmpresa`. Se han eliminado:
// nadie las importaba y duplicaban a `invitarMiembro`
// (src/app/admin/empresas/[id]/actions.ts), que sí está en uso desde
// InvitarMiembroForm y además permite elegir el rol en vez de forzar
// administrador. Mantener dos altas de miembro divergentes solo garantizaba que
// una de las dos se quedara sin los arreglos de la otra.

export async function actualizarEstadoEmpresa(
  empresaId: string,
  nuevoEstado: "activa" | "suspendida",
) {
  if (!(await esSuperAdmin())) {
    throw new Error("No autorizado.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("empresas").update({ estado: nuevoEstado }).eq("id", empresaId);
  if (error) {
    throw new Error("No se pudo actualizar el estado: " + error.message);
  }

  revalidatePath(`/admin/empresas/${empresaId}`);
  revalidatePath("/admin/empresas");
}
