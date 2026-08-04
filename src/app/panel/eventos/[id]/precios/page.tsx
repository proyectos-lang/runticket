import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { isoAFechaLocal } from "@/lib/format";
import { GestorPrecios, type Tramo } from "./PreciosForm";

export const dynamic = "force-dynamic";

export default async function PreciosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, moneda, zona_horaria")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("evento_id", id)
    .order("nombre");

  const { data: tramos } = categorias?.length
    ? await supabase
        .from("precios_escalonados")
        .select("id, categoria_id, nombre, precio, fecha_inicio, fecha_fin")
        .in(
          "categoria_id",
          categorias.map((c) => c.id)
        )
        .order("fecha_inicio")
    : { data: [] as never[] };

  const zona = evento.zona_horaria;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Precios por fecha</h2>
        <p className="text-sm text-atenuado">
          Preventa, precio normal, última hora. El corredor paga el tramo vigente el día que se
          inscribe; fuera de esas fechas se cobra el precio base de la categoría.
        </p>
      </div>

      {categorias?.length ? (
        <GestorPrecios
          eventoId={id}
          moneda={evento.moneda}
          zona={zona}
          categorias={categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
          tramos={(tramos ?? []).map(
            (t): Tramo => ({
              ...t,
              fechaInicioLocal: isoAFechaLocal(t.fecha_inicio, zona),
              fechaFinLocal: isoAFechaLocal(t.fecha_fin, zona),
            })
          )}
        />
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
          Crea primero al menos una categoría: los tramos de precio se definen sobre ellas.
        </p>
      )}
    </div>
  );
}
