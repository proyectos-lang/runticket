import { redirect } from "next/navigation";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";

export const dynamic = "force-dynamic";

export default async function ResultadosPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { eventoId } = await contextoModulo(eventoParam);

  if (eventoId) redirect(`/panel/eventos/${eventoId}/resultados`);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Resultados"
        descripcion="Carga los tiempos del cronometraje desde un CSV; las posiciones generales y por categoría se calculan solas y se publican en la web con buscador y podio."
      />
      <EstadoVacio
        icono="resultados"
        titulo="Todavía no tienes carreras"
        descripcion="Cuando una carrera termine podrás subir aquí el archivo del cronometraje y publicar la clasificación para que los corredores se busquen por nombre o dorsal."
        accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
      />
    </div>
  );
}
