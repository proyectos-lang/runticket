import { createClient } from "@/lib/supabase/server";
import { textoPlano } from "@/lib/sanitizar";

/** Fecha en el formato UTC que exige iCalendar: 20261115T063000Z */
function aFormatoICS(fecha: Date): string {
  return fecha.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapa los caracteres con significado en iCalendar (RFC 5545). */
function escapar(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug, descripcion, fecha_inicio, direccion")
    .eq("slug", slug)
    .maybeSingle();

  if (!evento) {
    return new Response("Evento no encontrado", { status: 404 });
  }

  const inicio = new Date(evento.fecha_inicio);
  // Sin hora de fin en el modelo: se asume una ventana de 4 horas, suficiente
  // para que el evento ocupe un bloque razonable en el calendario.
  const fin = new Date(inicio.getTime() + 4 * 60 * 60 * 1000);
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const descripcion = [textoPlano(evento.descripcion), `${sitio}/eventos/${evento.slug}`]
    .filter(Boolean)
    .join("\n\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RunTicket//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.id}@runticket`,
    `DTSTAMP:${aFormatoICS(new Date())}`,
    `DTSTART:${aFormatoICS(inicio)}`,
    `DTEND:${aFormatoICS(fin)}`,
    `SUMMARY:${escapar(evento.nombre)}`,
    descripcion ? `DESCRIPTION:${escapar(descripcion)}` : null,
    evento.direccion ? `LOCATION:${escapar(evento.direccion)}` : null,
    `URL:${sitio}/eventos/${evento.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${evento.slug}.ics"`,
    },
  });
}
