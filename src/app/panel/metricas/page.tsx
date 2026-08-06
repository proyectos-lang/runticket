import { redirect } from "next/navigation";
import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ComparativaCarreras } from "@/components/modulos/ComparativaCarreras";
import { BotonEnlace } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

/**
 * Índice de métricas.
 *
 * Antes redirigía sin más a «la carrera más pertinente», que es como el usuario
 * acababa dentro de una que no había elegido. Ahora abre en todas, con la
 * comparativa entre carreras, y se entra a una cuando se quiere.
 *
 * Los agregados de toda la empresa —recaudado, corredores distintos, curva por
 * mes— **no se repiten aquí**: son el inicio del panel. Duplicarlos daría dos
 * pantallas que tarde o temprano dirían cifras distintas.
 */
export default async function MetricasPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { membresia, eventos, eventoId, evento } = await contextoModulo(eventoParam, {
    permitirTodos: true,
  });
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Métricas"
        descripcion="Indicadores de cada carrera: inscritos, conversión de pago, ocupación de cupos, demanda por talla y perfil demográfico de los participantes."
      >
        {eventos.length > 0 && (
          <Suspense fallback={null}>
            <SelectorEvento eventos={eventos} seleccionado={eventoId} incluirTodos />
          </Suspense>
        )}
      </CabeceraModulo>

      {eventos.length === 0 ? (
        <EstadoVacio
          icono="metricas"
          titulo="Todavía no tienes carreras"
          descripcion="En cuanto tengas una carrera con inscritos verás aquí su distribución por edad, género, ciudad y experiencia, la curva de inscripciones y cuánto has recaudado."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      ) : eventoId && evento ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border p-6 border-linea bg-superficie">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-texto">{evento.nombre}</h2>
            <p className="text-sm text-atenuado">
              El detalle completo —edad, género, ciudad, experiencia, curva de inscripciones y
              conciliación— vive en la pantalla de esta carrera.
            </p>
          </div>
          <BotonEnlace href={`/panel/eventos/${eventoId}/metricas`} variante="primaria">
            Ver métricas de esta carrera
          </BotonEnlace>
        </div>
      ) : (
        <ComparativaCarreras segmento="metricas" vacio="Todavía sin inscritos." />
      )}
    </div>
  );
}
