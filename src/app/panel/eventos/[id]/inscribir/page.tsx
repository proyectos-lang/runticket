import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { categoriasConCupo } from "@/lib/eventos/consultas";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { InscribirForm } from "./InscribirForm";

export const dynamic = "force-dynamic";

export default async function InscribirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, moneda, estado, empresa_id")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const [categorias, { data: tallas }, declaracion] = await Promise.all([
    categoriasConCupo(evento.id),
    supabase
      .from("evento_tallas")
      .select("talla, inventario_disponible")
      .eq("evento_id", id)
      .order("talla"),
    obtenerDeclaracionVigente(evento.empresa_id, evento.id),
  ]);

  const conCupo = categorias.filter((c) => c.cupos_disponibles === null || c.cupos_disponibles > 0);
  const conStock = (tallas ?? [])
    .filter((t) => t.inventario_disponible === null || t.inventario_disponible > 0)
    .map((t) => t.talla);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">
          Inscribir en el punto de venta
        </h2>
        <p className="text-sm text-atenuado">
          Para quien llega a la mesa el día del evento. Se aplican las mismas reglas que en el
          portal: cupo, edad de la categoría, inventario de talla y firma de la declaración.
        </p>
      </div>

      {conCupo.length ? (
        <InscribirForm
          eventoId={evento.id}
          moneda={evento.moneda}
          categorias={conCupo.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            precio: Number(c.precio_vigente),
            cuposLibres: c.cupos_disponibles,
          }))}
          tallas={conStock}
          declaracion={declaracion}
        />
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          No queda cupo en ninguna categoría.
        </p>
      )}
    </div>
  );
}
