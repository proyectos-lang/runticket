import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { isoAFechaLocal } from "@/lib/format";
import { EditarEventoForm } from "./EditarEventoForm";
import { EliminarEventoForm } from "./EliminarEventoForm";

export const dynamic = "force-dynamic";

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const [{ count: inscripciones }, { data: departamentos }] = await Promise.all([
    supabase.from("inscripciones").select("*", { count: "exact", head: true }).eq("evento_id", id),
    // Catálogo completo, no solo los que ya tienen carreras: aquí se está dando
    // de alta la primera, así que filtrar por uso dejaría la lista vacía.
    supabase.from("departamentos").select("id, nombre").order("nombre"),
  ]);

  const zona = evento.zona_horaria;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-5 text-lg font-semibold text-texto">
          Datos del evento
        </h2>
        <EditarEventoForm
          eventoId={evento.id}
          hayInscripciones={(inscripciones ?? 0) > 0}
          departamentos={departamentos ?? []}
          evento={{
            nombre: evento.nombre,
            slug: evento.slug,
            descripcion: evento.descripcion,
            // El input datetime-local necesita la hora tal como se ve en la zona
            // del evento, no el instante UTC.
            fechaInicioLocal: isoAFechaLocal(evento.fecha_inicio, zona),
            fechaLimiteLocal: evento.fecha_limite_inscripcion
              ? isoAFechaLocal(evento.fecha_limite_inscripcion, zona)
              : "",
            direccion: evento.direccion,
            moneda: evento.moneda,
            zonaHoraria: zona,
            estado: evento.estado,
            disciplina: evento.disciplina,
            departamentoId: evento.departamento_id,
            kitContenido: evento.kit_contenido ?? [],
          }}
        />
      </section>

      <section className="rounded-2xl border p-6 border-red-950 bg-superficie">
        <p className="text-[0.8125rem] font-bold text-rojo">Zona peligrosa</p>
        <EliminarEventoForm
          eventoId={evento.id}
          nombre={evento.nombre}
          bloqueado={evento.estado !== "borrador" || (inscripciones ?? 0) > 0}
          motivo={
            (inscripciones ?? 0) > 0
              ? `Este evento tiene ${inscripciones} inscripciones: borrarlo destruiría sus declaraciones de salud firmadas y sus pagos. Si no se va a celebrar, cámbialo a cancelado.`
              : "Solo se puede eliminar un evento en borrador. Si ya se publicó, cámbialo a cancelado."
          }
        />
      </section>
    </div>
  );
}
