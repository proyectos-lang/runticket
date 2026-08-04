"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { auditar } from "@/lib/seguridad";

export type InscritoState = { status: "idle" | "error" | "guardado"; message?: string };

/**
 * Cambia la talla de un inscrito. Va por la misma RPC que usa el corredor: mueve
 * el inventario de forma atómica y valida que el kit no se haya entregado.
 */
export async function cambiarTallaInscrito(
  eventoId: string,
  inscripcionId: string,
  talla: string | null
) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_talla_inscripcion", {
    p_inscripcion_id: inscripcionId,
    p_talla: talla,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));

  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);
}

/**
 * Mueve a un corredor de categoría. No basta con un UPDATE: hay que comprobar el
 * cupo de la categoría destino y la edad que tendrá el día del evento, igual que
 * hace la inscripción normal, o se colaría gente fuera de rango o por encima del
 * aforo.
 */
export async function cambiarCategoriaInscrito(
  eventoId: string,
  inscripcionId: string,
  categoriaId: string
) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  // Atada al evento de la URL: `requireAdminDeEvento` valida la carrera, no la
  // inscripción, así que sin este filtro se aceptaba el id de una inscripción de
  // otra carrera de la misma empresa. El trigger de la base acabaría rechazando
  // el cambio, pero con un error de integridad en vez de un mensaje entendible.
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, categoria_id, corredor_id, estado")
    .eq("id", inscripcionId)
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (!inscripcion) throw new Error("Esa inscripción no es de esta carrera.");
  if (inscripcion.estado !== "activa") throw new Error("Solo se puede mover una inscripción activa.");
  if (inscripcion.categoria_id === categoriaId) return;

  const [{ data: categoria }, { data: evento }, { data: perfil }] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, nombre, cupo_maximo, edad_minima, edad_maxima")
      .eq("id", categoriaId)
      .eq("evento_id", eventoId)
      .maybeSingle(),
    supabase.from("eventos").select("fecha_inicio").eq("id", eventoId).single(),
    supabase.from("perfiles").select("fecha_nacimiento").eq("id", inscripcion.corredor_id).single(),
  ]);
  if (!categoria) throw new Error("Esa categoría no pertenece a este evento.");

  if (categoria.cupo_maximo !== null) {
    const { count } = await supabase
      .from("inscripciones")
      .select("*", { count: "exact", head: true })
      .eq("categoria_id", categoriaId)
      .eq("estado", "activa");
    if ((count ?? 0) >= categoria.cupo_maximo) {
      throw new Error(`La categoría ${categoria.nombre} está llena (${count}/${categoria.cupo_maximo}).`);
    }
  }

  if (perfil?.fecha_nacimiento && evento) {
    const nac = new Date(perfil.fecha_nacimiento);
    const ref = new Date(evento.fecha_inicio);
    let edad = ref.getFullYear() - nac.getFullYear();
    const mes = ref.getMonth() - nac.getMonth();
    if (mes < 0 || (mes === 0 && ref.getDate() < nac.getDate())) edad--;

    if (categoria.edad_minima !== null && edad < categoria.edad_minima) {
      throw new Error(`Tendrá ${edad} años el día del evento y la categoría exige mínimo ${categoria.edad_minima}.`);
    }
    if (categoria.edad_maxima !== null && edad > categoria.edad_maxima) {
      throw new Error(`Tendrá ${edad} años el día del evento y la categoría admite hasta ${categoria.edad_maxima}.`);
    }
  }

  const { error } = await supabase
    .from("inscripciones")
    .update({ categoria_id: categoriaId })
    .eq("id", inscripcionId);
  if (error) throw new Error("No se pudo cambiar la categoría: " + error.message);

  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);
}

/**
 * Anula una inscripción. La RPC libera el cupo y devuelve la talla al inventario;
 * la inscripción se conserva con su historial en vez de borrarse, porque su
 * declaración de salud firmada es un documento que hay que poder recuperar.
 */
export async function anularInscripcion(eventoId: string, inscripcionId: string, motivo: string) {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_inscripcion", {
    p_inscripcion_id: inscripcionId,
    p_motivo: motivo || undefined,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));

  await auditar({
    accion: "inscripcion.anular",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    empresaId,
    datosNuevos: { motivo: motivo || null },
  });

  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);
  revalidatePath(`/panel/eventos/${eventoId}`);
}
