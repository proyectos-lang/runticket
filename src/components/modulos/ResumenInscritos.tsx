import { formatPrecio } from "@/lib/format";
import { EtiquetaMono } from "@/components/ui/Datos";
import { TarjetaMetricaPanel, MedidorOcupacion } from "@/components/panel/Medidores";
import { BarrasHorizontales } from "@/components/metricas/Graficos";
import type { ResumenInscritos as Resumen, Reparto } from "@/lib/eventos/resumenInscritos";

/**
 * Reparto en tabla, sin gráfico.
 *
 * Para dos o tres valores una barra no aporta nada sobre la cifra, y con «Sin
 * dato» dentro el gráfico miente por omisión. La tabla siempre es legible.
 */
function TablaReparto({ titulo, datos }: { titulo: string; datos: Reparto[] }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  return (
    <div className="flex flex-col gap-2">
      <EtiquetaMono>{titulo}</EtiquetaMono>
      {datos.length ? (
        <ul className="flex flex-col gap-1.5">
          {datos.map((d) => (
            <li key={d.etiqueta} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-atenuado">{d.etiqueta}</span>
              <span className="tabular shrink-0 font-mono text-xs text-texto">
                {d.valor}
                <span className="ml-1.5 text-mudo">
                  {total ? Math.round((d.valor / total) * 100) : 0}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-atenuado">Sin datos.</p>
      )}
    </div>
  );
}

/**
 * La cabecera del informe: lo que un gerente mira antes que la tabla.
 *
 * Todas las cifras salen de las filas que hay debajo, así que **cambian con los
 * filtros**. Es la propiedad que lo hace útil: filtrar por una categoría y leer
 * arriba cuánto falta por cobrar de esa categoría.
 */
export function ResumenInscritos({
  resumen,
  mostrarDinero,
}: {
  resumen: Resumen;
  mostrarDinero: boolean;
}) {
  const { dinero, kits } = resumen;
  const porCobrar = dinero.enVerificacion + dinero.pendiente;

  return (
    <div className="flex flex-col gap-5">
      <div
        className={`grid gap-2.75 sm:grid-cols-2 ${mostrarDinero ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <TarjetaMetricaPanel
          label="Inscritos"
          valor={resumen.total.toLocaleString("es-HN")}
          nota={
            resumen.cupo
              ? `de ${resumen.cupo.toLocaleString("es-HN")} de cupo`
              : "cupo abierto"
          }
        />
        {mostrarDinero && (
          <>
            <TarjetaMetricaPanel
              label="Recaudado"
              valor={formatPrecio(dinero.recaudado, dinero.moneda)}
              nota="pagos confirmados"
            />
            <TarjetaMetricaPanel
              label="Por cobrar"
              valor={formatPrecio(porCobrar, dinero.moneda)}
              tono={porCobrar > 0 ? "aviso" : "neutro"}
              nota={
                dinero.enVerificacion > 0
                  ? `${formatPrecio(dinero.enVerificacion, dinero.moneda)} en verificación`
                  : "nada en verificación"
              }
            />
          </>
        )}
        <TarjetaMetricaPanel
          label="Kits entregados"
          valor={`${kits.entregados.toLocaleString("es-HN")}`}
          nota={
            kits.pendientes > 0
              ? `faltan ${kits.pendientes.toLocaleString("es-HN")} · ${kits.porcentaje}%`
              : "todos entregados"
          }
        />
      </div>

      {resumen.porCategoria.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-superficie p-5">
          <EtiquetaMono>Ocupación por categoría</EtiquetaMono>
          <div className="grid gap-3 sm:grid-cols-2">
            {resumen.porCategoria.map((c) => (
              <MedidorOcupacion
                key={c.nombre}
                etiqueta={c.nombre}
                ocupado={c.inscritos}
                total={c.cupo}
              />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 rounded-2xl border border-linea bg-superficie p-5 lg:grid-cols-3">
        <div className="flex flex-col gap-2 lg:col-span-1">
          <EtiquetaMono>Tallas</EtiquetaMono>
          {resumen.porTalla.length ? (
            <BarrasHorizontales datos={resumen.porTalla} unidad="corredores" />
          ) : (
            <p className="text-sm text-atenuado">Sin tallas registradas.</p>
          )}
        </div>
        <TablaReparto titulo="Género" datos={resumen.porSexo} />
        <TablaReparto titulo="Edad el día de la carrera" datos={resumen.porEdad} />
      </section>
    </div>
  );
}
