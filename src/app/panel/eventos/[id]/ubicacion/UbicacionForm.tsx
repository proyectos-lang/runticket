"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { SelectorCoordenadas } from "@/components/mapa/SelectorCoordenadas";
import { actualizarUbicacion, type EventoState } from "../actions";
import { Boton } from "@/components/ui/Boton";

const initialState: EventoState = { status: "idle" };

export function UbicacionForm({
  eventoId,
  direccion,
  lat,
  lng,
  puntoEncuentroLat,
  puntoEncuentroLng,
  ruta,
}: {
  eventoId: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  puntoEncuentroLat: number | null;
  puntoEncuentroLng: number | null;
  ruta: [number, number][];
}) {
  const [state, formAction, pending] = useActionState(
    actualizarUbicacion.bind(null, eventoId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Campo
        label="Dirección"
        name="direccion"
        defaultValue={direccion ?? ""}
        placeholder="Parque Central, Tegucigalpa"
        ayuda="Se muestra en la página pública y en el recordatorio de calendario."
        errors={state.errors?.direccion}
      />

      {/* El selector queda fuera de lo que depende de `state`: si se remontara en
          cada guardado, el mapa perdería la posición y el zoom. */}
      <SelectorCoordenadas
        latInicial={lat}
        lngInicial={lng}
        puntoEncuentroLatInicial={puntoEncuentroLat}
        puntoEncuentroLngInicial={puntoEncuentroLng}
        ruta={ruta}
      />

      {(state.errors?.lat || state.errors?.lng) && (
        <p className="text-sm text-red-400">
          {state.errors.lat?.[0] ?? state.errors.lng?.[0]}
        </p>
      )}
      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "guardado" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-emerald-950 text-emerald-400">
          Ubicación guardada.
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar ubicación"}
      </Boton>
    </form>
  );
}
