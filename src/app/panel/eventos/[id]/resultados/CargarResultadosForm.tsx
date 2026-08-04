"use client";

import { useActionState } from "react";
import { cargarResultadosCsv, type ResultadosState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: ResultadosState = { status: "idle" };

export function CargarResultadosForm({ eventoId }: { eventoId: string }) {
  const [state, formAction, pending] = useActionState(
    cargarResultadosCsv.bind(null, eventoId),
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border p-6 border-linea bg-superficie"
    >
      <h2 className="text-lg font-semibold text-texto">Cargar tiempos</h2>
      <p className="text-sm text-atenuado">
        CSV con dos columnas: <strong>dorsal</strong> y <strong>tiempo</strong>. Se aceptan{" "}
        <code className="rounded px-1 bg-superficie-2">01:23:45</code>,{" "}
        <code className="rounded px-1 bg-superficie-2">83:45</code> o segundos. Las posiciones
        se calculan automáticamente.
      </p>
      <input
        type="file"
        name="csv"
        accept=".csv,text/csv"
        required
        className="text-sm text-atenuado"
      />
      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Cargando…" : "Cargar CSV"}
      </Boton>

      {state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.resumen && (
        <div className="rounded-lg px-4 py-3 text-sm bg-superficie-2">
          <p className="font-medium text-texto">
            {state.resumen.procesados} resultados cargados
            {state.resumen.errores.length > 0 && ` · ${state.resumen.errores.length} con problemas`}
          </p>
          {state.resumen.errores.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-400">
              {state.resumen.errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
