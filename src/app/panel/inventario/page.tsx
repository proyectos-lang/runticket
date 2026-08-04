import { redirect } from "next/navigation";
import { Suspense } from "react";
import { contextoModulo } from "@/lib/panel/contexto";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { SelectorEvento } from "@/components/panel/SelectorEvento";
import { ModuloInventario } from "@/components/modulos/ModuloInventario";

export const dynamic = "force-dynamic";

export default async function InventarioPage({
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
        titulo="Inventario de prendas"
        descripcion="Cuántas camisetas comprometiste por talla y cuántas te quedan. Sirve para saber qué comprar antes de la carrera y para que el formulario deje de ofrecer lo agotado."
      >
        <Suspense fallback={null}>
          <SelectorEvento eventos={eventos} seleccionado={eventoId} />
        </Suspense>
      </CabeceraModulo>

      {eventoId ? (
        <ModuloInventario eventoId={eventoId} />
      ) : (
        <EstadoVacio
          icono="tallas"
          titulo="Todavía no tienes carreras"
          descripcion="El inventario de prendas se lleva por carrera. Crea la primera y podrás cargar aquí las tallas y sus existencias."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      )}
    </div>
  );
}
