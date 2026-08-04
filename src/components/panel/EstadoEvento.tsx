import Link from "next/link";
import type { EstadoEvento, ResumenEvento } from "@/lib/supabase/database.types";

/**
 * Chip de estado de una carrera.
 *
 * Borrador en ámbar y publicado en verde no son decorativos: el ámbar dice
 * «esto todavía no lo ve nadie» y es la única señal en la lista de carreras de
 * que algo quedó a medias.
 */
const CHIP: Record<EstadoEvento, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "border border-amber-500/38 bg-amber-500/14 text-ambar" },
  publicado: { texto: "Publicado", clase: "border border-emerald-500/34 bg-emerald-500/14 text-verde" },
  inscripciones_cerradas: { texto: "Inscripciones cerradas", clase: "bg-texto/8 text-texto/70" },
  finalizado: { texto: "Finalizado", clase: "bg-texto/8 text-texto/70" },
  cancelado: { texto: "Cancelado", clase: "border border-red-500/40 bg-red-500/12 text-rojo" },
};

export function ChipEstadoEvento({ estado }: { estado: EstadoEvento }) {
  const c = CHIP[estado];
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.75 py-1.5 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta ${c.clase}`}
    >
      {c.texto}
    </span>
  );
}

export type PendientePublicacion = {
  clave: "categorias" | "portada" | "ubicacion";
  etiqueta: string;
  ruta: string;
};

/**
 * Qué le falta a una carrera para poder publicarse.
 *
 * Se calcula en un solo sitio porque lo consumen tres pantallas —la lista de
 * carreras, el centro de mando y el botón de publicar—, y si cada una aplicara
 * su propio criterio el botón podría estar activo mientras el aviso dice que
 * falta algo.
 */
export function pendientesDePublicacion(
  r: Partial<ResumenEvento>,
  base: string
): PendientePublicacion[] {
  const faltan: PendientePublicacion[] = [];
  if (!r.categorias)
    faltan.push({ clave: "categorias", etiqueta: "Categorías · 0 creadas", ruta: `${base}/categorias` });
  if (!r.tiene_banner)
    faltan.push({ clave: "portada", etiqueta: "Portada · sin imagen", ruta: `${base}/imagenes` });
  if (!r.tiene_ubicacion)
    faltan.push({ clave: "ubicacion", etiqueta: "Ubicación · sin coordenadas", ruta: `${base}/ubicacion` });
  return faltan;
}

/**
 * Aviso de lo que falta para publicar.
 *
 * Cada chip dice **exactamente qué falta y cuánto**, y enlaza a la pantalla que
 * lo resuelve. Un «completa la configuración» genérico obliga a buscar, que es
 * justo lo que esta caja existe para evitar.
 */
export function AvisoPublicacion({ pendientes }: { pendientes: PendientePublicacion[] }) {
  if (!pendientes.length) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-500/38 bg-amber-500/9 px-4.5 py-4">
      <p className="text-[0.8125rem] font-bold text-ambar">Falta esto para poder publicar</p>
      <div className="flex flex-wrap gap-2">
        {pendientes.map((p) => (
          <Link
            key={p.clave}
            href={p.ruta}
            className="rounded-md bg-amber-500/14 px-3 py-1.75 font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-ambar transition-colors hover:bg-amber-500/22"
          >
            {p.etiqueta}
          </Link>
        ))}
      </div>
    </section>
  );
}
