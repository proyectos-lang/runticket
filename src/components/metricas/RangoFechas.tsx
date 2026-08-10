"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { EtiquetaMono } from "@/components/ui/Datos";
import { Pildora } from "@/components/ui/Pildora";

/**
 * Acota las métricas a un rango libre de fechas de inscripción (6.15).
 *
 * El estado vive en la URL (`?desde=&hasta=`) y no en React, por tres motivos:
 * sobrevive a la recarga, se puede compartir el enlace de un informe concreto, y
 * el cálculo lo hace Postgres —no el navegador— así que el rango tiene que
 * llegar al servidor de todas formas.
 *
 * Los atajos existen porque el caso real no es «del 3 al 17»: es «la última
 * semana» y «el último mes», y escribir dos fechas para eso es fricción pura.
 * Se calculan en el navegador a propósito: el organizador piensa en su día de
 * hoy, no en el del servidor, que en producción va en UTC.
 */
export function RangoFechas({ desde, hasta }: { desde: string | null; hasta: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function aplicar(nuevoDesde: string | null, nuevoHasta: string | null) {
    const nuevos = new URLSearchParams(params.toString());
    for (const [clave, valor] of [
      ["desde", nuevoDesde],
      ["hasta", nuevoHasta],
    ] as const) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    startTransition(() => router.push(`${pathname}?${nuevos.toString()}`));
  }

  /** Los últimos `dias` contando hoy, en formato ISO corto que espera `<input type=date>`. */
  function ultimos(dias: number) {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - (dias - 1));
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    aplicar(iso(inicio), iso(hoy));
  }

  const activo = Boolean(desde || hasta);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-superficie p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EtiquetaMono>Periodo de inscripción</EtiquetaMono>
        <div className="flex flex-wrap gap-2">
          <Pildora activa={!activo} disabled={pendiente} onClick={() => aplicar(null, null)}>
            Todo
          </Pildora>
          <Pildora disabled={pendiente} onClick={() => ultimos(7)}>
            Últimos 7 días
          </Pildora>
          <Pildora disabled={pendiente} onClick={() => ultimos(30)}>
            Últimos 30 días
          </Pildora>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5" htmlFor="rangoDesde">
          <EtiquetaMono>Desde</EtiquetaMono>
          <input
            id="rangoDesde"
            type="date"
            value={desde ?? ""}
            max={hasta ?? undefined}
            disabled={pendiente}
            onChange={(e) => aplicar(e.target.value || null, hasta)}
            className={`${CLASE_CAMPO} w-44 font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1.5" htmlFor="rangoHasta">
          <EtiquetaMono>Hasta</EtiquetaMono>
          <input
            id="rangoHasta"
            type="date"
            value={hasta ?? ""}
            min={desde ?? undefined}
            disabled={pendiente}
            onChange={(e) => aplicar(desde, e.target.value || null)}
            className={`${CLASE_CAMPO} w-44 font-mono`}
          />
        </label>
      </div>

      <p className="text-xs text-mudo">
        {activo
          ? "Todas las cifras de esta pantalla se refieren solo a las inscripciones creadas en el periodo."
          : "Sin acotar: se cuentan todas las inscripciones de la carrera."}
      </p>
    </section>
  );
}
