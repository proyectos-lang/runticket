import { redirect } from "next/navigation";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";

export const dynamic = "force-dynamic";

/**
 * Puerta de entrada al padrón desde el menú. Con una carrera seleccionada lleva
 * directo a su tabla —el módulo se ve de un clic, que es lo que se pedía— y sin
 * carreras explica para qué sirve en vez de dejar la pantalla en blanco.
 */
export default async function InscritosPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { eventoId } = await contextoModulo(eventoParam);

  if (eventoId) redirect(`/panel/eventos/${eventoId}/inscritos`);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Inscritos"
        descripcion="El padrón de cada carrera: quién se apuntó, en qué categoría, con qué talla y si ya pagó."
      />
      <EstadoVacio
        icono="inscritos"
        titulo="Todavía no tienes carreras"
        descripcion="Aquí verás a todos los corredores apuntados, con sus datos, su talla y su estado de pago, con filtros y exportación a Excel. Necesitas una carrera para empezar."
        accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
      />
    </div>
  );
}
