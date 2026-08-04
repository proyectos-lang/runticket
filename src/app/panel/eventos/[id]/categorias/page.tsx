import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { CategoriaForm } from "./CategoriaForm";
import { ListaCategorias } from "./ListaCategorias";

export const dynamic = "force-dynamic";

export default async function CategoriasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, moneda")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const { data: categorias } = await supabase
    .from("categorias")
    .select(
      "id, nombre, distancia_km, desnivel_m, precio_base, cupo_maximo, edad_minima, edad_maxima, hora_salida"
    )
    .eq("evento_id", id)
    .order("distancia_km", { nullsFirst: false })
    .order("nombre");

  // Inscritos por categoría: hace falta para bloquear el borrado y para avisar
  // si se intenta bajar el cupo por debajo de lo ya vendido.
  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("categoria_id")
    .eq("evento_id", id)
    .eq("estado", "activa");

  const conteo = new Map<string, number>();
  for (const i of inscripciones ?? []) {
    conteo.set(i.categoria_id, (conteo.get(i.categoria_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Categorías</h2>
        <p className="text-sm text-atenuado">
          Cada categoría tiene su precio, su cupo y su rango de edad. La edad se valida contra la
          que tendrá el corredor el día del evento.
        </p>
      </div>

      <ListaCategorias
        eventoId={id}
        moneda={evento.moneda}
        categorias={(categorias ?? []).map((c) => ({ ...c, inscritos: conteo.get(c.id) ?? 0 }))}
      />

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-4 text-base font-semibold text-texto">
          Añadir categoría
        </h3>
        <CategoriaForm eventoId={id} />
      </section>
    </div>
  );
}
