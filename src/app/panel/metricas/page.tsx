import { redirect } from "next/navigation";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";

export const dynamic = "force-dynamic";

export default async function MetricasPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { membresia, eventoId } = await contextoModulo(eventoParam);
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  if (eventoId) redirect(`/panel/eventos/${eventoId}/metricas`);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Métricas"
        descripcion="Indicadores de cada carrera: inscritos, conversión de pago, ocupación de cupos, demanda por talla y perfil demográfico de los participantes."
      />
      <EstadoVacio
        icono="metricas"
        titulo="Todavía no tienes carreras"
        descripcion="En cuanto tengas una carrera con inscritos verás aquí su distribución por edad, género, ciudad y experiencia, la curva de inscripciones y cuánto has recaudado."
        accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
      />
    </div>
  );
}
