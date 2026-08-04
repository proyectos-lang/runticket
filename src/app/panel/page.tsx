import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatPrecio, formatFechaCorta, formatFechaLarga, diasHasta } from "@/lib/format";
import { MedidorOcupacion, TarjetaMetricaPanel } from "@/components/panel/Medidores";
import { ChipEstadoEvento } from "@/components/panel/EstadoEvento";
import { BotonEnlace } from "@/components/ui/Boton";
import { AreaTemporal, BarrasHorizontales } from "@/components/metricas/Graficos";
import { EstadoVacio } from "@/components/panel/EstadoVacio";
import type { MetricasEmpresa, EstadoEvento } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function PanelInicioPage() {
  const membresia = await getEmpresaActivaDelPanel();
  const esAdmin = membresia.rol === "admin_empresa";
  const supabase = await createClient();

  // Un solo viaje al servidor en vez de una consulta por indicador.
  const { data } = await supabase.rpc("metricas_empresa", { p_empresa_id: membresia.empresaId });
  const m = (data ?? {}) as Partial<MetricasEmpresa>;

  const porEstado = m.eventos_por_estado ?? {};
  const totalEventos = Object.values(porEstado).reduce((a, b) => a + b, 0);

  const porMes = Object.entries(m.inscripciones_por_mes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ etiqueta: formatFechaCorta(`${mes}-01`), valor }));

  const topEventos = (m.top_eventos ?? [])
    .filter((e) => e.inscritos > 0)
    .map((e) => ({ etiqueta: e.evento, valor: e.inscritos }));

  const proximo = m.proximo_evento;

  if (totalEventos === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-texto">
            Hola, {membresia.nombreComercial}
          </h1>
          <p className="text-sm text-atenuado">
            Aquí verás el pulso de todas tus carreras.
          </p>
        </div>
        <EstadoVacio
          icono="eventos"
          titulo="Empieza creando tu primera carrera"
          descripcion="Desde el menú de la izquierda gestionas todo: inscritos, inventario de camisetas, entrega de kits, control de asistencia, resultados y métricas. Los módulos ya están listos; solo necesitan una carrera sobre la que trabajar."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-texto">
          Hola, {membresia.nombreComercial}
        </h1>
        <p className="text-sm text-atenuado">
          {totalEventos} {totalEventos === 1 ? "carrera" : "carreras"} · {m.inscritos_totales ?? 0}{" "}
          inscripciones · {m.corredores_distintos ?? 0} corredores distintos
        </p>
      </div>

      {/* El operador no ve las dos tarjetas de dinero: la condición está aquí
          y también en las políticas de la base de datos, que es lo que de
          verdad lo impide. */}
      <div className={`grid gap-2.75 sm:grid-cols-2 ${esAdmin ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}>
        <TarjetaMetricaPanel
          label="Publicadas"
          valor={porEstado.publicado ?? 0}
          nota={`de ${totalEventos} ${totalEventos === 1 ? "carrera" : "carreras"}`}
        />
        <TarjetaMetricaPanel
          label="Inscripciones"
          valor={(m.inscritos_totales ?? 0).toLocaleString("es-HN")}
        />
        {esAdmin && (
          <>
            <TarjetaMetricaPanel
              label="Recaudado"
              valor={formatPrecio(Number(m.recaudado ?? 0), "HNL")}
              nota="confirmado"
            />
            <TarjetaMetricaPanel
              label="Por verificar"
              valor={m.pagos_por_verificar ?? 0}
              tono={(m.pagos_por_verificar ?? 0) > 0 ? "aviso" : "neutro"}
              nota={
                (m.pagos_por_verificar ?? 0) > 0
                  ? `${formatPrecio(Number(m.pendiente_cobro ?? 0), "HNL")} en cola`
                  : "todo al día"
              }
            />
          </>
        )}
        <TarjetaMetricaPanel
          label="Corredores"
          valor={(m.corredores_distintos ?? 0).toLocaleString("es-HN")}
          nota="únicos"
        />
      </div>

      {proximo && (
        <section className="flex flex-col gap-4 rounded-xl border border-naranja/28 bg-superficie p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[0.59375rem] font-semibold uppercase tracking-etiqueta text-mudo">
                Próxima carrera · en {Math.max(0, diasHasta(proximo.fecha_inicio))} días
              </p>
              <h2 className="text-[1.375rem] font-extrabold tracking-display text-texto">
                {proximo.nombre}
              </h2>
              <p className="font-mono text-[0.71875rem] text-atenuado">
                {formatFechaLarga(proximo.fecha_inicio)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ChipEstadoEvento estado={proximo.estado as EstadoEvento} />
            </div>
          </div>
          <MedidorOcupacion
            etiqueta="Ocupación"
            ocupado={proximo.inscritos}
            total={proximo.cupo_total}
            grosor={8}
          />

          <div className="flex flex-wrap gap-2.5">
            <BotonEnlace href={`/panel/eventos/${proximo.id}`} variante="primaria">
              Gestionar carrera
            </BotonEnlace>
            <BotonEnlace href={`/eventos/${proximo.slug}`} variante="secundaria">
              Ver página pública
            </BotonEnlace>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-6 border-linea bg-superficie">
          <h2 className="mb-4 text-lg font-semibold text-texto">
            Inscripciones por mes
          </h2>
          {porMes.length ? (
            <AreaTemporal datos={porMes} />
          ) : (
            <p className="py-10 text-center text-sm text-atenuado">
              Todavía no hay inscripciones.
            </p>
          )}
        </section>

        <section className="rounded-2xl border p-6 border-linea bg-superficie">
          <h2 className="mb-4 text-lg font-semibold text-texto">
            Carreras con más inscritos
          </h2>
          {topEventos.length ? (
            <BarrasHorizontales datos={topEventos} unidad="inscritos" />
          ) : (
            <p className="py-10 text-center text-sm text-atenuado">
              Sin datos aún.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
