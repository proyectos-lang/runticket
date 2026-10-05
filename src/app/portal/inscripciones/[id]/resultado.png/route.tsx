import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { trayectoriaDelCorredor, segundosDeIntervalo } from "@/lib/portal/trayectoria";
import { percentilDe } from "@/components/portal/Historial";
import { formatTiempo, formatRitmo, formatFechaMono, distanciaSiAporta } from "@/lib/format";
import { FORMATOS, formatoDe, fuentesMarca, imagenComoJpeg, ImagenResultado } from "@/lib/imagenes/compartir";

/**
 * La imagen compartible del resultado de una carrera: `?formato=historia`
 * (9:16) o `cuadrado` (1:1, por defecto).
 *
 * Mismas reglas que la pantalla del resultado: solo el dueño de la inscripción
 * (lo garantiza la RLS) y solo con el tiempo publicado. Sin caché: es privada
 * y cambia con cada publicación de resultados.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formato = formatoDe(new URL(request.url).searchParams.get("formato"));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, evento_id, categoria_id, numero_dorsal, corredor_id, estado")
    .eq("id", id)
    .maybeSingle();
  if (!inscripcion) return new Response("Inscripción no encontrada", { status: 404 });

  const [{ data: evento }, { data: categoria }, { data: resultado }, { data: perfil }] = await Promise.all([
    supabase
      .from("eventos")
      .select("nombre, fecha_inicio, zona_horaria, imagen_banner_url")
      .eq("id", inscripcion.evento_id)
      .maybeSingle(),
    supabase.from("categorias").select("nombre, distancia_km").eq("id", inscripcion.categoria_id).maybeSingle(),
    supabase
      .from("resultados")
      .select("tiempo_oficial, posicion_general, posicion_categoria")
      .eq("inscripcion_id", id)
      .eq("publicado", true)
      .maybeSingle(),
    supabase.from("perfiles").select("nombres, apellidos").eq("id", inscripcion.corredor_id).maybeSingle(),
  ]);
  if (!evento) return new Response("Evento no encontrado", { status: 404 });
  if (!resultado?.tiempo_oficial) {
    return new Response("Todavía no hay un tiempo publicado para esta inscripción.", { status: 409 });
  }

  const [{ count: participantes }, trayectoria, fuentes, banner] = await Promise.all([
    supabase
      .from("resultados")
      .select("id, inscripciones!inner(evento_id)", { count: "exact", head: true })
      .eq("publicado", true)
      .eq("inscripciones.evento_id", inscripcion.evento_id),
    trayectoriaDelCorredor(user.id),
    fuentesMarca(),
    imagenComoJpeg(evento.imagen_banner_url),
  ]);

  const segundos = segundosDeIntervalo(resultado.tiempo_oficial);
  const km = categoria?.distancia_km ?? null;
  const { ancho, alto } = FORMATOS[formato];

  return new ImageResponse(
    (
      <ImagenResultado
        formato={formato}
        evento={evento.nombre}
        fecha={formatFechaMono(evento.fecha_inicio, evento.zona_horaria)}
        categoria={[categoria?.nombre, distanciaSiAporta(categoria?.nombre ?? "", km)].filter(Boolean).join(" ")}
        tiempo={formatTiempo(resultado.tiempo_oficial)}
        ritmo={segundos !== null && km ? formatRitmo(segundos, km) : null}
        puesto={resultado.posicion_general}
        participantes={participantes ?? null}
        puestoCategoria={resultado.posicion_categoria}
        percentil={percentilDe(resultado.posicion_general, participantes ?? null)}
        esRecord={trayectoria.carreras.find((c) => c.inscripcionId === id)?.esRecord ?? false}
        corredor={`${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim()}
        dorsal={inscripcion.numero_dorsal}
        banner={banner}
      />
    ),
    {
      width: ancho,
      height: alto,
      fonts: fuentes,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="resultado-${formato}.png"`,
      },
    }
  );
}
