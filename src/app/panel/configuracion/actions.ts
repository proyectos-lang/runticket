"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminEmpresaActivo } from "@/lib/auth/session";
import { editarEmpresaSchema, type EmpresaState } from "@/lib/validacion/empresas";
import { urlPublicaValida, rutaDesdeUrlPublica } from "@/lib/storage/rutas";
import { tagOrganizador } from "@/lib/supabase/publico";
import { auditar } from "@/lib/seguridad";

/**
 * La empresa edita su propia ficha desde el panel.
 *
 * **Ninguna de estas acciones recibe un `empresaId`.** Lo saca de
 * `requireAdminEmpresaActivo()`, es decir, de la sesión. Es la diferencia con
 * las de la consola de plataforma, que sí lo reciben porque el super-admin
 * gobierna cualquiera: si aquí viajara en el formulario, un administrador
 * podría cambiarlo a mano y editar la ficha de otra empresa. Con el id fuera
 * del alcance del cliente, ese ataque no existe.
 *
 * La base ya respalda esto sin cambios: la política `empresas_update` (0002)
 * autoriza a `es_admin_o_super(id)`, que incluye al administrador activo de la
 * empresa, y el disparador `proteger_estado_empresa` impide que nadie que no
 * sea super-admin toque `estado`. Aunque el formulario mandara `estado`, la base
 * lo rechazaría; aquí ni siquiera se lee.
 */

/** Invalida lo que depende de la ficha: el panel y su página pública. */
async function revalidar(slugAnterior: string | null, slugNuevo: string) {
  revalidatePath("/panel/configuracion");
  // La landing pública va cacheada por etiqueta, no por ruta: sin esto el
  // organizador cambiaría su teléfono y seguiría saliendo el viejo.
  updateTag(tagOrganizador(slugNuevo));
  revalidatePath(`/organizadores/${slugNuevo}`);
  if (slugAnterior && slugAnterior !== slugNuevo) {
    updateTag(tagOrganizador(slugAnterior));
    revalidatePath(`/organizadores/${slugAnterior}`);
  }
}

export async function actualizarMiEmpresa(
  _prevState: EmpresaState,
  formData: FormData
): Promise<EmpresaState> {
  const membresia = await requireAdminEmpresaActivo();

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
    .eq("id", membresia.empresaId)
    .maybeSingle();

  const { error } = await supabase
    .from("empresas")
    .update({
      nombre_comercial: d.nombreComercial,
      slug: d.slug,
      correo_contacto: d.correoContacto || null,
      telefono_contacto: d.telefonoContacto || null,
      rtn: d.rtn || null,
      colores_marca: {
        ...(d.colorPrimario ? { primario: d.colorPrimario } : {}),
        ...(d.colorSecundario ? { secundario: d.colorSecundario } : {}),
      },
    })
    .eq("id", membresia.empresaId);

  if (error) {
    const mensaje = error.message.includes("empresas_slug_key")
      ? "Esa dirección pública ya la usa otra empresa. Prueba con otra."
      : "No se pudo guardar: " + error.message;
    return { status: "error", message: mensaje };
  }

  await auditar({
    accion: "empresa.editar_propia",
    entidad: "empresas",
    entidadId: membresia.empresaId,
    empresaId: membresia.empresaId,
    datosNuevos: { nombre_comercial: d.nombreComercial, slug: d.slug },
  });

  await revalidar(previa?.slug ?? null, d.slug);
  return { status: "guardado" };
}

export async function guardarMiLogo(url: string) {
  const membresia = await requireAdminEmpresaActivo();
  // La ruta del archivo tiene que caer dentro de la carpeta de ESTA empresa.
  // La política del bucket ya lo exige, pero comprobarlo aquí evita guardar en
  // `logo_url` una dirección que apunte a la carpeta de otra.
  if (!urlPublicaValida(url, "logos-empresa", membresia.empresaId)) {
    throw new Error("El logo no pertenece a esta empresa.");
  }

  const supabase = await createClient();
  const { data: previa } = await supabase
    .from("empresas")
    .select("slug, logo_url")
    .eq("id", membresia.empresaId)
    .maybeSingle();

  const { error } = await supabase
    .from("empresas")
    .update({ logo_url: url })
    .eq("id", membresia.empresaId);
  if (error) throw new Error("No se pudo guardar el logo: " + error.message);

  // El anterior se borra del bucket: si no, cada reemplazo deja un huérfano que
  // nadie va a limpiar nunca.
  const anterior = previa?.logo_url && rutaDesdeUrlPublica(previa.logo_url, "logos-empresa");
  if (anterior) await supabase.storage.from("logos-empresa").remove([anterior]);

  if (previa?.slug) await revalidar(null, previa.slug);
}

export async function quitarMiLogo() {
  const membresia = await requireAdminEmpresaActivo();

  const supabase = await createClient();
  const { data: previa } = await supabase
    .from("empresas")
    .select("slug, logo_url")
    .eq("id", membresia.empresaId)
    .maybeSingle();

  const { error } = await supabase
    .from("empresas")
    .update({ logo_url: null })
    .eq("id", membresia.empresaId);
  if (error) throw new Error("No se pudo quitar el logo: " + error.message);

  const anterior = previa?.logo_url && rutaDesdeUrlPublica(previa.logo_url, "logos-empresa");
  if (anterior) await supabase.storage.from("logos-empresa").remove([anterior]);

  if (previa?.slug) await revalidar(null, previa.slug);
}
