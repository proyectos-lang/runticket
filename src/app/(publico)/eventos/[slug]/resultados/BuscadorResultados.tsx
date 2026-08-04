"use client";

import { useMemo, useState } from "react";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { formatTiempo } from "@/lib/format";
import type { ResultadoPublico } from "@/lib/supabase/database.types";

export function BuscadorResultados({
  resultados,
  categorias,
}: {
  resultados: ResultadoPublico[];
  categorias: string[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");

  // Filtrado en cliente: la lista ya vino completa y así el corredor se
  // encuentra al instante mientras teclea, sin ida y vuelta al servidor.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return resultados.filter(
      (r) =>
        (!categoria || r.categoria === categoria) &&
        (!q || r.nombre_completo.toLowerCase().includes(q) || String(r.numero_dorsal ?? "").includes(q))
    );
  }, [resultados, busqueda, categoria]);

  // El ganador se resalta en cian: es un dato destacado, no una acción.
  const mejorTiempo = filtrados.length ? filtrados[0].posicion_general : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busca tu nombre o tu dorsal"
          className={`flex-1 ${CLASE_CAMPO}`}
          aria-label="Buscar en los resultados"
        />
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className={CLASE_CAMPO}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="tabular font-mono text-[0.6875rem] uppercase tracking-etiqueta text-mudo">
        {filtrados.length} {filtrados.length === 1 ? "resultado" : "resultados"}
      </p>

      {filtrados.length ? (
        <div className="overflow-x-auto rounded-xl border border-linea">
          <table className="w-full min-w-160 text-left">
            <thead className="border-b border-linea bg-superficie">
              <tr className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
                <th className="w-18 px-4.5 py-3.5">Pos.</th>
                <th className="w-22 px-4.5 py-3.5">Dorsal</th>
                <th className="px-4.5 py-3.5">Corredor</th>
                {/* Categoría y sexo se ocultan en pantallas estrechas: en móvil
                    lo que se busca es el propio nombre y el tiempo. */}
                <th className="hidden w-38 px-4.5 py-3.5 sm:table-cell">Categoría</th>
                <th className="hidden w-22 px-4.5 py-3.5 sm:table-cell">Pos. cat.</th>
                <th className="w-28 px-4.5 py-3.5 text-right">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr
                  key={`${r.numero_dorsal}-${r.nombre_completo}`}
                  className="border-b border-texto/6 last:border-0"
                >
                  <td className="tabular px-4.5 py-3.5 font-mono text-[0.8125rem] font-bold text-texto">
                    {r.posicion_general ?? "—"}
                  </td>
                  <td className="tabular px-4.5 py-3.5 font-mono text-[0.8125rem] text-texto/60">
                    {r.numero_dorsal ?? "—"}
                  </td>
                  <td className="px-4.5 py-3.5 text-[0.8125rem] font-semibold text-texto">
                    {r.nombre_completo}
                    <span className="block font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45 sm:hidden">
                      {r.categoria}
                    </span>
                  </td>
                  <td className="hidden px-4.5 py-3.5 font-mono text-[0.8125rem] text-texto/70 sm:table-cell">
                    {r.categoria}
                  </td>
                  <td className="tabular hidden px-4.5 py-3.5 font-mono text-[0.8125rem] text-texto/60 sm:table-cell">
                    {r.posicion_categoria ?? "—"}
                  </td>
                  <td
                    className={`tabular px-4.5 py-3.5 text-right font-mono text-[0.8125rem] font-bold ${
                      r.posicion_general === mejorTiempo && r.posicion_general === 1
                        ? "text-cian"
                        : "text-texto"
                    }`}
                  >
                    {formatTiempo(r.tiempo_oficial)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-linea-fuerte px-6 py-10 text-center text-sm text-atenuado">
          Sin resultados para «{busqueda || categoria}».
        </p>
      )}
    </div>
  );
}
