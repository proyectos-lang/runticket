import Link from "next/link";
import { formatFechaMono } from "@/lib/format";
import { ChipEstadoEvento } from "./EstadoEvento";
import type { EstadoEvento } from "@/lib/supabase/database.types";

export type CarreraDeLista = {
  id: string;
  nombre: string;
  slug: string;
  fecha_inicio: string;
  estado: EstadoEvento;
};

/**
 * Fila de la lista de carreras del panel.
 *
 * El borde dice de un vistazo qué carrera necesita atención: naranja la
 * publicada más cercana —la que se abre a diario— y ámbar el borrador al que le
 * falta algo. Una lista de filas idénticas obliga a abrirlas todas para
 * descubrir cuál está a medias.
 */
export function FilaCarreraPanel({
  evento,
  destacada = false,
  pendientes = [],
  inscritos,
}: {
  evento: CarreraDeLista;
  destacada?: boolean;
  /** Lo que le falta para publicarse; solo se muestra en borrador. */
  pendientes?: string[];
  inscritos?: number;
}) {
  const [dia, mes, anio] = formatFechaMono(evento.fecha_inicio).split(" ");
  const incompleta = evento.estado === "borrador" && pendientes.length > 0;
  const terminada = evento.estado === "finalizado" || evento.estado === "cancelado";

  const borde = incompleta
    ? "border-amber-500/30"
    : destacada
      ? "border-naranja/28"
      : "border-linea hover:border-linea-fuerte";

  return (
    <Link
      href={`/panel/eventos/${evento.id}`}
      className={`flex items-center gap-4 rounded-xl border bg-superficie px-4 py-3.5 transition-colors ${borde} ${
        terminada ? "opacity-68" : ""
      }`}
    >
      <div className="flex w-11 shrink-0 flex-col items-center">
        <span
          className={`tabular text-xl font-extrabold leading-none tracking-display ${
            destacada ? "text-naranja-suave" : "text-texto"
          }`}
        >
          {dia}
        </span>
        <span className="font-mono text-[0.5625rem] font-semibold uppercase tracking-etiqueta text-mudo">
          {mes} {anio}
        </span>
      </div>

      <span aria-hidden className="h-9 w-px shrink-0 bg-linea" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-texto">{evento.nombre}</p>
        <p
          className={`truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta ${
            incompleta ? "text-ambar" : "text-mudo"
          }`}
        >
          {/* Se dice exactamente qué falta, no «configuración incompleta»: el
              organizador no debería tener que buscarlo. */}
          {incompleta ? `Faltan ${pendientes.join(", ")} para publicar` : `/${evento.slug}`}
        </p>
      </div>

      {inscritos !== undefined && (
        <div className="hidden shrink-0 flex-col items-end sm:flex">
          <span className="tabular font-mono text-sm font-bold text-texto">{inscritos}</span>
          <span className="font-mono text-[0.5625rem] uppercase tracking-etiqueta text-mudo">
            Inscritos
          </span>
        </div>
      )}

      <ChipEstadoEvento estado={evento.estado} />

      <span aria-hidden className="shrink-0 text-lg font-bold text-texto/30">
        ›
      </span>
    </Link>
  );
}
