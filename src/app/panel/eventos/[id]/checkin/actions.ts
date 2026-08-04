"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMiembroDeEvento } from "@/lib/auth/session";
import type { InscripcionCheckin } from "@/lib/supabase/database.types";

export type ResultadoBusqueda =
  | { estado: "encontrado"; inscripcion: InscripcionCheckin }
  /**
   * El código es válido pero pertenece a otra carrera de la misma empresa. Se
   * distingue del «no encontrado» porque la salida es distinta: el operador no
   * tiene que buscar nada, solo cambiar de carrera. Con varias carreras el
   * mismo fin de semana es el error más frecuente en la mesa.
   */
  | { estado: "otra_carrera"; eventoId: string; eventoNombre: string }
  | { estado: "no_encontrado"; mensaje: string };

/**
 * El QR del dorsal codifica la URL completa de check-in para que la cámara
 * normal del teléfono haga algo útil. Aquí se acepta tanto esa URL como el
 * token suelto (dorsales impresos con la versión anterior) y como el número de
 * dorsal tecleado a mano.
 */
function normalizarTermino(termino: string): string {
  const limpio = termino.trim();
  try {
    const url = new URL(limpio);
    return url.searchParams.get("codigo") ?? limpio;
  } catch {
    return limpio;
  }
}

/** Resuelve un QR escaneado (o un dorsal tecleado) a la inscripción del evento. */
export async function buscarParaCheckin(
  eventoId: string,
  terminoCrudo: string
): Promise<ResultadoBusqueda> {
  // Guarda por recurso: ata el evento a una membresía real en vez de conformarse
  // con la empresa que haya en la cookie. Acepta operador, que es justo quien
  // está en la mesa el día de la carrera.
  await requireMiembroDeEvento(eventoId);
  const supabase = await createClient();

  const termino = normalizarTermino(terminoCrudo);
  const soloDigitos = /^\d+$/.test(termino);
  const { data, error } = soloDigitos
    ? await supabase.rpc("buscar_inscripcion_por_dorsal", {
        p_evento_id: eventoId,
        p_dorsal: Number(termino),
      })
    : await supabase.rpc("buscar_inscripcion_por_qr", {
        p_evento_id: eventoId,
        p_codigo_qr: termino,
      });

  if (error) return { estado: "no_encontrado", mensaje: error.message };

  const inscripcion = (data as InscripcionCheckin[] | null)?.[0];
  if (inscripcion) return { estado: "encontrado", inscripcion };

  // Antes de decir «no existe», se comprueba si el código es de otra carrera de
  // la misma empresa. La RLS ya limita la búsqueda a lo que este equipo puede
  // ver, así que no filtra nada de otras empresas.
  if (!soloDigitos) {
    const { data: enOtra } = await supabase
      .from("inscripciones")
      .select("evento_id, eventos!inner(nombre)")
      .eq("codigo_qr", termino)
      .neq("evento_id", eventoId)
      .maybeSingle();
    if (enOtra) {
      return {
        estado: "otra_carrera",
        eventoId: enOtra.evento_id,
        eventoNombre: (enOtra as unknown as { eventos: { nombre: string } }).eventos.nombre,
      };
    }
  }

  return {
    estado: "no_encontrado",
    mensaje: soloDigitos
      ? `No hay ningún dorsal ${termino} en esta carrera.`
      : "Ese código no corresponde a ninguna inscripción que puedas ver.",
  };
}

export type EntregaState = { status: "idle" | "error" | "entregado"; message?: string };

/**
 * Registra el paso del corredor por el control. Son dos hechos distintos: la
 * asistencia dice que llegó a correr y la entrega dice que se llevó su prenda.
 * En muchas carreras el kit se recoge días antes, así que mezclarlos falsearía
 * el conteo de participantes reales.
 */
export async function registrarPaso(
  eventoId: string,
  inscripcionId: string,
  modo: "kit" | "asistencia"
): Promise<EntregaState> {
  await requireMiembroDeEvento(eventoId);
  const supabase = await createClient();

  const { error } = await supabase.rpc(
    modo === "kit" ? "marcar_kit_entregado" : "marcar_asistencia",
    { p_inscripcion_id: inscripcionId }
  );
  if (error) {
    return { status: "error", message: error.message.replace(/^.*?:\s*/, "") };
  }

  // El contador «X / Y · %» lo calcula el servidor en ModuloCheckin, así que sin
  // revalidar la barra de progreso se queda clavada toda la jornada aunque se
  // entreguen cientos de kits. Se revalidan las tres rutas donde se monta el
  // módulo, porque el operador puede estar en cualquiera de ellas.
  revalidatePath(`/panel/eventos/${eventoId}/checkin`);
  revalidatePath(modo === "kit" ? "/panel/checkin" : "/panel/asistencia");
  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);

  return { status: "entregado" };
}
