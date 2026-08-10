import { Readable } from "node:stream";
import archiver from "archiver";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { generarPdfCertificado } from "@/lib/pdf/certificado";
import { formatFechaLarga, formatTiempo } from "@/lib/format";
import { generarSlug } from "@/lib/slug";

/**
 * Descarga masiva de certificados (5.14).
 *
 * El motivo por el que esto no existía era el tiempo de ejecución: generar N
 * PDF y devolverlos juntos agota el límite de la función. Se ataca por los tres
 * sitios por los que se iba el tiempo, no por uno:
 *
 * 1. **Consultas.** El endpoint de un certificado suelto hace seis consultas.
 *    Repetirlo por corredor son ~4.800 idas y vueltas a la base en una carrera
 *    de 800. Aquí se traen todos los datos con **cinco consultas en total**, sea
 *    cual sea el número de inscritos.
 *
 * 2. **Memoria.** Acumular 800 PDF en un array antes de comprimir son cientos de
 *    megas en una función con límite. El ZIP se **emite según se genera** y solo
 *    hay un documento vivo cada vez: se espera al evento `entry` antes de
 *    fabricar el siguiente, que es lo que da la contrapresión.
 *
 * 3. **Primer byte.** Al ser un flujo, la respuesta empieza a bajar en cuanto
 *    está el primer certificado. La plataforma no ve una función que tarda
 *    minutos en contestar, ve una descarga en curso.
 *
 * Además el ZIP va **sin comprimir** (`store`). Un PDF ya está comprimido por
 * dentro: pasarle deflate gasta CPU —justo lo que escasea— para ahorrar un uno
 * por ciento.
 */

// Vercel corta las funciones mucho antes por su cuenta si el plan es menor; el
// tope se pide alto porque una carrera grande es una descarga larga, y la ruta
// está preparada para reanudarse por lotes si aun así no llega.
export const maxDuration = 300;
/**
 * Cuántos certificados entran en una descarga.
 *
 * No es un capricho: es el punto en el que una carrera muy grande dejaría de
 * caber en `maxDuration`. Cuando se alcanza, **se dice dentro del propio ZIP**
 * y se indica cómo pedir el siguiente lote. Un archivo truncado en silencio se
 * archiva como si estuviera completo, y nadie descubre que faltan cien
 * certificados hasta que los reclama un corredor.
 */
const POR_LOTE = 500;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Guarda por recurso: la empresa dueña del evento, no la activa en la cookie.
  try {
    await requireAdminDeEvento(id);
  } catch {
    return new Response("No autorizado", { status: 403 });
  }

  const desde = Math.max(0, Number(new URL(request.url).searchParams.get("desde") ?? 0) || 0);
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug, fecha_inicio, zona_horaria, estado, empresa_id")
    .eq("id", id)
    .maybeSingle();
  if (!evento) return new Response("El evento no existe", { status: 404 });

  // Mismo criterio que el certificado individual: no se acredita haber
  // participado en algo que el organizador aún no ha dado por terminado.
  if (evento.estado !== "finalizado") {
    return new Response(
      "Los certificados estarán disponibles cuando marques el evento como finalizado.",
      { status: 409 }
    );
  }

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("id, corredor_id, categoria_id, numero_dorsal")
    .eq("evento_id", id)
    .eq("estado", "activa")
    .order("numero_dorsal", { nullsFirst: false })
    .range(desde, desde + POR_LOTE); // Una de más: si vuelve, es que hay otro lote.

  const hayMas = (inscripciones?.length ?? 0) > POR_LOTE;
  const lote = (inscripciones ?? []).slice(0, POR_LOTE);

  if (lote.length === 0) {
    return new Response("Esta carrera no tiene inscripciones activas.", { status: 409 });
  }

  // Las cuatro consultas restantes, con independencia de cuántos corredores haya.
  const corredorIds = [...new Set(lote.map((i) => i.corredor_id))];
  const inscripcionIds = lote.map((i) => i.id);

  const [{ data: perfiles }, { data: categorias }, { data: resultados }, { data: empresa }, { data: patrocinadores }] =
    await Promise.all([
      supabase.from("perfiles").select("id, nombres, apellidos").in("id", corredorIds),
      supabase.from("categorias").select("id, nombre").eq("evento_id", id),
      supabase
        .from("resultados")
        .select("inscripcion_id, tiempo_oficial, posicion_general, posicion_categoria")
        .in("inscripcion_id", inscripcionIds),
      supabase.from("empresas").select("nombre_comercial").eq("id", evento.empresa_id).maybeSingle(),
      supabase.from("patrocinadores").select("nombre").eq("evento_id", id).order("orden"),
    ]);

  const mapaPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]));
  const mapaCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));
  const mapaResultado = new Map((resultados ?? []).map((r) => [r.inscripcion_id, r]));

  const comunes = {
    evento: evento.nombre,
    fechaEvento: formatFechaLarga(evento.fecha_inicio, evento.zona_horaria),
    empresa: empresa?.nombre_comercial ?? "",
    patrocinadores: (patrocinadores ?? []).map((p) => p.nombre),
  };

  const archive = archiver("zip", { store: true });

  /** Espera a que el ZIP termine de tragarse la entrada anterior. */
  const siguienteEntrada = () =>
    new Promise<void>((resolver, rechazar) => {
      archive.once("entry", () => resolver());
      archive.once("error", rechazar);
    });

  // Se lanza sin `await`: la respuesta se devuelve ya y los bytes van saliendo.
  void (async () => {
    const fallos: string[] = [];

    for (const i of lote) {
      const perfil = mapaPerfil.get(i.corredor_id);
      const nombre = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim();
      const resultado = mapaResultado.get(i.id);

      try {
        const pdf = await generarPdfCertificado({
          ...comunes,
          corredor: nombre,
          categoria: mapaCategoria.get(i.categoria_id) ?? "",
          tiempo: resultado?.tiempo_oficial ? formatTiempo(resultado.tiempo_oficial) : null,
          posicionGeneral: resultado?.posicion_general,
          posicionCategoria: resultado?.posicion_categoria,
        });

        // El dorsal delante para que el ZIP salga ordenado como la lista de
        // salida, que es como el organizador los reparte.
        const prefijo = i.numero_dorsal !== null ? String(i.numero_dorsal).padStart(5, "0") : "sin-dorsal";
        const archivo = `${prefijo}-${generarSlug(nombre) || i.id.slice(0, 8)}.pdf`;

        const entrada = siguienteEntrada();
        archive.append(Buffer.from(pdf), { name: archivo });
        await entrada;
      } catch (e) {
        // Un certificado que falla no puede tumbar la descarga entera: a estas
        // alturas ya hay bytes enviados y no se puede cambiar el código de
        // estado. Se anota y se sigue.
        fallos.push(`${nombre || i.id}: ${e instanceof Error ? e.message : "error desconocido"}`);
      }
    }

    const notas: string[] = [
      `Certificados de ${evento.nombre}`,
      `Generados: ${lote.length}`,
      `Desde el registro: ${desde}`,
    ];
    if (hayMas) {
      notas.push(
        "",
        `Esta descarga llegó al tope de ${POR_LOTE} certificados y NO está completa.`,
        `Para el siguiente lote añade ?desde=${desde + POR_LOTE} a la URL de descarga.`
      );
    }
    if (fallos.length) {
      notas.push("", "No se pudieron generar estos:", ...fallos);
    }
    archive.append(Buffer.from(notas.join("\n"), "utf8"), { name: "LEEME.txt" });

    await archive.finalize();
  })();

  const sufijo = hayMas ? `-desde-${desde}` : "";
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="certificados-${evento.slug}${sufijo}.zip"`,
      // Sin longitud conocida —se genera sobre la marcha—, así que se pide que
      // ningún intermediario intente almacenarlo en búfer.
      "Cache-Control": "no-store",
    },
  });
}
