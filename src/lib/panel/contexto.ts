import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel, type MembresiaEmpresa } from "@/lib/auth/session";
import type { OpcionEvento } from "@/components/panel/SelectorEvento";

export type ContextoModulo = {
  membresia: MembresiaEmpresa;
  eventos: OpcionEvento[];
  /** Evento sobre el que trabaja el módulo, o null si no hay ninguno. */
  eventoId: string | null;
  evento: OpcionEvento | null;
};

/**
 * Resuelve el contexto común de los módulos de primer nivel: la empresa activa,
 * sus carreras y cuál está seleccionada.
 *
 * Si no llega `?evento=` se elige la más pertinente —la próxima que aún no se ha
 * celebrado, o la última celebrada— en vez de dejar la pantalla vacía obligando
 * a elegir a mano.
 */
export async function contextoModulo(
  eventoParam?: string,
  opciones: { permitirTodos?: boolean } = {}
): Promise<ContextoModulo> {
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data } = await supabase
    .from("eventos")
    .select("id, nombre, estado, fecha_inicio")
    .eq("empresa_id", membresia.empresaId)
    .order("fecha_inicio", { ascending: false });

  const eventos: OpcionEvento[] = (data ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    estado: e.estado,
  }));

  // "todas" es una elección legítima en los módulos que la ofrecen.
  if (opciones.permitirTodos && eventoParam === "") {
    return { membresia, eventos, eventoId: null, evento: null };
  }

  const valido = eventoParam && eventos.some((e) => e.id === eventoParam) ? eventoParam : null;

  let eventoId = valido;
  if (!eventoId && !opciones.permitirTodos && eventos.length > 0) {
    const ahora = Date.now();
    const futuros = (data ?? []).filter((e) => new Date(e.fecha_inicio).getTime() >= ahora);
    // `data` viene descendente: el último de los futuros es el más cercano.
    eventoId = futuros.length ? futuros[futuros.length - 1].id : eventos[0].id;
  }

  return {
    membresia,
    eventos,
    eventoId,
    evento: eventos.find((e) => e.id === eventoId) ?? null,
  };
}
