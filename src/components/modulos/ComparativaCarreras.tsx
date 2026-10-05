import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatPrecio } from "@/lib/format";
import { EtiquetaMono } from "@/components/ui/Datos";
import { MedidorOcupacion } from "@/components/panel/Medidores";

/**
 * Las carreras de la empresa, una al lado de otra, cada una enlazando a su
 * módulo.
 *
 * Sustituye a la redirección automática que tenían Métricas y Resultados: en
 * vez de adivinar una carrera y meter al usuario dentro, se le enseñan todas
 * con la cifra que le permite decidir a cuál entrar. Es la respuesta a «ver los
 * datos de todas las carreras» en módulos que, uno a uno, solo tienen sentido
 * sobre una.
 *
 * Antes sacaba los datos de `listarInscritos`, el informe completo: hasta dos
 * mil inscripciones con sus perfiles, pagos y dos consultas por carrera, para
 * al final contar cuántas hay y sumar lo cobrado. Ahora pide solo esas tres
 * columnas en tres consultas en paralelo. Es la vista por defecto de Métricas,
 * Resultados y Lista de espera, así que era lo primero que se notaba lento.
 */
export async function ComparativaCarreras({
  segmento,
  vacio,
}: {
  /** A qué pantalla de la carrera lleva cada fila: `metricas`, `resultados`… */
  segmento: string;
  /** Qué decir de una carrera todavía sin inscritos. */
  vacio: string;
}) {
  const membresia = await getEmpresaActivaDelPanel();
  const puedeVerDinero = membresia.rol === "admin_empresa";
  const supabase = await createClient();

  const [{ data: eventos }, { data: inscripciones }, { data: pagos }] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, nombre, moneda")
      .eq("empresa_id", membresia.empresaId)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("inscripciones")
      .select("id, evento_id, grupo_inscripcion_id")
      .eq("empresa_id", membresia.empresaId)
      .eq("estado", "activa"),
    // Lo financiero no se le pide a la base para un operador: la RLS lo negaría
    // igual, pero así tampoco se gasta el viaje.
    puedeVerDinero
      ? supabase
          .from("pagos")
          .select("inscripcion_id, grupo_inscripcion_id, monto")
          .eq("empresa_id", membresia.empresaId)
          .eq("estado", "pagado")
      : Promise.resolve({ data: [] as { inscripcion_id: string | null; grupo_inscripcion_id: string | null; monto: number }[] }),
  ]);

  // Cupos por carrera, para el medidor de ocupación.
  const eventoIds = (eventos ?? []).map((e) => e.id);
  const { data: categorias } = eventoIds.length
    ? await supabase.from("categorias").select("evento_id, cupo_maximo").in("evento_id", eventoIds)
    : { data: [] as { evento_id: string; cupo_maximo: number | null }[] };

  // A qué carrera pertenece cada inscripción y cada grupo, para asignar los pagos.
  const eventoDeInscripcion = new Map<string, string>();
  const eventoDeGrupo = new Map<string, string>();
  for (const i of inscripciones ?? []) {
    eventoDeInscripcion.set(i.id, i.evento_id);
    if (i.grupo_inscripcion_id) eventoDeGrupo.set(i.grupo_inscripcion_id, i.evento_id);
  }
  const recaudadoPorEvento = new Map<string, number>();
  for (const p of pagos ?? []) {
    const eventoId =
      (p.inscripcion_id && eventoDeInscripcion.get(p.inscripcion_id)) ||
      (p.grupo_inscripcion_id && eventoDeGrupo.get(p.grupo_inscripcion_id));
    if (!eventoId) continue;
    recaudadoPorEvento.set(eventoId, (recaudadoPorEvento.get(eventoId) ?? 0) + Number(p.monto));
  }
  const inscritosPorEvento = new Map<string, number>();
  for (const i of inscripciones ?? []) {
    inscritosPorEvento.set(i.evento_id, (inscritosPorEvento.get(i.evento_id) ?? 0) + 1);
  }

  const porCarrera = (eventos ?? []).map((e) => {
    const cupos = (categorias ?? []).filter((c) => c.evento_id === e.id);
    // Una sola categoría de cupo abierto deja al total sin sentido.
    const cupo =
      cupos.length && cupos.every((c) => c.cupo_maximo !== null)
        ? cupos.reduce((a, c) => a + (c.cupo_maximo ?? 0), 0)
        : null;
    return {
      id: e.id,
      nombre: e.nombre,
      moneda: e.moneda,
      inscritos: inscritosPorEvento.get(e.id) ?? 0,
      cupo,
      recaudado: recaudadoPorEvento.get(e.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-3">
      <EtiquetaMono>Todas las carreras</EtiquetaMono>
      <div className="grid gap-3 sm:grid-cols-2">
        {porCarrera.map((c) => (
          <Link
            key={c.id}
            href={`/panel/eventos/${c.id}/${segmento}`}
            className="flex flex-col gap-3 rounded-xl border px-5 py-4 transition-colors border-linea bg-superficie hover:border-linea-fuerte hover:bg-superficie-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate font-semibold text-texto">{c.nombre}</p>
              {puedeVerDinero && c.recaudado > 0 && (
                <span className="tabular shrink-0 font-mono text-xs text-cian">
                  {formatPrecio(c.recaudado, c.moneda)}
                </span>
              )}
            </div>
            {c.inscritos > 0 ? (
              <MedidorOcupacion etiqueta="Inscritos" ocupado={c.inscritos} total={c.cupo} />
            ) : (
              <p className="text-sm text-atenuado">{vacio}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
