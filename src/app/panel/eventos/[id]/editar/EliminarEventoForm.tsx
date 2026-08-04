"use client";

import { useActionState, useState } from "react";
import { eliminarEvento, type BorradoState } from "../actions";

const initialState: BorradoState = { status: "idle" };

export function EliminarEventoForm({
  eventoId,
  nombre,
  bloqueado,
  motivo,
}: {
  eventoId: string;
  nombre: string;
  bloqueado: boolean;
  motivo?: string;
}) {
  const [state, formAction, pending] = useActionState(
    eliminarEvento.bind(null, eventoId),
    initialState
  );
  const [confirmacion, setConfirmacion] = useState("");

  if (bloqueado) {
    return (
      <p className="text-sm text-atenuado">
        {motivo ?? "Este evento no se puede eliminar."}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm text-atenuado">
        Eliminar el evento borra también sus categorías, tallas e imágenes. Es irreversible.
        Escribe <strong className="text-texto">{nombre}</strong> para confirmar.
      </p>
      <input
        name="confirmacion"
        value={confirmacion}
        onChange={(e) => setConfirmacion(e.target.value)}
        placeholder="Nombre del evento"
        aria-label="Confirmación por nombre"
        className="max-w-sm rounded-lg border px-3 py-2 text-sm border-linea-fuerte bg-superficie text-texto"
      />
      <button
        type="submit"
        disabled={pending || confirmacion !== nombre}
        className="self-start rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Eliminando…" : "Eliminar evento"}
      </button>
      {state.status === "error" && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
    </form>
  );
}
