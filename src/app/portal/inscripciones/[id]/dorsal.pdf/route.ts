import { createClient } from "@/lib/supabase/server";
import { generarPdfDorsal } from "@/lib/pdf/dorsal";
import { formatFechaLarga } from "@/lib/format";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Sin cliente admin: la RLS ya garantiza que solo el dueño (o el staff del
  // evento) pueda leer esta inscripción.
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, evento_id, categoria_id, corredor_id, numero_dorsal, codigo_qr, empresa_id")
    .eq("id", id)
    .maybeSingle();

  if (!inscripcion) return new Response("Inscripción no encontrada", { status: 404 });
  if (!inscripcion.numero_dorsal || !inscripcion.codigo_qr) {
    return new Response("El dorsal se asigna cuando el organizador confirma tu pago.", { status: 409 });
  }

  const [{ data: evento }, { data: categoria }, { data: perfil }, { data: empresa }, { data: patrocinadores }] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("nombre, fecha_inicio, zona_horaria")
        .eq("id", inscripcion.evento_id)
        .single(),
      supabase.from("categorias").select("nombre").eq("id", inscripcion.categoria_id).single(),
      supabase.from("perfiles").select("nombres, apellidos").eq("id", inscripcion.corredor_id).single(),
      supabase.from("empresas").select("nombre_comercial").eq("id", inscripcion.empresa_id).single(),
      supabase.from("patrocinadores").select("nombre").eq("evento_id", inscripcion.evento_id).order("orden"),
    ]);

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const pdf = await generarPdfDorsal({
    dorsal: inscripcion.numero_dorsal,
    urlCheckin: `${sitio}/panel/eventos/${inscripcion.evento_id}/checkin?codigo=${inscripcion.codigo_qr}`,
    corredor: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim(),
    evento: evento?.nombre ?? "",
    categoria: categoria?.nombre ?? "",
    fechaEvento: evento ? formatFechaLarga(evento.fecha_inicio, evento.zona_horaria) : "",
    empresa: empresa?.nombre_comercial ?? "",
    patrocinadores: patrocinadores?.map((p) => p.nombre),
  });

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dorsal-${inscripcion.numero_dorsal}.pdf"`,
    },
  });
}
