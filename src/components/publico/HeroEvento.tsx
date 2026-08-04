import Image from "next/image";
import { formatFechaMono, formatHoraMono, formatPrecio, formatDistancia } from "@/lib/format";
import { BotonEnlace } from "@/components/ui/Boton";
import { EtiquetaMono, PlaceholderMedia } from "@/components/ui/Datos";
import type { EventoPublico } from "@/lib/eventos/consultas";

/**
 * El año del titular va en naranja. Se parte por la última secuencia de cuatro
 * cifras y no por espacios: hay carreras cuyo nombre lleva el año en medio
 * («Maratón 2026 Tegucigalpa») y cortar por la última palabra las rompe.
 */
function partirTitular(nombre: string) {
  const m = nombre.match(/^(.*?)(\b\d{4}\b)(.*)$/);
  if (!m) return { antes: nombre, anio: null, despues: "" };
  return { antes: m[1], anio: m[2], despues: m[3] };
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 first:pl-0 last:pr-0">
      <EtiquetaMono>{etiqueta}</EtiquetaMono>
      <span className="tabular font-mono text-[0.9375rem] font-bold text-texto">{children}</span>
    </div>
  );
}

export function HeroEvento({
  evento,
  cupos,
}: {
  evento: EventoPublico;
  /** null cuando ninguna categoría tiene tope: no se muestra escasez. */
  cupos: { disponibles: number; totales: number } | null;
}) {
  const { antes, anio, despues } = partirTitular(evento.nombre);
  const distancias = evento.distancias.map(formatDistancia).filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden border-b border-linea">
      {/* Trama diagonal del fondo, más cerrada que la de los huecos de imagen. */}
      <div aria-hidden className="trama-heroe absolute inset-0" />
      {/* Los dos halos y la línea de meta son decoración: nunca deben capturar
          el ratón ni aparecer en el árbol de accesibilidad. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 size-[38.75rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,106,26,.34), transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 -left-20 size-[32.5rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,107,255,.28), transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,106,26,.5), transparent)",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-end gap-11 px-6 pb-14 pt-16 lg:flex-row lg:px-10">
        <div className="flex w-full flex-[1.15] flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-naranja/40 bg-naranja/12 px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-etiqueta text-naranja-suave">
            <span className="size-1.5 rounded-full bg-naranja" />
            Inscripciones abiertas
          </span>

          <h1 className="display text-[clamp(2.75rem,12vw,5.75rem)] text-texto">
            {antes}
            {anio && <span className="text-naranja">{anio}</span>}
            {despues}
          </h1>

          <div className="flex flex-wrap divide-x divide-linea-fuerte">
            <Dato etiqueta="Fecha">
              {formatFechaMono(evento.fechaInicio)} · {formatHoraMono(evento.fechaInicio)}
            </Dato>
            {distancias && <Dato etiqueta="Distancias">{distancias}</Dato>}
            {evento.precioDesde !== null && (
              <div className="flex flex-col gap-1 px-5 first:pl-0 last:pr-0">
                <EtiquetaMono>Desde</EtiquetaMono>
                <span className="tabular font-mono text-[0.9375rem] font-bold text-naranja">
                  {formatPrecio(evento.precioDesde, evento.moneda)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <BotonEnlace
              href={`/eventos/${evento.slug}/inscripcion`}
              variante="primaria"
              tamano="lg"
            >
              Inscribirme ahora
            </BotonEnlace>
            <BotonEnlace href={`/eventos/${evento.slug}`} variante="secundaria" tamano="lg">
              Ver ruta y kit
            </BotonEnlace>
            {cupos && (
              <p className="tabular font-mono text-xs text-texto/45">
                <span className="text-naranja-suave">{cupos.disponibles}</span> de{" "}
                {cupos.totales} cupos disponibles
              </p>
            )}
          </div>
        </div>

        <div className="relative aspect-[6/5] w-full flex-[0.85] overflow-hidden rounded-xl lg:h-100 lg:aspect-auto">
          {evento.imagenBannerUrl ? (
            <Image
              src={evento.imagenBannerUrl}
              alt={evento.nombre}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          ) : (
            <PlaceholderMedia
              etiqueta="foto: pelotón de salida"
              variante="calida"
              className="absolute inset-0"
            />
          )}
        </div>
      </div>
    </section>
  );
}
