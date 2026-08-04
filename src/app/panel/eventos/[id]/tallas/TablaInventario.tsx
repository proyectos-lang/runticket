"use client";

import { useState, useTransition } from "react";
import { ajustarInventario, eliminarTalla } from "../actions";
import { MedidorOcupacion, nivelDeOcupacion } from "@/components/panel/Medidores";

export type FilaTalla = {
  id: string;
  talla: string;
  inventario_total: number | null;
  inventario_disponible: number | null;
  comprometidas: number;
};

// Los umbrales viven en `panel/Medidores`: los comparten el inventario, el
// resumen, las métricas y las categorías, y tener dos definiciones hacía que la
// misma talla saliera «por agotarse» en una pantalla y normal en otra.

export function TablaInventario({ eventoId, filas }: { eventoId: string; filas: FilaTalla[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  if (!filas.length) {
    return (
      <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
        Sin tallas configuradas. Si el evento entrega prendas, añádelas para poder controlar el
        inventario.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-linea">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
            <tr>
              <th className="px-4 py-3">Talla</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Comprometidas</th>
              <th className="px-4 py-3">Disponibles</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {filas.map((f) => {
              const ilimitada = f.inventario_total === null;
              const disponibles = f.inventario_disponible ?? 0;
              const agotada = !ilimitada && disponibles <= 0;
              const ocupacion = ilimitada
                ? 0
                : Math.round((f.comprometidas / (f.inventario_total || 1)) * 100);
              const nivel = ilimitada ? "normal" : nivelDeOcupacion(ocupacion);
              const porAgotarse = !ilimitada && !agotada && nivel === "se_agota";
              // Los tres escritores del disponible trabajan por delta; si algo se
              // descuadró, conviene verlo en vez de que pase inadvertido.
              const descuadrada = !ilimitada && disponibles + f.comprometidas !== f.inventario_total;

              return (
                <tr key={f.id} className="bg-superficie/40">
                  <td className="px-4 py-3 font-medium text-texto">{f.talla}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={f.comprometidas}
                      defaultValue={f.inventario_total ?? ""}
                      placeholder="Sin límite"
                      disabled={pendiente}
                      aria-label={`Inventario total de la talla ${f.talla}`}
                      onBlur={(e) => {
                        const valor = e.target.value === "" ? null : Number(e.target.value);
                        if (valor === f.inventario_total) return;
                        ejecutar(() => ajustarInventario(eventoId, f.id, valor));
                      }}
                      className="w-28 rounded-lg border px-2 py-1 text-sm disabled:opacity-60 border-linea-fuerte bg-superficie text-texto"
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-atenuado">
                    {f.comprometidas}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`tabular-nums ${
                        agotada
                          ? "font-bold text-rojo"
                          : porAgotarse
                            ? "font-bold text-ambar"
                            : "text-atenuado"
                      }`}
                    >
                      {ilimitada ? "Sin límite" : disponibles}
                    </span>
                    {agotada && <p className="text-xs text-rojo">Agotada</p>}
                    {porAgotarse && <p className="text-xs text-ambar">Se agota</p>}
                    {!ilimitada && (
                      <div className="mt-1.5 max-w-32">
                        <MedidorOcupacion
                          ocupado={f.comprometidas}
                          total={f.inventario_total}
                          grosor={5}
                        />
                      </div>
                    )}
                    {descuadrada && (
                      <button
                        type="button"
                        onClick={() => ejecutar(() => ajustarInventario(eventoId, f.id, f.inventario_total))}
                        className="text-xs underline underline-offset-2 text-amber-400"
                      >
                        Descuadre: reconciliar
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={pendiente || f.comprometidas > 0}
                      title={
                        f.comprometidas > 0
                          ? "Hay inscritos con esta talla: no se puede eliminar"
                          : undefined
                      }
                      onClick={() => {
                        if (confirm(`¿Eliminar la talla ${f.talla}?`)) {
                          ejecutar(() => eliminarTalla(eventoId, f.id));
                        }
                      }}
                      className="text-sm underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 text-red-400"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-atenuado">
        Deja el total vacío para inventario ilimitado. No puedes fijar un total menor que las
        prendas ya comprometidas.
      </p>
    </div>
  );
}
