"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { pendientesDePublicacion } from "@/components/panel/EstadoEvento";
import type { ResumenEvento } from "@/lib/supabase/database.types";

export type ContextoCarrera = { nombre: string; pendientes: string[] };

/**
 * Nombre y pendientes de la carrera abierta, para el grupo «Esta carrera» del
 * menú lateral.
 *
 * Se pide desde el cliente porque `NavLateral` vive en `/panel/layout.tsx`, que
 * es padre de `/panel/eventos/[id]` y no puede conocer el evento: es la propia
 * barra quien detecta el id en la ruta. La alternativa —duplicar el menú dentro
 * del layout del evento— dejaría dos navegaciones que se desincronizan.
 *
 * Los pendientes salen de `pendientesDePublicacion`, la misma función que
 * bloquea el botón de publicar, para que el «!» del menú y el aviso del centro
 * de mando no puedan contradecirse.
 */
export async function contextoDeCarrera(eventoId: string): Promise<ContextoCarrera | null> {
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, estado")
    .eq("id", eventoId)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) return null;

  // Una carrera ya publicada no tiene nada «pendiente para publicar»: marcarla
  // con avisos ámbar sería ruido sobre algo que ya está resuelto.
  if (evento.estado !== "borrador") return { nombre: evento.nombre, pendientes: [] };

  const { data } = await supabase.rpc("resumen_evento", { p_evento_id: eventoId });
  const pendientes = pendientesDePublicacion((data ?? {}) as Partial<ResumenEvento>, "").map(
    (p) => p.clave
  );

  return { nombre: evento.nombre, pendientes };
}
