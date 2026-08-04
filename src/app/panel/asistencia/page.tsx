import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ModuloCheckin } from "@/components/modulos/ModuloCheckin";

export const dynamic = "force-dynamic";

export default async function AsistenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string; codigo?: string }>;
}) {
  const { evento: eventoParam, codigo } = await searchParams;
  const { eventos, eventoId } = await contextoModulo(eventoParam);

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Control de asistencia"
        descripcion="Registra quién llegó de verdad a correr. Es distinto de la entrega del kit: en muchas carreras el kit se recoge días antes, y hay quien lo recoge pero no se presenta."
      >
        <Suspense fallback={null}>
          <SelectorEvento eventos={eventos} seleccionado={eventoId} />
        </Suspense>
      </CabeceraModulo>

      {eventoId ? (
        <ModuloCheckin eventoId={eventoId} codigoInicial={codigo} modo="asistencia" />
      ) : (
        <EstadoVacio
          icono="asistencia"
          titulo="Todavía no tienes carreras"
          descripcion="El día del evento podrás escanear aquí el dorsal de cada corredor al entrar y saber en todo momento cuánta gente se presentó frente a cuánta se inscribió."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      )}
    </div>
  );
}
