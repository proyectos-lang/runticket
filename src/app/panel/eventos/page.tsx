import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { FilaCarreraPanel } from "@/components/panel/FilaCarreraPanel";
import { CrearEventoForm } from "./CrearEventoForm";

export const dynamic = "force-dynamic";

export default async function PanelEventosPage() {
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: eventos } = await supabase
    .from("eventos")
    .select("id, nombre, slug, fecha_inicio, estado")
    .eq("empresa_id", membresia.empresaId)
    .order("fecha_inicio", { ascending: false });

  // Solo la carrera publicada más cercana lleva borde naranja: es la que está
  // viva de cara al público y la que se abre a diario.
  const idProxima =
    (eventos ?? [])
      .filter((e) => e.estado === "publicado" && new Date(e.fecha_inicio) >= new Date())
      .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="display text-2xl text-texto">Carreras</h1>
        <p className="max-w-150 text-sm leading-relaxed text-atenuado">
          Cada carrera tiene su propio centro de mando: inscritos, cobros, entrega de kits,
          resultados y métricas. Se crean en borrador y no se ven en la web hasta publicarlas.
        </p>
      </div>

      {membresia.rol === "admin_empresa" && <CrearEventoForm />}

      <div className="flex flex-col gap-3">
        {eventos?.length ? (
          eventos.map((evento) => (
            <FilaCarreraPanel key={evento.id} evento={evento} destacada={evento.id === idProxima} />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-linea-fuerte px-6 py-10 text-center text-sm text-atenuado">
            Todavía no hay carreras. Crea la primera con el formulario de arriba.
          </p>
        )}
      </div>
    </div>
  );
}
