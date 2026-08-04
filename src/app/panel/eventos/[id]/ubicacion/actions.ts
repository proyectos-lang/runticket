"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { puntoEntregaSchema } from "@/lib/validacion/eventos";

export type PuntoEntregaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/**
 * Los puntos de retiro salen en la pantalla de kit del corredor y en la ficha
 * pública del evento, así que hay que invalidar las tres rutas.
 */
async function revalidar(eventoId: string) {
  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug")
    .eq("id", eventoId)
    .maybeSingle();
  revalidatePath(`/panel/eventos/${eventoId}/ubicacion`);
  revalidatePath("/portal/inscripciones", "layout");
  if (evento?.slug) revalidatePath(`/eventos/${evento.slug}`);
}

/** Crea o actualiza según venga `puntoId`: el formulario es el mismo. */
export async function guardarPuntoEntrega(
  eventoId: string,
  puntoId: string | null,
  _prevState: PuntoEntregaState,
  formData: FormData
): Promise<PuntoEntregaState> {
  await requireAdminDeEvento(eventoId);

  const parsed = puntoEntregaSchema.safeParse({
    nombre: formData.get("nombre"),
    direccion: formData.get("direccion"),
    horario: formData.get("horario"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // Una coordenada suelta no sitúa nada en el mapa y dejaría un marcador en el
  // meridiano cero: o van las dos o no va ninguna.
  if ((d.lat === undefined) !== (d.lng === undefined)) {
    return {
      status: "error",
      message: "Indica latitud y longitud juntas, o deja las dos vacías.",
    };
  }

  const supabase = await createClient();
  const valores = {
    nombre: d.nombre,
    direccion: d.direccion || null,
    horario: d.horario || null,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
  };

  if (puntoId) {
    // Se ata el id al evento: sin esto se podría editar el punto de otra carrera
    // de la misma empresa pasando su id a mano.
    const { error } = await supabase
      .from("evento_puntos_entrega")
      .update(valores)
      .eq("id", puntoId)
      .eq("evento_id", eventoId);
    if (error) return { status: "error", message: "No se pudo guardar: " + error.message };
  } else {
    const { data: ultimos } = await supabase
      .from("evento_puntos_entrega")
      .select("orden")
      .eq("evento_id", eventoId)
      .order("orden", { ascending: false })
      .limit(1);

    const { error } = await supabase
      .from("evento_puntos_entrega")
      .insert({ evento_id: eventoId, ...valores, orden: (ultimos?.[0]?.orden ?? -1) + 1 });
    if (error) return { status: "error", message: "No se pudo crear: " + error.message };
  }

  await revalidar(eventoId);
  return { status: "guardado" };
}

export async function eliminarPuntoEntrega(eventoId: string, puntoId: string): Promise<void> {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();
  await supabase
    .from("evento_puntos_entrega")
    .delete()
    .eq("id", puntoId)
    .eq("evento_id", eventoId);
  await revalidar(eventoId);
}
