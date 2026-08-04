import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { formatFechaCorta } from "@/lib/format";
import { DeclaracionForm } from "./DeclaracionForm";

export const dynamic = "force-dynamic";

export default async function DeclaracionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, empresa_id")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const vigente = await obtenerDeclaracionVigente(evento.empresa_id, evento.id);

  const [{ data: historial }, { count: firmas }] = await Promise.all([
    supabase
      .from("declaraciones_salud")
      .select("id, version, evento_id, created_at")
      .eq("empresa_id", membresia.empresaId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("inscripcion_firmas")
      .select("*", { count: "exact", head: true })
      .eq("declaracion_id", vigente.id),
  ]);

  const esDelEvento = historial?.find((h) => h.id === vigente.id)?.evento_id !== null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">
          Declaración de salud
        </h2>
        <p className="max-w-2xl text-sm text-atenuado">
          El deslinde de responsabilidad que cada corredor firma al inscribirse. Se guarda con la
          versión que firmó, su firma manuscrita, la fecha y la IP, y queda como PDF descargable.
        </p>
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full px-3 py-1 font-medium bg-emerald-950 text-emerald-400">
            Versión {vigente.version} vigente
          </span>
          <span className="text-atenuado">
            {esDelEvento ? "Solo para esta carrera" : "Predeterminada de la empresa"}
          </span>
        </div>
        <DeclaracionForm
          eventoId={id}
          contenidoActual={vigente.contenido}
          ambitoActual={esDelEvento ? "evento" : "empresa"}
          firmasExistentes={firmas ?? 0}
        />
      </section>

      {historial && historial.length > 1 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-texto">Versiones</h3>
          <ul className="flex flex-col gap-1 text-sm text-atenuado">
            {historial.map((h) => (
              <li key={h.id} className="flex justify-between rounded-lg px-3 py-2 odd:bg-superficie">
                <span>
                  Versión {h.version} · {h.evento_id ? "de esta carrera" : "de la empresa"}
                  {h.id === vigente.id && " · vigente"}
                </span>
                <span>{formatFechaCorta(h.created_at)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-atenuado">
            Las versiones antiguas no se borran: son la prueba de qué aceptó cada corredor.
          </p>
        </section>
      )}
    </div>
  );
}
