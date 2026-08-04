import { redirect } from "next/navigation";
import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";

export const dynamic = "force-dynamic";

export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoParam } = await searchParams;
  const { membresia, eventos, eventoId } = await contextoModulo(eventoParam);
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Fotos de la carrera"
        descripcion="Galería del evento con búsqueda por número de dorsal, para que cada corredor encuentre sus propias fotos."
      >
        <Suspense fallback={null}>
          <SelectorEvento eventos={eventos} seleccionado={eventoId} />
        </Suspense>
      </CabeceraModulo>

      <EstadoVacio
        icono="imagenes"
        titulo={eventoId ? "Aún no hay fotos cargadas" : "Todavía no tienes carreras"}
        descripcion={
          eventoId
            ? "La carga masiva de fotos y el buscador por dorsal llegan en la próxima entrega. Mientras tanto, la galería del evento (en Imágenes) ya permite subir fotos que se muestran en su página pública."
            : "Cuando tengas una carrera podrás subir aquí las fotos del día y etiquetarlas por dorsal para que cada corredor encuentre las suyas."
        }
        accion={
          eventoId
            ? { href: `/panel/eventos/${eventoId}/imagenes`, texto: "Ir a la galería del evento" }
            : { href: "/panel/eventos", texto: "Crear mi primera carrera" }
        }
      />
    </div>
  );
}
