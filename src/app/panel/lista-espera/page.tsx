import { redirect } from "next/navigation";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";

export const dynamic = "force-dynamic";

export default async function ListaEsperaPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { membresia, eventoId } = await contextoModulo(eventoParam);
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  if (eventoId) redirect(`/panel/eventos/${eventoId}/lista-espera`);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Lista de espera"
        descripcion="Cuando una categoría se llena, los corredores pueden apuntarse a la cola. Al liberarse un cupo avisas al primero, que tiene 24 horas para completar su inscripción."
      />
      <EstadoVacio
        icono="listaEspera"
        titulo="Todavía no tienes carreras"
        descripcion="La lista de espera evita perder inscripciones cuando se agota el cupo: la gente deja su interés y tú avisas por orden de llegada según se liberen plazas."
        accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
      />
    </div>
  );
}
