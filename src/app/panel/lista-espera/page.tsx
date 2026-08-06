import { redirect } from "next/navigation";
import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ComparativaCarreras } from "@/components/modulos/ComparativaCarreras";
import { BotonEnlace } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

/**
 * Índice de la lista de espera. Como Métricas y Resultados, deja elegir carrera
 * en vez de meter al usuario en una que no pidió.
 */
export default async function ListaEsperaPanelPage({
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
        titulo="Lista de espera"
        descripcion="Cuando una categoría se llena, los corredores pueden apuntarse a la cola. Al liberarse un cupo avisas al primero, que tiene 24 horas para completar su inscripción."
      >
        {eventos.length > 0 && (
          <Suspense fallback={null}>
            <SelectorEvento eventos={eventos} seleccionado={eventoId} incluirTodos />
          </Suspense>
        )}
      </CabeceraModulo>

      {eventos.length === 0 ? (
        <EstadoVacio
          icono="listaEspera"
          titulo="Todavía no tienes carreras"
          descripcion="La lista de espera evita perder inscripciones cuando se agota el cupo: la gente deja su interés y tú avisas por orden de llegada según se liberen plazas."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      ) : eventoId && evento ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border p-6 border-linea bg-superficie">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-texto">{evento.nombre}</h2>
            <p className="text-sm text-atenuado">
              Consulta la cola de esta carrera y avisa al siguiente cuando se libere un cupo.
            </p>
          </div>
          <BotonEnlace href={`/panel/eventos/${eventoId}/lista-espera`} variante="primaria">
            Ver la cola de esta carrera
          </BotonEnlace>
        </div>
      ) : (
        <ComparativaCarreras segmento="lista-espera" vacio="Todavía sin inscritos." />
      )}
    </div>
  );
}
