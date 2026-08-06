import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { InformeInscritos } from "@/components/modulos/InformeInscritos";

export const dynamic = "force-dynamic";

/**
 * El padrón de la empresa.
 *
 * Antes esta pantalla era un trampolín: resolvía «la carrera más pertinente» y
 * redirigía a la suya, así que entrar por el menú metía al usuario en una
 * carrera que no había elegido y desde dentro ya no podía cambiarla sin volver
 * al listado. Ahora abre en **todas las carreras** y el selector acota.
 */
export default async function InscritosPanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filtros = await searchParams;
  const { eventos, eventoId } = await contextoModulo(filtros.evento, { permitirTodos: true });

  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][]
  );

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Inscritos"
        descripcion="El padrón completo: quién se apuntó, en qué categoría, con qué talla, si ya pagó y si retiró su kit."
      />

      {eventos.length === 0 ? (
        <EstadoVacio
          icono="inscritos"
          titulo="Todavía no tienes carreras"
          descripcion="Aquí verás a todos los corredores apuntados, con sus datos, su talla y su estado de pago, con filtros y exportación a Excel. Necesitas una carrera para empezar."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      ) : (
        <InformeInscritos
          eventoId={eventoId}
          params={params}
          basePath="/panel/inscritos"
          selector={
            <Suspense fallback={null}>
              <SelectorEvento eventos={eventos} seleccionado={eventoId} incluirTodos />
            </Suspense>
          }
        />
      )}
    </div>
  );
}
