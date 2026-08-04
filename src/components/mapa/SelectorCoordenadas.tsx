"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Punto, SelectorCoordenadasProps } from "./SelectorCoordenadasInner";

// Declarado a nivel de módulo a propósito: dentro del componente, cada render de
// `useActionState` desmontaría el mapa y se perdería el zoom.
const Selector = dynamic(() => import("./SelectorCoordenadasInner"), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse rounded-2xl bg-superficie-2" />,
});

/**
 * Los cuatro campos del formulario se renderizan **aquí**, fuera del mapa.
 *
 * El mapa se carga en diferido (`ssr: false`, Leaflet necesita `window`), así que
 * hasta que llegaba su código el formulario no tenía `lat`, `lng` ni el punto de
 * encuentro. Quien guardaba antes de ese momento enviaba los cuatro campos
 * ausentes y `actualizarUbicacion` escribía `null` sobre las coordenadas ya
 * registradas, borrando la ubicación de la carrera sin avisar.
 */
export function SelectorCoordenadas({
  latInicial,
  lngInicial,
  puntoEncuentroLatInicial,
  puntoEncuentroLngInicial,
  ruta,
}: SelectorCoordenadasProps) {
  const [ubicacion, setUbicacion] = useState<Punto>(
    latInicial !== null && lngInicial !== null ? { lat: latInicial, lng: lngInicial } : null
  );
  const [encuentro, setEncuentro] = useState<Punto>(
    puntoEncuentroLatInicial !== null && puntoEncuentroLngInicial !== null
      ? { lat: puntoEncuentroLatInicial, lng: puntoEncuentroLngInicial }
      : null
  );

  return (
    <>
      <input type="hidden" name="lat" value={ubicacion?.lat ?? ""} />
      <input type="hidden" name="lng" value={ubicacion?.lng ?? ""} />
      <input type="hidden" name="puntoEncuentroLat" value={encuentro?.lat ?? ""} />
      <input type="hidden" name="puntoEncuentroLng" value={encuentro?.lng ?? ""} />

      <Selector
        ubicacion={ubicacion}
        encuentro={encuentro}
        onUbicacion={setUbicacion}
        onEncuentro={setEncuentro}
        ruta={ruta}
      />
    </>
  );
}
