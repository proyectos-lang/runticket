import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/auth/session";
import { trayectoriaDelCorredor } from "@/lib/portal/trayectoria";
import { formatTiempo, formatDistancia, formatMesMono } from "@/lib/format";
import { FORMATOS, formatoDe, fuentesMarca, imagenComoJpeg, ImagenHistorial } from "@/lib/imagenes/compartir";

/**
 * La imagen compartible del historial del corredor: sus cifras, sus mejores
 * marcas y sus últimas carreras. `?formato=historia` (9:16) o `cuadrado` (1:1).
 *
 * De fondo va la portada de su carrera más reciente; sin ninguna, un degradado
 * de la marca. Privada y sin caché: es de quien la pide.
 */
export async function GET(request: Request) {
  const formato = formatoDe(new URL(request.url).searchParams.get("formato"));
  const perfil = await getPerfilActual();
  if (!perfil) return new Response("No autorizado", { status: 401 });

  const supabase = await createClient();
  const [t, { data: ciudad }] = await Promise.all([
    trayectoriaDelCorredor(perfil.id),
    perfil.ciudad_id
      ? supabase.from("ciudades").select("nombre").eq("id", perfil.ciudad_id).maybeSingle()
      : Promise.resolve({ data: null as { nombre: string } | null }),
  ]);

  const propias = t.finalizadas.filter((c) => c.esPropia);
  const [fuentes, avatar, banner] = await Promise.all([
    fuentesMarca(),
    imagenComoJpeg(perfil.foto_url, 300),
    imagenComoJpeg(propias.find((c) => c.banner)?.banner ?? null),
  ]);

  const { ancho, alto } = FORMATOS[formato];
  return new ImageResponse(
    (
      <ImagenHistorial
        formato={formato}
        nombre={[perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") || "Corredor"}
        ciudad={ciudad?.nombre ?? null}
        desdeAnio={t.desdeAnio}
        carreras={t.metricas.carreras}
        kmTotales={t.metricas.kmTotales}
        podios={t.metricas.podios}
        mejores={t.metricas.mejores.map((m) => ({
          distancia: formatDistancia(m.distanciaKm) ?? `${m.distanciaKm} km`,
          tiempo: formatTiempo(m.tiempo),
        }))}
        ultimas={propias.map((c) => ({
          evento: c.evento,
          tiempo: c.tiempo ? formatTiempo(c.tiempo) : null,
          fecha: formatMesMono(c.fecha, c.zonaHoraria),
        }))}
        avatar={avatar}
        banner={banner}
      />
    ),
    {
      width: ancho,
      height: alto,
      fonts: fuentes,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="mi-historial-${formato}.png"`,
      },
    }
  );
}
