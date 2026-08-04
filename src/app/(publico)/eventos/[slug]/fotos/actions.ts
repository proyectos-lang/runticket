"use server";

import { createClient } from "@/lib/supabase/server";
import { dentroDelLimite, MENSAJE_LIMITE } from "@/lib/seguridad";

export type Foto = { id: string; url: string };

export type BusquedaFotos =
  | { status: "ok"; fotos: Foto[] }
  | { status: "error"; message: string };

/**
 * Devuelve las fotos de un dorsal concreto.
 *
 * Va por RPC y no por consulta directa a propósito: la tabla guarda el array de
 * dorsales de cada foto, así que un `select` abierto permitiría descargar el
 * mapa completo dorsal→fotos y, cruzándolo con los resultados publicados,
 * montar un índice «nombre → fotos» de todos los participantes, menores
 * incluidos. Con límite de intentos para que tampoco se pueda recorrer dorsal a
 * dorsal.
 */
export async function buscarFotos(slug: string, dorsal: string): Promise<BusquedaFotos> {
  const numero = Number(dorsal);
  if (!Number.isInteger(numero) || numero <= 0) {
    return { status: "error", message: "Introduce un número de dorsal válido." };
  }

  if (!(await dentroDelLimite("cupon"))) {
    return { status: "error", message: MENSAJE_LIMITE };
  }

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return { status: "error", message: "Este evento ya no está disponible." };

  const { data, error } = await supabase.rpc("fotos_por_dorsal", {
    p_evento_id: evento.id,
    p_dorsal: numero,
  });
  if (error) return { status: "error", message: "No se pudo buscar. Inténtalo de nuevo." };

  return { status: "ok", fotos: (data as Foto[] | null) ?? [] };
}
