import Image from "next/image";
import {
  formatFechaMono,
  formatHoraMono,
  formatPrecio,
  formatDistancia,
} from "@/lib/format";
import { DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { motivoDeUrgencia } from "@/lib/eventos/urgencia";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { EtiquetaMono, PlaceholderMedia } from "@/components/ui/Datos";
import type { EventoPublico } from "@/lib/eventos/consultas";

/**
 * Fila densa del listado. Es la vista de comparación: el corredor llega con una
 * intención (distancia, ciudad, precio) y necesita cotejar varias carreras sin
 * abrir ninguna.
 */
export function FilaCarrera({
  evento,
  descripcion,
  destacada = false,
}: {
  evento: EventoPublico;
  /** Resumen en texto plano; la descripción del organizador viene en HTML. */
  descripcion?: string | null;
  /**
   * Solo una fila por listado puede llevar el borde y el botón naranja. La
   * elige la página, no la fila: si cada una decidiera por su cuenta, una lista
   * con cinco carreras a punto de cerrar saldría entera en naranja y no
   * destacaría ninguna.
   */
  destacada?: boolean;
}) {
  const urgencia = motivoDeUrgencia(evento);
  const cerrado = evento.estado !== "publicado";
  const resaltar = destacada && !cerrado;

  return (
    <article
      className={`flex flex-col gap-4 rounded-xl border bg-superficie p-3.5 transition-colors sm:flex-row ${
        resaltar ? "border-naranja/30" : "border-linea hover:border-linea-fuerte"
      }`}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg sm:aspect-auto sm:h-[7.375rem] sm:w-42.5">
        {evento.imagenBannerUrl ? (
          <Image
            src={evento.imagenBannerUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 170px"
            className="object-cover"
          />
        ) : (
          <PlaceholderMedia etiqueta="foto" className="absolute inset-0" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tono="info">{DISCIPLINA_LABEL[evento.disciplina]}</Chip>
          {urgencia && <Chip tono="acento">{urgencia}</Chip>}
          {cerrado && (
            <Chip tono="neutro">
              {evento.estado === "finalizado" ? "Finalizado" : "Inscripciones cerradas"}
            </Chip>
          )}
        </div>

        <p className="tabular font-mono text-[0.6875rem] uppercase tracking-etiqueta text-cian">
          {formatFechaMono(evento.fechaInicio)} · {formatHoraMono(evento.fechaInicio)}
          {evento.direccion && ` · ${evento.direccion}`}
        </p>

        <h2 className="text-xl font-extrabold leading-tight tracking-display text-texto">
          {evento.nombre}
        </h2>

        {descripcion && (
          <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-texto/50">
            {descripcion}
          </p>
        )}

        {evento.distancias.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {evento.distancias.map((d) => (
              <span
                key={d}
                className="tabular rounded-full bg-texto/6 px-2.5 py-0.5 text-xs font-medium text-atenuado"
              >
                {formatDistancia(d)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-linea pt-3 sm:w-42.5 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:pl-4 sm:pt-0">
        <div className="flex flex-col">
          <EtiquetaMono>Desde</EtiquetaMono>
          <span className="tabular text-2xl font-extrabold tracking-display text-texto">
            {evento.precioDesde !== null ? formatPrecio(evento.precioDesde, evento.moneda) : "—"}
          </span>
        </div>
        <BotonEnlace
          href={resaltar ? `/eventos/${evento.slug}/inscripcion` : `/eventos/${evento.slug}`}
          variante={resaltar ? "primaria" : "secundaria"}
          tamano="sm"
        >
          {resaltar ? "Inscribirme" : "Ver detalle"}
        </BotonEnlace>
      </div>
    </article>
  );
}
