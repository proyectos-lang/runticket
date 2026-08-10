"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esSuperAdmin } from "@/lib/auth/session";
import { crearEmpresaSchema } from "@/lib/validacion/empresas";
import { generarSlug } from "@/lib/slug";

export type CrearEmpresaState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<Record<"nombreComercial" | "correoContacto" | "telefonoContacto" | "rtn", string[]>>;
};

/** `mi-empresa`, `mi-empresa-2`, `mi-empresa-3`… */
const candidato = (base: string, n: number) => (n === 1 ? base : `${base}-${n}`);

/**
 * Da de alta una empresa. **El slug no se pide: se deriva del nombre comercial.**
 *
 * Como ya no hay campo que corregir, una colisión no la puede resolver quien
 * rellena el formulario: la resuelve esto. Se piden de una vez los slugs
 * parecidos y se ocupa el primer hueco, y aun así el `insert` se reintenta si
 * choca, porque entre la consulta y la escritura cabe otra alta simultánea y esa
 * carrera la gana el índice único, no nosotros.
 */
export async function crearEmpresa(_prevState: CrearEmpresaState, formData: FormData): Promise<CrearEmpresaState> {
  if (!(await esSuperAdmin())) {
    return { status: "error", message: "No autorizado." };
  }

  const parsed = crearEmpresaSchema.safeParse({
    nombreComercial: formData.get("nombreComercial"),
    correoContacto: formData.get("correoContacto"),
    telefonoContacto: formData.get("telefonoContacto"),
    rtn: formData.get("rtn"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const base = generarSlug(parsed.data.nombreComercial);
  if (!base) {
    // Un nombre de puros signos («+++») deja el slug vacío. Es raro, pero sin
    // esto el insert fallaría con un error de base de datos ilegible.
    return {
      status: "error",
      errors: {
        nombreComercial: ["El nombre necesita alguna letra o número para poder formar su dirección."],
      },
    };
  }

  const supabase = await createClient();

  const { data: parecidos } = await supabase.from("empresas").select("slug").like("slug", `${base}%`);
  const ocupados = new Set((parecidos ?? []).map((e) => e.slug));

  let n = 1;
  while (ocupados.has(candidato(base, n))) n++;

  const datos = {
    nombre_comercial: parsed.data.nombreComercial,
    correo_contacto: parsed.data.correoContacto || null,
    telefono_contacto: parsed.data.telefonoContacto || null,
    rtn: parsed.data.rtn || null,
  };

  let creada: { id: string } | null = null;
  for (let intento = 0; intento < 5 && !creada; intento++, n++) {
    const { data, error } = await supabase
      .from("empresas")
      .insert({ ...datos, slug: candidato(base, n) })
      .select("id")
      .single();

    if (data) {
      creada = data;
      break;
    }
    // Cualquier fallo que no sea el slug repetido es otra cosa y no se arregla
    // probando otro número.
    if (!error?.message.includes("empresas_slug_key")) {
      return { status: "error", message: "No se pudo crear la empresa: " + (error?.message ?? "") };
    }
  }

  if (!creada) {
    return {
      status: "error",
      message: "No se pudo reservar una dirección para esa empresa. Prueba con un nombre más específico.",
    };
  }

  revalidatePath("/admin/empresas");
  redirect(`/admin/empresas/${creada.id}`);
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
