"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { EtiquetaMono } from "@/components/ui/Datos";
import {
  guardarPuntoEntrega,
  eliminarPuntoEntrega,
  type PuntoEntregaState,
} from "./actions";

const initialState: PuntoEntregaState = { status: "idle" };

export type PuntoEntrega = {
  id: string;
  nombre: string;
  direccion: string | null;
  horario: string | null;
  lat: number | null;
  lng: number | null;
};

function Formulario({
  eventoId,
  punto,
  onCerrar,
}: {
  eventoId: string;
  punto?: PuntoEntrega;
  onCerrar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarPuntoEntrega.bind(null, eventoId, punto?.id ?? null),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Campo
        label="Nombre del punto"
        name="nombre"
        required
        placeholder="Tienda central"
        defaultValue={punto?.nombre}
        errors={state.errors?.nombre}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Dirección"
          name="direccion"
          placeholder="Bulevar Morazán, frente al parque"
          defaultValue={punto?.direccion ?? ""}
          errors={state.errors?.direccion}
        />
        <Campo
          label="Horario"
          name="horario"
          placeholder="Viernes 2–7 p. m. y sábado 9 a. m.–1 p. m."
          defaultValue={punto?.horario ?? ""}
          ayuda="Texto libre: se muestra tal cual al corredor."
          errors={state.errors?.horario}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Latitud"
          name="lat"
          placeholder="14.081"
          defaultValue={punto?.lat ?? ""}
          ayuda="Opcional. Cópialas de Google Maps."
          errors={state.errors?.lat}
        />
        <Campo
          label="Longitud"
          name="lng"
          placeholder="-87.207"
          defaultValue={punto?.lng ?? ""}
          errors={state.errors?.lng}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && <p className="text-sm text-emerald-400">Guardado.</p>}

      <div className="flex gap-2">
        <Boton variante={punto ? "secundaria" : "primaria"} type="submit" disabled={pending}>
          {pending ? "Guardando…" : punto ? "Guardar" : "Añadir punto de retiro"}
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

export function GestorPuntosEntrega({
  eventoId,
  puntos,
}: {
  eventoId: string;
  puntos: PuntoEntrega[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">{error}</p>
      )}

      {puntos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-linea-fuerte px-5 py-6 text-sm text-atenuado">
          Sin puntos de retiro. Si no añades ninguno, la pantalla de kit del corredor no le dirá
          dónde recogerlo.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {puntos.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-4 rounded-2xl border p-5 border-linea bg-superficie"
            >
              {editando === p.id ? (
                <Formulario eventoId={eventoId} punto={p} onCerrar={() => setEditando(null)} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="font-medium text-texto">{p.nombre}</p>
                    {p.direccion && <p className="text-sm text-atenuado">{p.direccion}</p>}
                    {p.horario && (
                      <p className="font-mono text-xs text-texto/45">{p.horario}</p>
                    )}
                    {p.lat !== null && p.lng !== null && (
                      <EtiquetaMono>
                        {p.lat}, {p.lng}
                      </EtiquetaMono>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditando(p.id);
                      }}
                      className="underline-offset-2 hover:underline text-atenuado"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => {
                        if (confirm(`¿Eliminar el punto «${p.nombre}»?`)) {
                          ejecutar(() => eliminarPuntoEntrega(eventoId, p.id));
                        }
                      }}
                      className="underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-dashed p-5 border-linea-fuerte">
        <Formulario eventoId={eventoId} />
      </div>
    </div>
  );
}
