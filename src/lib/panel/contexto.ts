import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaDelPanel,
  COOKIE_EVENTO,
  EVENTO_TODAS,
  type MembresiaEmpresa,
} from "@/lib/auth/session";
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
 * Tres fuentes, en este orden:
 *
 * 1. `?evento=` en la URL. Manda siempre, para que un enlace compartido lleve a
 *    lo que dice y no a lo último que mirara quien lo abre.
 * 2. La cookie `rt_evento`, que recuerda la última carrera elegida. Sin ella
 *    había que reelegir la carrera en cada módulo del menú.
 * 3. Con `permitirTodos`, «todas las carreras». Sin él —módulos que solo tienen
 *    sentido sobre una, como resultados o entrega de kits— se elige la más
 *    pertinente: la próxima que aún no se ha celebrado, o la última celebrada.
 *
 * El valor, venga de donde venga, **se valida siempre** contra las carreras
 * reales de la empresa activa: una cookie de otra empresa o de una carrera
 * borrada se descarta sola.
 */
export async function contextoModulo(
  eventoParam?: string,
  opciones: { permitirTodos?: boolean } = {}
): Promise<ContextoModulo> {
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  // `??` y no `||`: `?evento=` vacío es un «todas» explícito del usuario y no
  // debe caer en el recuerdo de la cookie.
  const recordado = (await cookies()).get(COOKIE_EVENTO)?.value;
  const elegido = eventoParam ?? (recordado === EVENTO_TODAS ? "" : recordado);

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
  if (opciones.permitirTodos && elegido === "") {
    return { membresia, eventos, eventoId: null, evento: null };
  }

  const valido = elegido && eventos.some((e) => e.id === elegido) ? elegido : null;

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
