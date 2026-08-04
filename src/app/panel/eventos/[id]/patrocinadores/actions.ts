"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { patrocinadorSchema } from "@/lib/validacion/eventos";
import { urlPublicaValida, rutaDesdeUrlPublica, prefijoEvento } from "@/lib/storage/rutas";

export type PatrocinadorState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

async function revalidar(eventoId: string) {
  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidatePath(`/panel/eventos/${eventoId}/patrocinadores`);
  // Los patrocinadores salen en la ficha pública, en el dorsal y en el certificado.
  if (evento?.slug) revalidatePath(`/eventos/${evento.slug}`);
}

/**
 * Crea o actualiza un patrocinador, logo incluido.
 *
 * El logo se guarda **en el mismo envío** que el nombre y la web. Antes vivía en
 * un subidor aparte, debajo de la tarjeta de cada patrocinador ya creado, así que
 * al añadir uno nuevo el formulario solo pedía nombre y sitio: había que crearlo
 * primero y subir el logo después, en un segundo paso que no se veía.
 *
 * El navegador sube el archivo a Storage por su cuenta —las Server Actions topan
 * en 1 MB— y aquí solo llega su URL, que se comprueba contra la carpeta de este
 * evento antes de guardarla.
 */
export async function guardarPatrocinador(
  eventoId: string,
  patrocinadorId: string | null,
  _prevState: PatrocinadorState,
  formData: FormData
): Promise<PatrocinadorState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const parsed = patrocinadorSchema.safeParse({
    nombre: formData.get("nombre"),
    urlSitio: formData.get("urlSitio"),
    logoUrl: formData.get("logoUrl"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const logoUrl = parsed.data.logoUrl ?? null;
  if (logoUrl && !urlPublicaValida(logoUrl, "eventos", prefijoEvento(empresaId, eventoId))) {
    return { status: "error", message: "Esa imagen no pertenece a este evento." };
  }

  const supabase = await createClient();
  const valores = {
    nombre: parsed.data.nombre,
    url_sitio: parsed.data.urlSitio || null,
    logo_url: logoUrl,
  };

  if (patrocinadorId) {
    // El logo anterior se borra de Storage solo si de verdad cambió, para no
    // dejar archivos huérfanos ocupando el bucket con cada edición.
    const { data: previo } = await supabase
      .from("patrocinadores")
      .select("logo_url")
      .eq("id", patrocinadorId)
      .eq("evento_id", eventoId)
      .maybeSingle();
    if (!previo) return { status: "error", message: "Ese patrocinador no es de esta carrera." };

    const { error } = await supabase
      .from("patrocinadores")
      .update(valores)
      .eq("id", patrocinadorId)
      .eq("evento_id", eventoId);
    if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

    if (previo.logo_url && previo.logo_url !== logoUrl) {
      const anterior = rutaDesdeUrlPublica(previo.logo_url, "eventos");
      if (anterior) await supabase.storage.from("eventos").remove([anterior]);
    }
  } else {
    const { data: ultimos } = await supabase
      .from("patrocinadores")
      .select("orden")
      .eq("evento_id", eventoId)
      .order("orden", { ascending: false })
      .limit(1);

    const { error } = await supabase
      .from("patrocinadores")
      .insert({ evento_id: eventoId, ...valores, orden: (ultimos?.[0]?.orden ?? -1) + 1 });
    if (error) return { status: "error", message: "No se pudo crear: " + error.message };
  }

  await revalidar(eventoId);
  return { status: "guardado" };
}

export async function eliminarPatrocinador(eventoId: string, patrocinadorId: string) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  // Atado al evento de la URL: el id llega del cliente y `requireAdminDeEvento`
  // valida la carrera, no el patrocinador.
  const { data: previo } = await supabase
    .from("patrocinadores")
    .select("logo_url")
    .eq("id", patrocinadorId)
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (!previo) throw new Error("Ese patrocinador no es de esta carrera.");

  const { error } = await supabase
    .from("patrocinadores")
    .delete()
    .eq("id", patrocinadorId)
    .eq("evento_id", eventoId);
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  const ruta = previo?.logo_url && rutaDesdeUrlPublica(previo.logo_url, "eventos");
  if (ruta) await supabase.storage.from("eventos").remove([ruta]);

  await revalidar(eventoId);
}

export async function moverPatrocinador(eventoId: string, patrocinadorId: string, direccion: -1 | 1) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { data: lista } = await supabase
    .from("patrocinadores")
    .select("id, orden")
    .eq("evento_id", eventoId)
    .order("orden");
  if (!lista) return;

  const i = lista.findIndex((x) => x.id === patrocinadorId);
  const j = i + direccion;
  if (i === -1 || j < 0 || j >= lista.length) return;

  const reordenados = [...lista];
  [reordenados[i], reordenados[j]] = [reordenados[j], reordenados[i]];
  for (const [orden, p] of reordenados.entries()) {
    await supabase.from("patrocinadores").update({ orden }).eq("id", p.id);
  }

  await revalidar(eventoId);
}
