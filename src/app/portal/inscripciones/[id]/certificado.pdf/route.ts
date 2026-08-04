import { createClient } from "@/lib/supabase/server";
import { generarPdfCertificado } from "@/lib/pdf/certificado";
import { formatFechaLarga, formatTiempo } from "@/lib/format";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // La RLS limita esto al dueño de la inscripción y al staff del evento.
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, evento_id, categoria_id, corredor_id, empresa_id, estado")
    .eq("id", id)
    .maybeSingle();
  if (!inscripcion) return new Response("Inscripción no encontrada", { status: 404 });

  const { data: evento } = await supabase
    .from("eventos")
    .select("nombre, fecha_inicio, zona_horaria, estado")
    .eq("id", inscripcion.evento_id)
    .single();

  // El certificado acredita haber participado: no se emite antes de que el
  // evento se dé por finalizado.
  if (evento?.estado !== "finalizado") {
    return new Response("El certificado estará disponible cuando el organizador cierre el evento.", {
      status: 409,
    });
  }
  if (inscripcion.estado !== "activa") {
    return new Response("Esta inscripción no está activa.", { status: 409 });
  }

  const [{ data: categoria }, { data: perfil }, { data: empresa }, { data: resultado }, { data: patrocinadores }] =
    await Promise.all([
      supabase.from("categorias").select("nombre").eq("id", inscripcion.categoria_id).single(),
      supabase.from("perfiles").select("nombres, apellidos").eq("id", inscripcion.corredor_id).single(),
      supabase.from("empresas").select("nombre_comercial").eq("id", inscripcion.empresa_id).single(),
      supabase
        .from("resultados")
        .select("tiempo_oficial, posicion_general, posicion_categoria")
        .eq("inscripcion_id", id)
        .maybeSingle(),
      supabase.from("patrocinadores").select("nombre").eq("evento_id", inscripcion.evento_id).order("orden"),
    ]);

  const pdf = await generarPdfCertificado({
    corredor: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim(),
    evento: evento.nombre,
    categoria: categoria?.nombre ?? "",
    fechaEvento: formatFechaLarga(evento.fecha_inicio, evento.zona_horaria),
    empresa: empresa?.nombre_comercial ?? "",
    tiempo: resultado?.tiempo_oficial ? formatTiempo(resultado.tiempo_oficial) : null,
    posicionGeneral: resultado?.posicion_general,
    posicionCategoria: resultado?.posicion_categoria,
    patrocinadores: patrocinadores?.map((p) => p.nombre),
  });

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificado-${inscripcion.id.slice(0, 8)}.pdf"`,
    },
  });
}
