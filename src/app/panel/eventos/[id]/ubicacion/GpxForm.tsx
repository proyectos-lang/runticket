"use client";

import { useActionState, useTransition } from "react";
import { guardarGpx, quitarGpx, type GpxState } from "../actions";

const initialState: GpxState = { status: "idle" };

export function GpxForm({ eventoId, rutaActual }: { eventoId: string; rutaActual: string | null }) {
  const [state, formAction, pending] = useActionState(guardarGpx.bind(null, eventoId), initialState);
  const [quitando, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {rutaActual ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-emerald-400">
            Ruta cargada y dibujada en el mapa.
          </span>
          <a
            href={rutaActual}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-atenuado"
          >
            Descargar
          </a>
          <button
            type="button"
            disabled={quitando}
            onClick={() => {
              if (confirm("¿Quitar el trazado de la ruta?")) {
                startTransition(() => quitarGpx(eventoId));
              }
            }}
            className="underline underline-offset-2 disabled:opacity-50 text-red-400"
          >
            Quitar
          </button>
        </div>
      ) : (
        <p className="text-sm text-atenuado">
          Sin trazado. Sube el GPX que exporta tu reloj o Strava y el recorrido se dibujará sobre el
          mapa de la página pública.
        </p>
      )}

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="gpx"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          required
          className="text-sm text-atenuado"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 border-linea-fuerte text-atenuado hover:bg-superficie-2"
        >
          {pending ? "Subiendo…" : rutaActual ? "Reemplazar ruta" : "Subir ruta"}
        </button>
      </form>

      {state.status === "error" && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="text-sm text-emerald-400">Ruta guardada.</p>
      )}
    </div>
  );
}
