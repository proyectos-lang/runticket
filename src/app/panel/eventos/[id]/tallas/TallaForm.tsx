"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { crearTalla, type TallaState } from "../actions";
import { Boton } from "@/components/ui/Boton";

const initialState: TallaState = { status: "idle" };

export function TallaForm({ eventoId }: { eventoId: string }) {
  const [state, formAction, pending] = useActionState(crearTalla.bind(null, eventoId), initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Campo
        label="Talla"
        name="talla"
        required
        placeholder="M"
        errors={state.errors?.talla}
        className="w-32"
      />
      <Campo
        label="Unidades"
        name="inventarioTotal"
        type="number"
        min="0"
        placeholder="Sin límite"
        errors={state.errors?.inventarioTotal}
        className="w-40"
      />
      <Boton variante="primaria" type="submit" disabled={pending}>
        {pending ? "Añadiendo…" : "Añadir talla"}
      </Boton>

      {state.status === "error" && state.message && (
        <p className="w-full text-sm text-red-400">{state.message}</p>
      )}
    </form>
  );
}
