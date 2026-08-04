"use client";

import { useState, useTransition } from "react";
import { MedidorOcupacion } from "@/components/panel/Medidores";
import { Aviso } from "@/components/ui/Aviso";
import { formatPrecio, formatDistancia } from "@/lib/format";
import { eliminarCategoria } from "../actions";
import { CategoriaForm, type ValoresCategoria } from "./CategoriaForm";

export function ListaCategorias({
  eventoId,
  moneda,
  categorias,
}: {
  eventoId: string;
  moneda: string;
  categorias: (ValoresCategoria & { inscritos: number })[];
}) {
  // Las que tienen gente dentro condicionan lo que se puede editar.
  const conInscritos = categorias.filter((c) => c.inscritos > 0);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      {categorias.map((c) =>
        editando === c.id ? (
          <div
            key={c.id}
            className="rounded-2xl border p-5 border-linea-fuerte bg-superficie"
          >
            <CategoriaForm eventoId={eventoId} categoria={c} onListo={() => setEditando(null)} />
          </div>
        ) : (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 border-linea bg-superficie"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="flex flex-wrap items-baseline gap-2 font-semibold text-texto">
                {c.nombre}
                {c.distancia_km !== null && (
                  <span className="tabular font-mono text-xs font-semibold text-cian">
                    {formatDistancia(c.distancia_km)}
                  </span>
                )}
                <span className="tabular font-mono text-[0.78125rem] font-bold text-texto">
                  {formatPrecio(Number(c.precio_base), moneda)}
                </span>
              </p>
              <p className="tabular font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
                {[
                  // El desnivel se muestra aquí y no junto a la distancia para no
                  // competir con el precio: es un dato de consulta, no de decisión.
                  typeof c.desnivel_m === "number" && `+${c.desnivel_m} m`,
                  c.hora_salida && `Salida ${c.hora_salida.slice(0, 5)}`,
                  (c.edad_minima || c.edad_maxima) &&
                    `Edad ${c.edad_minima ?? "?"}–${c.edad_maxima ?? "?"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {/* Mismos umbrales que inventario y métricas: naranja a partir del
                  80 %, ámbar al 90 y rojo al llenarse. */}
              <div className="max-w-64">
                <MedidorOcupacion ocupado={c.inscritos} total={c.cupo_maximo} grosor={6} />
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEditando(c.id);
                }}
                className="underline-offset-2 hover:underline text-atenuado"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={pendiente || c.inscritos > 0}
                title={c.inscritos > 0 ? "Tiene inscritos: no se puede eliminar" : undefined}
                onClick={() => {
                  if (!confirm(`¿Eliminar la categoría ${c.nombre}?`)) return;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await eliminarCategoria(eventoId, c.id);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
                    }
                  });
                }}
                className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 text-red-400"
              >
                Eliminar
              </button>
            </div>
          </div>
        )
      )}

      {categorias.length === 0 && (
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
          Sin categorías todavía. Añade al menos una para poder publicar el evento.
        </p>
      )}
      {conInscritos.length > 0 && (
        <Aviso tono="ambar" titulo="Dos límites que ya no puedes saltarte">
          {/* Se nombran las categorías y sus cifras reales: «completa la
              configuración» obligaría al organizador a averiguarlo por su cuenta. */}
          No puedes bajar el cupo de{" "}
          {conInscritos.map((c) => `${c.nombre} por debajo de ${c.inscritos}`).join(", ni el de ")}
          : es la gente que ya se inscribió. Tampoco puedes borrar una categoría con inscritos —
          para cerrarla, baja su cupo al número actual.
        </Aviso>
      )}

    </div>
  );
}
