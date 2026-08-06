import Link from "next/link";
import { listarInscritos } from "@/lib/eventos/inscritos";
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
 * Los datos salen de `listarInscritos`, la misma función del informe: no hace
 * falta una consulta nueva ni un agregado que pudiera discrepar del padrón.
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

  const { filas, eventos, categorias } = await listarInscritos(null, {}, puedeVerDinero);

  const porCarrera = eventos.map((e) => {
    const suyas = filas.filter((f) => f.eventoId === e.id);
    const cupos = categorias.filter((c) => c.eventoId === e.id);
    // Una sola categoría de cupo abierto deja al total sin sentido.
    const cupo = cupos.length && cupos.every((c) => c.cupoMaximo !== null)
      ? cupos.reduce((a, c) => a + (c.cupoMaximo ?? 0), 0)
      : null;

    return {
      ...e,
      inscritos: suyas.length,
      cupo,
      recaudado: puedeVerDinero
        ? suyas
            .filter((f) => f.pago?.estado === "pagado")
            .reduce((a, f) => a + (f.pago?.monto ?? f.precio), 0)
        : 0,
      moneda: suyas[0]?.moneda ?? "HNL",
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
