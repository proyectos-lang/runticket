import { createClient } from "@/lib/supabase/server";
import { EstadoVacio } from "@/components/panel/EstadoVacio";
import { TarjetaMetricaPanel, nivelDeOcupacion } from "@/components/panel/Medidores";
import { Aviso } from "@/components/ui/Aviso";
import { TablaInventario, type FilaTalla } from "@/app/panel/eventos/[id]/tallas/TablaInventario";
import { TallaForm } from "@/app/panel/eventos/[id]/tallas/TallaForm";

/**
 * Cuerpo del inventario de prendas. Lo comparten `/panel/inventario` (módulo de
 * primer nivel con selector de carrera) y `/panel/eventos/[id]/tallas`, para que
 * no haya dos implementaciones que se desincronicen.
 */
export async function ModuloInventario({ eventoId }: { eventoId: string }) {
  const supabase = await createClient();

  const [{ data: inventario }, { data: tallas }] = await Promise.all([
    supabase.rpc("inventario_tallas", { p_evento_id: eventoId }),
    supabase.from("evento_tallas").select("id, talla").eq("evento_id", eventoId).order("talla"),
  ]);

  const filas: FilaTalla[] = (tallas ?? []).map((t) => {
    const inv = inventario?.find((i) => i.talla === t.talla);
    return {
      id: t.id,
      talla: t.talla,
      inventario_total: inv?.inventario_total ?? null,
      inventario_disponible: inv?.inventario_disponible ?? null,
      comprometidas: inv?.comprometidas ?? 0,
    };
  });

  const comprometidas = filas.reduce((a, f) => a + f.comprometidas, 0);
  const producidas = filas.reduce((a, f) => a + (f.inventario_total ?? 0), 0);
  const disponibles = filas.reduce((a, f) => a + (f.inventario_disponible ?? 0), 0);

  // «En riesgo» agrupa las que se agotan (≥90 %) y las agotadas (100 %): es la
  // cifra que decide si hay que llamar al proveedor, y separarlas obligaría a
  // sumar dos tarjetas mentalmente.
  const enRiesgo = filas.filter((f) => {
    if (f.inventario_total === null || f.inventario_total <= 0) return false;
    return nivelDeOcupacion(Math.round((f.comprometidas / f.inventario_total) * 100)) !== "normal";
  });
  const agotadas = filas.filter(
    (f) => f.inventario_total !== null && (f.inventario_disponible ?? 0) <= 0
  );

  return (
    <div className="flex flex-col gap-6">
      {filas.length > 0 && (
        <div className="grid gap-2.75 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaMetricaPanel label="Producidas" valor={producidas.toLocaleString("es-HN")} />
          <TarjetaMetricaPanel
            label="Comprometidas"
            valor={comprometidas.toLocaleString("es-HN")}
            tono="info"
          />
          <TarjetaMetricaPanel label="Disponibles" valor={disponibles.toLocaleString("es-HN")} />
          <TarjetaMetricaPanel
            label="Tallas en riesgo"
            valor={enRiesgo.length}
            tono={agotadas.length ? "error" : enRiesgo.length ? "aviso" : "neutro"}
            nota={
              agotadas.length
                ? `${agotadas.length} agotada${agotadas.length === 1 ? "" : "s"}`
                : enRiesgo.length
                  ? "por encima del 90 %"
                  : "todo con holgura"
            }
          />
        </div>
      )}

      {agotadas.length > 0 && (
        <Aviso tono="ambar" titulo="Hay tallas agotadas">
          {agotadas.map((f) => f.talla).join(", ")}
          {agotadas.length === 1 ? " está agotada" : " están agotadas"}: los corredores ya no
          {agotadas.length === 1 ? " la" : " las"} pueden elegir al inscribirse. Si vas a producir
          más, sube el inventario aquí y volverá a ofrecerse.
        </Aviso>
      )}

      {filas.length ? (
        <TablaInventario eventoId={eventoId} filas={filas} />
      ) : (
        <EstadoVacio
          icono="tallas"
          titulo="Sin tallas configuradas"
          descripcion="Si la carrera entrega camiseta o cualquier otra prenda, añade aquí las tallas y cuántas unidades tienes de cada una. El formulario de inscripción dejará de ofrecer las que se agoten."
        />
      )}

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-4 text-base font-semibold text-texto">Añadir talla</h3>
        <TallaForm eventoId={eventoId} />
      </section>
    </div>
  );
}

