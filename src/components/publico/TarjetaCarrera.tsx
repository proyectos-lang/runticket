import Link from "next/link";
import Image from "next/image";
import { formatFechaMono, formatPrecio, formatDistancia } from "@/lib/format";
import { DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { motivoDeUrgencia } from "@/lib/eventos/urgencia";
import { EtiquetaMono, PlaceholderMedia } from "@/components/ui/Datos";
import type { EventoPublico } from "@/lib/eventos/consultas";

/**
 * Tarjeta de carrera. Se usa en la portada, en la vista de rejilla del listado
 * y en la página de organizador.
 *
 * El chip de disciplina va en azul sólido porque se superpone a una fotografía
 * y ahí un fondo translúcido pierde legibilidad según la imagen que toque.
 */
export function TarjetaCarrera({
  evento,
  destacada = false,
  compacta = false,
}: {
  evento: EventoPublico;
  /**
   * Solo una tarjeta por listado puede llevar el borde naranja de urgencia. La
   * elige quien pinta la lista, no la tarjeta: si cada una decidiera por su
   * cuenta, una rejilla con cinco carreras a punto de cerrar saldría entera en
   * naranja y no destacaría ninguna.
   */
  destacada?: boolean;
  /** Imagen más baja para la rejilla de dos columnas de la página de organizador. */
  compacta?: boolean;
}) {
  const cerrado = evento.estado !== "publicado";
  const urgencia = destacada ? motivoDeUrgencia(evento) : null;

  return (
    <Link
      href={`/eventos/${evento.slug}`}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-superficie transition-colors ${
        urgencia ? "border-naranja/30" : "border-linea hover:border-linea-fuerte"
      }`}
    >
      <div className={`relative w-full ${compacta ? "h-30" : "h-40"}`}>
        {evento.imagenBannerUrl ? (
          <Image
            src={evento.imagenBannerUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <PlaceholderMedia etiqueta="foto 16:9" className="absolute inset-0" />
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-azul/85 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-white">
            {DISCIPLINA_LABEL[evento.disciplina]}
          </span>
          {urgencia && (
            <span className="rounded-full bg-naranja px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-tinta">
              {urgencia}
            </span>
          )}
          {cerrado && (
            <span className="rounded-full bg-texto/12 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-texto">
              {evento.estado === "finalizado" ? "Finalizado" : "Cerrado"}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4.5 pb-4 pt-4">
        <span className="font-mono text-[0.65625rem] font-semibold uppercase tracking-etiqueta text-cian">
          {formatFechaMono(evento.fechaInicio)}
        </span>

        <h3 className="text-lg font-extrabold leading-tight tracking-display text-texto">
          {evento.nombre}
        </h3>

        {evento.direccion && (
          <p className="line-clamp-1 text-xs text-atenuado">{evento.direccion}</p>
        )}

        {evento.distancias.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {evento.distancias.map((d) => (
              <span
                key={d}
                className="tabular rounded-[0.3125rem] bg-texto/6 px-2.5 py-1 font-mono text-[0.65625rem] font-medium text-atenuado"
              >
                {formatDistancia(d)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-linea pt-3.5">
          {evento.precioDesde !== null ? (
            <div className="flex flex-col">
              <EtiquetaMono>Desde</EtiquetaMono>
              <span className="tabular text-lg font-extrabold tracking-display text-texto">
                {formatPrecio(evento.precioDesde, evento.moneda)}
              </span>
            </div>
          ) : (
            <span />
          )}
          {evento.empresa && (
            <span className="truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              {evento.empresa.nombreComercial}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
