import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ModuloCheckin } from "@/components/modulos/ModuloCheckin";

export const dynamic = "force-dynamic";

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string; codigo?: string }>;
}) {
  const { evento: eventoParam, codigo } = await searchParams;
  const { eventos, eventoId } = await contextoModulo(eventoParam);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Entrega de kits"
        descripcion="Escanea el QR del dorsal del corredor para registrar que se llevó su camiseta. Avisa si el kit ya se entregó, así que no se puede entregar dos veces por error."
      >
        <Suspense fallback={null}>
          <SelectorEvento eventos={eventos} seleccionado={eventoId} />
        </Suspense>
      </CabeceraModulo>

      {eventoId ? (
        <ModuloCheckin eventoId={eventoId} codigoInicial={codigo} />
      ) : (
        <EstadoVacio
          icono="kits"
          titulo="Todavía no tienes carreras"
          descripcion="La entrega de kits se hace sobre una carrera concreta. Crea la primera, publica sus categorías y podrás escanear aquí los dorsales el día del evento."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      )}
    </div>
  );
}
