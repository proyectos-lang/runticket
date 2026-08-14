"use client";

import { useActionState, useState } from "react";
import { Campo, Etiqueta } from "@/components/ui/Campo";
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

  /**
   * «Sin costo» como casilla y no como un cero que hay que adivinar.
   *
   * Al editar arranca marcada si el precio ya era cero, para que la casilla
   * describa lo que hay y no lo contradiga.
   */
  const [gratuita, setGratuita] = useState(categoria ? Number(categoria.precio_base) === 0 : false);

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
        {/*
          Con la casilla marcada el campo desaparece y su valor viaja en un
          `hidden`. No se deja visible y deshabilitado por dos motivos: un input
          `disabled` **no se envía**, así que `precioBase` llegaría vacío y la
          validación lo rechazaría; y un campo de precio a la vista en una
          categoría gratuita invita a teclear en él.
        */}
        {gratuita ? (
          <div className="flex flex-col gap-1.5">
            <Etiqueta>Precio</Etiqueta>
            <input type="hidden" name="precioBase" value="0" />
            <p className="flex h-11 items-center font-mono text-sm font-bold text-cian">Gratis</p>
          </div>
        ) : (
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
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-linea bg-superficie-2 px-4 py-3">
        <input
          type="checkbox"
          checked={gratuita}
          onChange={(e) => setGratuita(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-naranja)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-texto">Sin costo</span>
          <span className="text-xs text-atenuado">
            El corredor queda inscrito al instante, con su dorsal y su código QR, sin pasar por
            aprobación de pago.
          </span>
        </span>
      </label>

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
