"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PASOS_CONFIGURACION } from "@/components/shell/navegacion";
import { claseBoton } from "@/components/ui/estilosBoton";

/**
 * Asistente para configurar una carrera.
 *
 * Aparece **solo** en las pantallas de configuración, no en las de operación
 * (inscritos, entrega de kits, resultados): allí no hay un «siguiente» que tenga
 * sentido, se entra a hacer una cosa concreta y se sale.
 *
 * No sustituye a la vista de todas las secciones: el centro de mando de la
 * carrera sigue mostrando la rejilla completa, y desde aquí se vuelve a ella con
 * «Ver todas». El asistente es para quien monta una carrera de cero; la rejilla,
 * para quien viene a tocar una cosa suelta.
 *
 * Es de cliente porque el layout del evento es de servidor y no sabe en qué
 * sub-pantalla está.
 */
export function PasosCarrera({ eventoId }: { eventoId: string }) {
  const pathname = usePathname();
  const base = `/panel/eventos/${eventoId}`;

  const indice = PASOS_CONFIGURACION.findIndex((p) => pathname === `${base}/${p.segmento}`);
  if (indice === -1) return null;

  const total = PASOS_CONFIGURACION.length;
  const anterior = indice > 0 ? PASOS_CONFIGURACION[indice - 1] : null;
  const siguiente = indice < total - 1 ? PASOS_CONFIGURACION[indice + 1] : null;

  return (
    <nav
      aria-label="Configuración paso a paso"
      className="flex flex-col gap-4 border-t pt-5 border-linea"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[0.65625rem] font-semibold uppercase tracking-etiqueta text-mudo">
          Paso <span className="tabular text-texto">{indice + 1}</span> de{" "}
          <span className="tabular">{total}</span> ·{" "}
          <span className="text-atenuado">{PASOS_CONFIGURACION[indice].etiqueta}</span>
        </p>
        <Link
          href={base}
          className="text-sm text-mudo underline-offset-2 transition-colors hover:text-texto hover:underline"
        >
          Ver todas las secciones
        </Link>
      </div>

      {/* Segmentos sin etiqueta: con ocho pasos, rotularlos todos los volvería
          ilegibles en un portátil y aún más en una tablet. */}
      <ol className="flex items-center gap-1.5" aria-hidden>
        {PASOS_CONFIGURACION.map((p, i) => (
          <li
            key={p.segmento}
            className={`h-0.5 flex-1 rounded-full transition-colors ${
              i < indice ? "bg-naranja/45" : i === indice ? "bg-naranja" : "bg-linea-fuerte"
            }`}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {anterior ? (
          <Link href={`${base}/${anterior.segmento}`} className={claseBoton("fantasma", "md")}>
            ← {anterior.etiqueta}
          </Link>
        ) : (
          <span />
        )}

        {siguiente ? (
          // Secundaria y no primaria: el naranja de estas pantallas es del botón
          // de guardar, que es la acción que de verdad cambia algo.
          <Link href={`${base}/${siguiente.segmento}`} className={claseBoton("secundaria", "md")}>
            Siguiente: {siguiente.etiqueta} →
          </Link>
        ) : (
          <Link href={base} className={claseBoton("secundaria", "md")}>
            Terminar y ver el resumen →
          </Link>
        )}
      </div>

      <p className="text-xs text-mudo">
        Cada sección se guarda por su cuenta: puedes saltar de paso sin perder lo escrito, pero
        guarda antes de avanzar.
      </p>
    </nav>
  );
}
