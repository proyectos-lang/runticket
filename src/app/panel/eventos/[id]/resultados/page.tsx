import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatTiempo } from "@/lib/format";
import { CargarResultadosForm } from "./CargarResultadosForm";
import { publicarResultados, recalcularPosiciones } from "./actions";
import { Boton } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

export default async function ResultadosPanelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("id, numero_dorsal, corredor_id, categoria_id")
    .eq("evento_id", id)
    .eq("estado", "activa");

  const ids = (inscripciones ?? []).map((i) => i.id);
  const [{ data: resultados }, { data: perfiles }, { data: categorias }] = await Promise.all([
    ids.length
      ? supabase
          .from("resultados")
          .select("inscripcion_id, tiempo_oficial, posicion_general, posicion_categoria, publicado")
          .in("inscripcion_id", ids)
      : Promise.resolve({ data: [] as never[] }),
    inscripciones?.length
      ? supabase
          .from("perfiles")
          .select("id, nombres, apellidos")
          .in("id", [...new Set(inscripciones.map((i) => i.corredor_id))])
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("categorias").select("id, nombre").eq("evento_id", id),
  ]);

  const filas = (resultados ?? [])
    .map((r) => {
      const insc = inscripciones?.find((i) => i.id === r.inscripcion_id);
      const perfil = perfiles?.find((p) => p.id === insc?.corredor_id);
      return {
        ...r,
        dorsal: insc?.numero_dorsal ?? null,
        nombre: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim(),
        categoria: categorias?.find((c) => c.id === insc?.categoria_id)?.nombre ?? "",
      };
    })
    .sort((a, b) => (a.posicion_general ?? 9999) - (b.posicion_general ?? 9999));

  const publicados = filas.filter((f) => f.publicado).length;
  const esAdmin = membresia.rol === "admin_empresa";

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* La vuelta la pone la cabecera del evento. */}
        <h1 className="text-2xl font-semibold text-texto">Resultados</h1>
        <p className="text-sm text-atenuado">
          {filas.length} registrados · {publicados} publicados
        </p>
      </div>

      {esAdmin && (
        <>
          <CargarResultadosForm eventoId={evento.id} />

          {filas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <form action={publicarResultados.bind(null, evento.id, true)}>
                <Boton variante="primaria">
                  Publicar resultados
                </Boton>
              </form>
              <form action={publicarResultados.bind(null, evento.id, false)}>
                <button className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2">
                  Despublicar
                </button>
              </form>
              <form action={recalcularPosiciones.bind(null, evento.id)}>
                <button className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2">
                  Recalcular posiciones
                </button>
              </form>
              <Link
                href={`/eventos/${evento.slug}/resultados`}
                className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
              >
                Ver página pública
              </Link>
            </div>
          )}
        </>
      )}

      {filas.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
              <tr>
                <th className="px-4 py-3">Pos.</th>
                <th className="px-4 py-3">Dorsal</th>
                <th className="px-4 py-3">Corredor</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Pos. cat.</th>
                <th className="px-4 py-3">Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={f.inscripcion_id} className="bg-superficie/40">
                  <td className="px-4 py-3 font-semibold tabular-nums text-texto">
                    {f.posicion_general ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-atenuado">{f.dorsal ?? "—"}</td>
                  <td className="px-4 py-3 text-texto">{f.nombre}</td>
                  <td className="px-4 py-3 text-atenuado">{f.categoria}</td>
                  <td className="px-4 py-3 tabular-nums text-atenuado">
                    {f.posicion_categoria ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-texto">
                    {formatTiempo(f.tiempo_oficial)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          Todavía no hay resultados cargados.
        </p>
      )}
    </div>
  );
}
