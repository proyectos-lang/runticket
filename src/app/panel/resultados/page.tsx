import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ComparativaCarreras } from "@/components/modulos/ComparativaCarreras";
import { BotonEnlace } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

/**
 * Índice de resultados.
 *
 * No ofrece una vista agregada porque un resultado es de una carrera: no existe
 * una clasificación de «todas». Lo que sí hace es dejar elegir en vez de
 * adivinar, que era el problema de la redirección automática.
 */
export default async function ResultadosPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { eventos, eventoId, evento } = await contextoModulo(eventoParam, { permitirTodos: true });

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Resultados"
        descripcion="Carga los tiempos del cronometraje desde un CSV; las posiciones generales y por categoría se calculan solas y se publican en la web con buscador y podio."
      >
        {eventos.length > 0 && (
          <Suspense fallback={null}>
            <SelectorEvento eventos={eventos} seleccionado={eventoId} incluirTodos />
          </Suspense>
        )}
      </CabeceraModulo>

      {eventos.length === 0 ? (
        <EstadoVacio
          icono="resultados"
          titulo="Todavía no tienes carreras"
          descripcion="Cuando una carrera termine podrás subir aquí el archivo del cronometraje y publicar la clasificación para que los corredores se busquen por nombre o dorsal."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      ) : eventoId && evento ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border p-6 border-linea bg-superficie">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-texto">{evento.nombre}</h2>
            <p className="text-sm text-atenuado">
              Sube el archivo del cronometraje y publica la clasificación de esta carrera.
            </p>
          </div>
          <BotonEnlace href={`/panel/eventos/${eventoId}/resultados`} variante="primaria">
            Ver resultados de esta carrera
          </BotonEnlace>
        </div>
      ) : (
        <ComparativaCarreras segmento="resultados" vacio="Todavía sin inscritos." />
      )}
    </div>
  );
}
