import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatTiempo, formatRitmo, formatFechaMono, distanciaSiAporta } from "@/lib/format";
import { segundosDeIntervalo, trayectoriaDelCorredor } from "@/lib/portal/trayectoria";
import { BarraPercentil, percentilDe } from "@/components/portal/Historial";
import { PlaceholderMedia } from "@/components/ui/Datos";
import { BotonEnlace, claseBoton } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi resultado | RunTicket",
  robots: { index: false },
};

function Celda({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5 text-center">
      <span className="font-mono text-[0.5625rem] font-medium uppercase tracking-etiqueta text-mudo">
        {etiqueta}
      </span>
      <span
        className={`tabular truncate font-mono text-[0.9375rem] font-bold ${destacado ? "text-cian" : "text-texto"}`}
      >
        {valor}
      </span>
    </div>
  );
}

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, evento_id, categoria_id, numero_dorsal, estado")
    .eq("id", id)
    .maybeSingle();
  if (!inscripcion) notFound();

  const [{ data: evento }, { data: categoria }, { data: resultado }] = await Promise.all([
    supabase
      .from("eventos")
      .select("nombre, slug, fecha_inicio, zona_horaria, imagen_banner_url, estado")
      .eq("id", inscripcion.evento_id)
      .maybeSingle(),
    supabase
      .from("categorias")
      .select("nombre, distancia_km")
      .eq("id", inscripcion.categoria_id)
      .maybeSingle(),
    supabase
      .from("resultados")
      .select("tiempo_oficial, posicion_general, posicion_categoria, publicado")
      .eq("inscripcion_id", id)
      .maybeSingle(),
  ]);

  // Sin evento no hay nada que enseñar, y seguir adelante generaba enlaces a
  // `/eventos/undefined/...`: la RLS deja de exponerlo si vuelve a borrador o se
  // cancela, y hasta ahora eso no se comprobaba.
  if (!evento) notFound();

  // Mismo criterio que aplica el endpoint del PDF. Antes esto se consultaba en la
  // tabla `certificados`, en la que no escribe nadie, así que el botón de
  // descarga no llegaba a aparecer nunca.
  const certificadoDisponible = evento.estado === "finalizado" && inscripcion.estado === "activa";

  // Cuántos tienen tiempo publicado en el evento, para situar el puesto.
  const { count: participantes } = await supabase
    .from("resultados")
    .select("id, inscripciones!inner(evento_id)", { count: "exact", head: true })
    .eq("publicado", true)
    .eq("inscripciones.evento_id", inscripcion.evento_id);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récord personal: la marca más rápida del propio corredor en esa distancia.
  // Se resuelve aquí y no en el cliente porque exige mirar todas sus carreras.
  let esRecord = false;
  if (user && categoria?.distancia_km !== null && resultado?.tiempo_oficial) {
    const t = await trayectoriaDelCorredor(user.id);
    esRecord = t.carreras.find((c) => c.inscripcionId === id)?.esRecord ?? false;
  }

  const segundos = segundosDeIntervalo(resultado?.tiempo_oficial ?? null);
  const km = categoria?.distancia_km ?? null;
  const ritmo = segundos !== null && km ? formatRitmo(segundos, km) : null;
  const percentil = percentilDe(resultado?.posicion_general ?? null, participantes ?? null);

  return (
    <div className="-mx-6 -my-8 flex flex-col lg:-mx-8">
      <div className="relative h-50 w-full">
        {evento?.imagen_banner_url ? (
          <Image
            src={evento.imagen_banner_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <PlaceholderMedia
            etiqueta="foto: llegada a meta"
            variante="calida"
            className="absolute inset-0"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-fondo))" }}
        />
        <Link
          href="/portal"
          aria-label="Volver a mi perfil"
          className="absolute left-5 top-5 flex size-9 items-center justify-center rounded-lg border border-texto/14 bg-fondo/60 text-lg font-bold text-texto backdrop-blur"
        >
          ‹
        </Link>
      </div>

      <div className="relative -mt-6 flex flex-col gap-7 px-6 pb-10">
        <header className="flex flex-col gap-2">
          <h1 className="display text-[clamp(1.75rem,7vw,2.25rem)] text-texto">{evento?.nombre}</h1>
          <p className="tabular font-mono text-[0.6875rem] uppercase tracking-etiqueta text-texto/45">
            {evento && formatFechaMono(evento.fecha_inicio, evento.zona_horaria)}
            {categoria?.nombre && ` · ${categoria.nombre}`}
            {distanciaSiAporta(categoria?.nombre ?? "", km) &&
              ` · ${distanciaSiAporta(categoria?.nombre ?? "", km)}`}
            {inscripcion.numero_dorsal !== null && ` · Dorsal #${inscripcion.numero_dorsal}`}
          </p>
        </header>

        {segundos === null ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-linea bg-superficie px-6 py-10 text-center">
            <p className="tabular font-mono text-3xl font-black text-texto/35">—:—:—</p>
            <p className="text-sm text-atenuado">
              {resultado
                ? "Tu tiempo está en revisión; aparecerá cuando el organizador lo publique."
                : "El organizador todavía no ha cargado los resultados de esta carrera."}
            </p>
          </div>
        ) : (
          <section
            className={`flex flex-col gap-4 rounded-xl border bg-superficie-2 py-6 ${
              esRecord ? "border-naranja/30" : "border-linea"
            }`}
          >
            {esRecord && (
              <span className="mx-auto w-fit rounded-full border border-naranja/40 bg-naranja/14 px-3 py-1.5 font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-naranja-suave">
                Récord personal
              </span>
            )}
            <div className="flex flex-col items-center gap-1.5 px-6">
              <p className="tabular text-center font-mono text-[clamp(2.5rem,14vw,3.375rem)] font-black leading-none tracking-display text-texto">
                {formatTiempo(resultado!.tiempo_oficial)}
              </p>
              <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
                Tiempo oficial
                {km !== null && ` · ${km} km`}
              </span>
            </div>

            <div className="flex divide-x divide-linea border-y border-linea">
              <Celda
                etiqueta="Puesto general"
                valor={
                  resultado!.posicion_general !== null
                    ? `${resultado!.posicion_general}${participantes ? `/${participantes}` : ""}`
                    : "—"
                }
              />
              <Celda
                etiqueta="Categoría"
                valor={
                  resultado!.posicion_categoria !== null
                    ? `${resultado!.posicion_categoria}`
                    : "—"
                }
              />
              <Celda etiqueta="Ritmo" valor={ritmo ?? "—"} destacado />
            </div>

            {percentil !== null && (
              <div className="flex flex-col gap-2 px-6">
                <BarraPercentil puesto={resultado!.posicion_general} total={participantes ?? null} />
                <p className="font-mono text-[0.71875rem] font-medium text-texto/45">
                  Mejor que el <span className="font-bold text-cian">{percentil} %</span> de la{" "}
                  {categoria?.nombre ?? "carrera"}
                </p>
              </div>
            )}
          </section>
        )}

        <div className="flex flex-col gap-2.5">
          {certificadoDisponible ? (
            // Ancla y no `BotonEnlace`: el destino es un PDF que genera un route
            // handler, y `next/link` lo prefetch-earía al pasar el ratón,
            // haciendo que el servidor componga el documento sin que nadie lo
            // haya pedido. El resto del portal ya usa `<a>` para este mismo PDF.
            <a
              href={`/portal/inscripciones/${id}/certificado.pdf`}
              className={claseBoton("primaria", "md", "w-full")}
            >
              Descargar certificado
            </a>
          ) : (
            <p className="rounded-lg border border-linea bg-superficie px-4 py-3 text-center text-sm text-atenuado">
              El certificado se genera cuando el organizador publica los resultados.
            </p>
          )}
          <BotonEnlace href={`/eventos/${evento.slug}/resultados`} variante="secundaria" ancho>
            Ver clasificación completa
          </BotonEnlace>
          <BotonEnlace href={`/eventos/${evento.slug}/fotos`} variante="fantasma" ancho>
            Fotos del evento
          </BotonEnlace>
        </div>

        {inscripcion.estado !== "activa" && (
          <Chip tono="neutro" className="self-start">
            Inscripción {inscripcion.estado}
          </Chip>
        )}
      </div>
    </div>
  );
}
