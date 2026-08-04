import { formatTiempo } from "@/lib/format";
import { EtiquetaMono } from "@/components/ui/Datos";
import type { ResultadoPublico } from "@/lib/supabase/database.types";

/**
 * Podio de una categoría.
 *
 * El primero va elevado y con borde naranja porque en el diseño el podio es la
 * única parte de la pantalla que celebra algo; la tabla de abajo es consulta.
 * El orden visual es 2.º · 1.º · 3.º, como un podio real, pero el orden del DOM
 * es 1.º · 2.º · 3.º para que un lector de pantalla lo enuncie por posición.
 */
export function PodioResultados({
  categoria,
  puestos,
}: {
  categoria: string;
  puestos: ResultadoPublico[];
}) {
  if (!puestos.length) return null;
  const ORDEN_VISUAL = ["sm:order-2", "sm:order-1", "sm:order-3"];

  return (
    <section className="flex flex-col gap-3">
      <EtiquetaMono>{categoria}</EtiquetaMono>
      <ol className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        {puestos.slice(0, 3).map((r, i) => {
          const primero = i === 0;
          return (
            <li
              key={r.numero_dorsal ?? r.nombre_completo}
              className={`flex flex-col items-center gap-2 rounded-xl bg-superficie-2 text-center ${
                primero ? "border border-naranja/40 p-6 sm:flex-[1.12]" : "border border-linea p-5 sm:flex-1"
              } ${ORDEN_VISUAL[i]}`}
            >
              <span
                className={`font-mono text-xs font-bold ${primero ? "text-naranja-suave" : "text-mudo"}`}
              >
                {i + 1}.º
              </span>
              <span
                className={`flex items-center justify-center rounded-full font-extrabold text-texto ${
                  primero ? "size-16 border-2 border-naranja text-xl" : "size-13 border border-linea-fuerte text-base"
                }`}
              >
                {r.nombre_completo
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </span>
              <span className={`font-extrabold text-texto ${primero ? "text-lg" : "text-[0.9375rem]"}`}>
                {r.nombre_completo}
              </span>
              <span className="tabular font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
                {r.numero_dorsal !== null && `Dorsal ${r.numero_dorsal}`}
                {r.sexo && ` · ${r.sexo === "femenino" ? "F" : r.sexo === "masculino" ? "M" : "X"}`}
              </span>
              <span
                className={`tabular font-mono font-black tracking-display text-texto ${
                  primero ? "text-3xl" : "text-2xl"
                }`}
              >
                {formatTiempo(r.tiempo_oficial)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
