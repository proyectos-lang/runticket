"use client";

import { useActionState } from "react";
import { cambiarTalla, type TallaState } from "./actions";

const initialState: TallaState = { status: "idle" };

export function CambiarTalla({
  inscripcionId,
  tallaActual,
  tallas,
}: {
  inscripcionId: string;
  tallaActual: string | null;
  tallas: { talla: string; inventario_disponible: number | null }[];
}) {
  const [state, formAction, pending] = useActionState(
    cambiarTalla.bind(null, inscripcionId),
    initialState
  );

  // La talla que ya tiene reservada sigue siendo elegible aunque su inventario
  // marque cero: esa prenda está apartada para este corredor.
  const disponibles = tallas.filter(
    (t) => t.talla === tallaActual || t.inventario_disponible === null || t.inventario_disponible > 0
  );

  if (!tallas.length) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="talla" className="text-xs uppercase tracking-wide text-atenuado">
          Talla de camiseta
        </label>
        <select
          id="talla"
          name="talla"
          defaultValue={tallaActual ?? ""}
          className="rounded-lg border px-3 py-2 text-sm border-linea-fuerte bg-superficie text-texto"
        >
          <option value="">Sin talla</option>
          {disponibles.map((t) => (
            <option key={t.talla} value={t.talla}>
              {t.talla}
              {t.inventario_disponible !== null && t.talla !== tallaActual
                ? ` (${t.inventario_disponible} disponibles)`
                : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 border-linea-fuerte text-atenuado hover:bg-superficie-2"
      >
        {pending ? "Guardando…" : "Cambiar talla"}
      </button>

      {state.status === "error" && (
        <p className="w-full text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="w-full text-sm text-emerald-400">Talla actualizada.</p>
      )}
    </form>
  );
}
