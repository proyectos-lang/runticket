"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { formatPrecio, formatFechaHora } from "@/lib/format";
import { guardarPrecio, eliminarPrecio, type PrecioState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: PrecioState = { status: "idle" };

export type Tramo = {
  id: string;
  categoria_id: string;
  nombre: string;
  precio: number;
  fechaInicioLocal: string;
  fechaFinLocal: string;
  fecha_inicio: string;
  fecha_fin: string;
};

function FormularioTramo({
  eventoId,
  categorias,
  tramo,
  onCerrar,
}: {
  eventoId: string;
  categorias: { valor: string; etiqueta: string }[];
  tramo?: Tramo;
  onCerrar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarPrecio.bind(null, eventoId, tramo?.id ?? null),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Categoría"
          name="categoriaId"
          required
          defaultValue={tramo?.categoria_id}
          opciones={categorias}
          errors={state.errors?.categoriaId}
        />
        <Campo
          label="Nombre del tramo"
          name="nombre"
          required
          placeholder="Preventa"
          defaultValue={tramo?.nombre}
          errors={state.errors?.nombre}
        />
        <Campo
          label="Precio"
          name="precio"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={tramo?.precio ?? ""}
          errors={state.errors?.precio}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Desde"
          name="fechaInicio"
          type="datetime-local"
          required
          defaultValue={tramo?.fechaInicioLocal}
          errors={state.errors?.fechaInicio}
        />
        <Campo
          label="Hasta"
          name="fechaFin"
          type="datetime-local"
          required
          defaultValue={tramo?.fechaFinLocal}
          errors={state.errors?.fechaFin}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="text-sm text-emerald-400">Tramo guardado.</p>
      )}

      <div className="flex gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : tramo ? "Guardar cambios" : "Añadir tramo"}
        </Boton>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full border px-5 py-2.5 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            {state.status === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        )}
      </div>
    </form>
  );
}

export function GestorPrecios({
  eventoId,
  moneda,
  zona,
  categorias,
  tramos,
}: {
  eventoId: string;
  moneda: string;
  zona: string;
  categorias: { valor: string; etiqueta: string }[];
  tramos: Tramo[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const ahora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {tramos.map((t) =>
          editando === t.id ? (
            <div
              key={t.id}
              className="rounded-2xl border p-5 border-linea-fuerte bg-superficie"
            >
              <FormularioTramo
                eventoId={eventoId}
                categorias={categorias}
                tramo={t}
                onCerrar={() => setEditando(null)}
              />
            </div>
          ) : (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 border-linea bg-superficie"
            >
              <div>
                <p className="font-medium text-texto">
                  {t.nombre}
                  <span className="ml-2 text-sm font-normal text-atenuado">
                    {categorias.find((c) => c.valor === t.categoria_id)?.etiqueta}
                  </span>
                  {t.fecha_inicio <= ahora && ahora < t.fecha_fin && (
                    <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-950 text-emerald-400">
                      Vigente ahora
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-atenuado">
                  {formatPrecio(Number(t.precio), moneda)} · del{" "}
                  {formatFechaHora(t.fecha_inicio, zona)} al {formatFechaHora(t.fecha_fin, zona)}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEditando(t.id);
                  }}
                  className="underline-offset-2 hover:underline text-atenuado"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    if (!confirm(`¿Eliminar el tramo ${t.nombre}?`)) return;
                    setError(null);
                    startTransition(async () => {
                      try {
                        await eliminarPrecio(eventoId, t.id);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
                      }
                    });
                  }}
                  className="underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        )}

        {tramos.length === 0 && (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Sin tramos. Fuera de las fechas que definas aquí se cobra el precio base de cada
            categoría.
          </p>
        )}
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-4 text-base font-semibold text-texto">Añadir tramo</h3>
        <FormularioTramo eventoId={eventoId} categorias={categorias} />
      </section>
    </div>
  );
}
