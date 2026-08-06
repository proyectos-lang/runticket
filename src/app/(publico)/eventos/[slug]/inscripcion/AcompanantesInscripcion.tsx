"use client";

import Link from "next/link";
import { useState } from "react";
import { EtiquetaMono } from "@/components/ui/Datos";
import { Select } from "@/components/ui/Select";
import { formatPrecio, formatDistancia } from "@/lib/format";

export type CategoriaParaAcompanante = {
  id: string;
  nombre: string;
  distancia_km: number | null;
  precio_vigente: number;
  elegible: boolean;
  motivo: string | null;
};

export type AcompananteInscribible = {
  /** Id de la relación en `acompanantes`, que es lo que espera la RPC. */
  id: string;
  nombre: string;
  parentesco: string;
  edad: number | null;
  tallaSugerida: string | null;
  /** Ya tiene inscripción activa en esta carrera. */
  yaInscrito: boolean;
  categorias: CategoriaParaAcompanante[];
};

type Seleccion = { id: string; categoriaId: string; talla: string | null };

/**
 * Inscribir a los acompañantes junto con uno mismo.
 *
 * Cada uno elige **su propia distancia**: lo normal es que el hijo corra los 5K
 * mientras el padre hace la 21K, así que ofrecer una categoría común sería
 * inservible. Las que no le corresponden por edad salen deshabilitadas con el
 * motivo, igual que en la lista del titular.
 *
 * La selección viaja en un único campo oculto con JSON en lugar de un campo por
 * persona: la lista es dinámica y así el servidor la valida de una vez, sin
 * reconstruirla adivinando nombres de campos.
 */
export function AcompanantesInscripcion({
  acompanantes,
  moneda,
  tallas,
}: {
  acompanantes: AcompananteInscribible[];
  moneda: string;
  tallas: { talla: string; inventario_disponible: number | null }[];
}) {
  const [seleccion, setSeleccion] = useState<Seleccion[]>([]);

  const elegido = (id: string) => seleccion.find((s) => s.id === id);

  function alternar(a: AcompananteInscribible) {
    setSeleccion((prev) => {
      if (prev.some((s) => s.id === a.id)) return prev.filter((s) => s.id !== a.id);
      const primera = a.categorias.find((c) => c.elegible);
      return [...prev, { id: a.id, categoriaId: primera?.id ?? "", talla: a.tallaSugerida }];
    });
  }

  const actualizar = (id: string, cambio: Partial<Seleccion>) =>
    setSeleccion((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambio } : s)));

  const total = seleccion.reduce((suma, s) => {
    const a = acompanantes.find((x) => x.id === s.id);
    const c = a?.categorias.find((x) => x.id === s.categoriaId);
    return suma + Number(c?.precio_vigente ?? 0);
  }, 0);

  if (acompanantes.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-dashed px-5 py-4 border-linea-fuerte">
        <EtiquetaMono>¿Corres acompañado?</EtiquetaMono>
        <p className="text-sm text-atenuado">
          Puedes inscribir a tus hijos o a tu pareja sin que ellos creen cuenta.{" "}
          <Link href="/portal/acompanantes" className="underline underline-offset-2 text-naranja-suave">
            Añádelos a tu lista
          </Link>{" "}
          y aparecerán aquí en cada carrera.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <EtiquetaMono>¿Inscribes a alguien más?</EtiquetaMono>

      <input type="hidden" name="acompanantes" value={JSON.stringify(seleccion)} />

      <div className="flex flex-col gap-2.5">
        {acompanantes.map((a) => {
          const sel = elegido(a.id);
          const sinCupo = !a.categorias.some((c) => c.elegible);
          const bloqueado = a.yaInscrito || sinCupo;

          return (
            <div
              key={a.id}
              className={`rounded-xl border px-5 py-4 transition-colors ${
                sel ? "border-naranja/45 bg-naranja/6" : "border-linea bg-superficie"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={!!sel}
                  disabled={bloqueado}
                  onChange={() => alternar(a)}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-naranja)] disabled:opacity-40"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-texto">{a.nombre}</span>
                  <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
                    {[
                      a.parentesco,
                      a.edad !== null && `${a.edad} años el día de la carrera`,
                      a.yaInscrito && "Ya está inscrito",
                      !a.yaInscrito && sinCupo && "Sin categoría disponible por edad o cupo",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>

              {sel && (
                <div className="mt-4 grid gap-3 border-t pt-4 border-linea sm:grid-cols-2">
                  <Select
                    label={`Distancia de ${a.nombre.split(" ")[0]}`}
                    name={`no-enviar-categoria-${a.id}`}
                    required
                    value={sel.categoriaId}
                    onChange={(v) => actualizar(a.id, { categoriaId: v })}
                    placeholder="Elige la distancia…"
                    opciones={a.categorias.map((c) => ({
                      valor: c.id,
                      etiqueta: c.elegible
                        ? `${c.nombre}${c.distancia_km !== null ? ` · ${formatDistancia(c.distancia_km)}` : ""} — ${formatPrecio(Number(c.precio_vigente), moneda)}`
                        : `${c.nombre} — ${c.motivo}`,
                    }))}
                  />
                  <Select
                    label="Talla"
                    name={`no-enviar-talla-${a.id}`}
                    value={sel.talla ?? ""}
                    onChange={(v) => actualizar(a.id, { talla: v || null })}
                    placeholder="Sin talla"
                    opciones={tallas
                      .filter((t) => t.inventario_disponible === null || t.inventario_disponible > 0)
                      .map((t) => ({ valor: t.talla, etiqueta: t.talla }))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {seleccion.length > 0 && (
        <p className="tabular text-right font-mono text-xs uppercase tracking-etiqueta text-atenuado">
          {seleccion.length} {seleccion.length === 1 ? "acompañante" : "acompañantes"} ·{" "}
          <span className="font-bold text-texto">{formatPrecio(total, moneda)}</span> además de lo tuyo
        </p>
      )}
    </section>
  );
}
