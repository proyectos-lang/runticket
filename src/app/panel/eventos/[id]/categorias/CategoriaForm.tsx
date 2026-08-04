"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { guardarCategoria, type CategoriaState } from "../actions";
import { Boton } from "@/components/ui/Boton";

const initialState: CategoriaState = { status: "idle" };

export type ValoresCategoria = {
  id: string;
  nombre: string;
  distancia_km: number | null;
  desnivel_m: number | null;
  precio_base: number;
  cupo_maximo: number | null;
  edad_minima: number | null;
  edad_maxima: number | null;
  hora_salida: string | null;
};

export function CategoriaForm({
  eventoId,
  categoria,
  onListo,
}: {
  eventoId: string;
  /** Sin categoría el formulario crea; con ella, edita. */
  categoria?: ValoresCategoria;
  onListo?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarCategoria.bind(null, eventoId, categoria?.id ?? null),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo
          label="Nombre"
          name="nombre"
          required
          placeholder="10K"
          defaultValue={categoria?.nombre}
          errors={state.errors?.nombre}
        />
        <Campo
          label="Distancia (km)"
          name="distanciaKm"
          type="number"
          step="0.1"
          min="0"
          placeholder="10"
          defaultValue={categoria?.distancia_km ?? ""}
          ayuda="Alimenta el filtro público"
          errors={state.errors?.distanciaKm}
        />
        <Campo
          label="Desnivel (m)"
          name="desnivelM"
          type="number"
          min="0"
          placeholder="Llano"
          defaultValue={categoria?.desnivel_m ?? ""}
          ayuda="Acumulado positivo"
          errors={state.errors?.desnivelM}
        />
        <Campo
          label="Precio"
          name="precioBase"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={categoria?.precio_base ?? ""}
          errors={state.errors?.precioBase}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Campo
          label="Cupo máximo"
          name="cupoMaximo"
          type="number"
          min="0"
          placeholder="Sin límite"
          defaultValue={categoria?.cupo_maximo ?? ""}
          errors={state.errors?.cupoMaximo}
        />
        <Campo
          label="Edad mínima"
          name="edadMinima"
          type="number"
          min="0"
          max="120"
          defaultValue={categoria?.edad_minima ?? ""}
          errors={state.errors?.edadMinima}
        />
        <Campo
          label="Edad máxima"
          name="edadMaxima"
          type="number"
          min="0"
          max="120"
          defaultValue={categoria?.edad_maxima ?? ""}
          errors={state.errors?.edadMaxima}
        />
        <Campo
          label="Hora de salida"
          name="horaSalida"
          type="time"
          defaultValue={categoria?.hora_salida?.slice(0, 5) ?? ""}
          errors={state.errors?.horaSalida}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="text-sm text-emerald-400">
          {categoria ? "Cambios guardados." : "Categoría añadida."}
        </p>
      )}

      <div className="flex gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : categoria ? "Guardar cambios" : "Añadir categoría"}
        </Boton>
        {onListo && (
          <button
            type="button"
            onClick={onListo}
            className="rounded-full border px-5 py-2.5 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            {state.status === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        )}
      </div>
    </form>
  );
}
