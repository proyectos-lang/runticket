"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TILES_OSCUROS, COLOR_RUTA } from "@/components/mapa/tema";
import { marcador, COLOR_UBICACION, COLOR_PUNTO_ENCUENTRO, CENTRO_HONDURAS } from "./iconos";
import { Pildora } from "@/components/ui/Pildora";

export type Punto = { lat: number; lng: number } | null;

export type SelectorCoordenadasProps = {
  latInicial: number | null;
  lngInicial: number | null;
  puntoEncuentroLatInicial: number | null;
  puntoEncuentroLngInicial: number | null;
  /** Trazado ya guardado, para verlo mientras se colocan los marcadores. */
  ruta?: [number, number][];
};

/**
 * El estado y los campos del formulario viven en el envoltorio, no aquí: este
 * componente se carga en diferido y, hasta que llegaba su código, `lat`, `lng` y
 * el punto de encuentro no existían en el formulario, así que guardar antes de
 * tiempo borraba las coordenadas ya registradas.
 */
export type SelectorCoordenadasInnerProps = {
  ubicacion: Punto;
  encuentro: Punto;
  onUbicacion: (p: Punto) => void;
  onEncuentro: (p: Punto) => void;
  ruta?: [number, number][];
};

type Objetivo = "ubicacion" | "encuentro";

/** Traduce los clics del mapa en coordenadas para el marcador que esté en foco. */
function CapturadorDeClic({ alHacerClic }: { alHacerClic: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => alHacerClic(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function SelectorCoordenadasInner({
  ubicacion,
  encuentro,
  onUbicacion: setUbicacion,
  onEncuentro: setEncuentro,
  ruta = [],
}: SelectorCoordenadasInnerProps) {
  const [objetivo, setObjetivo] = useState<Objetivo>("ubicacion");

  const centro: [number, number] = ubicacion
    ? [ubicacion.lat, ubicacion.lng]
    : encuentro
      ? [encuentro.lat, encuentro.lng]
      : CENTRO_HONDURAS;

  function colocar(lat: number, lng: number) {
    const redondeado = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    if (objetivo === "ubicacion") setUbicacion(redondeado);
    else setEncuentro(redondeado);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-atenuado">Colocando:</span>
        <Pildora onClick={() => setObjetivo("ubicacion")} activa={objetivo === "ubicacion"}>
          <span className="size-2.5 rounded-full" style={{ background: COLOR_UBICACION }} />
          Salida y meta
        </Pildora>
        <Pildora onClick={() => setObjetivo("encuentro")} activa={objetivo === "encuentro"}>
          <span className="size-2.5 rounded-full" style={{ background: COLOR_PUNTO_ENCUENTRO }} />
          Punto de encuentro
        </Pildora>
        {navigator.geolocation && (
          <button
            type="button"
            onClick={() =>
              navigator.geolocation.getCurrentPosition((p) =>
                colocar(p.coords.latitude, p.coords.longitude)
              )
            }
            className="text-sm underline-offset-2 hover:underline text-atenuado"
          >
            Usar mi ubicación
          </button>
        )}
      </div>

      <p className="text-xs text-atenuado">
        Toca el mapa para colocar el marcador seleccionado, o arrástralo. También puedes pegar las
        coordenadas si las copiaste de Google Maps.
      </p>

      <MapContainer center={centro} zoom={ubicacion ? 15 : 12} className="h-96 w-full rounded-2xl" style={{ zIndex: 0 }}>
        <TileLayer {...TILES_OSCUROS}
        />
        <CapturadorDeClic alHacerClic={colocar} />
        {ubicacion && (
          <Marker
            position={[ubicacion.lat, ubicacion.lng]}
            icon={marcador(COLOR_UBICACION)}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                setUbicacion({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
              },
            }}
          />
        )}
        {encuentro && (
          <Marker
            position={[encuentro.lat, encuentro.lng]}
            icon={marcador(COLOR_PUNTO_ENCUENTRO)}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                setEncuentro({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
              },
            }}
          />
        )}
        {ruta.length > 1 && <Polyline positions={ruta} pathOptions={{ color: COLOR_RUTA, weight: 4 }} />}
      </MapContainer>

      <div className="grid gap-3 sm:grid-cols-2">
        <ParCoordenadas titulo="Salida y meta" punto={ubicacion} alCambiar={setUbicacion} />
        <ParCoordenadas titulo="Punto de encuentro" punto={encuentro} alCambiar={setEncuentro} />
      </div>
    </div>
  );
}

/**
 * Campos numéricos sincronizados con el mapa. No llevan `name`: quien viaja en
 * el formulario es el campo oculto del envoltorio, que existe desde el primer
 * render aunque el mapa todavía no haya cargado.
 */
function ParCoordenadas({
  titulo,
  punto,
  alCambiar,
}: {
  titulo: string;
  punto: Punto;
  alCambiar: (p: Punto) => void;
}) {
  const actualizar = (clave: "lat" | "lng", valor: string) => {
    if (valor === "") {
      alCambiar(null);
      return;
    }
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    alCambiar({ lat: punto?.lat ?? 0, lng: punto?.lng ?? 0, [clave]: n });
  };

  const clase =
    "w-full rounded-lg border px-3 py-2 text-sm border-linea-fuerte bg-superficie text-texto";

  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border p-4 border-linea">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-atenuado">
        {titulo}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={punto?.lat ?? ""}
          onChange={(e) => actualizar("lat", e.target.value)}
          placeholder="Latitud"
          aria-label={`Latitud de ${titulo}`}
          className={clase}
        />
        <input
          value={punto?.lng ?? ""}
          onChange={(e) => actualizar("lng", e.target.value)}
          placeholder="Longitud"
          aria-label={`Longitud de ${titulo}`}
          className={clase}
        />
      </div>
      {punto && (
        <button
          type="button"
          onClick={() => alCambiar(null)}
          className="self-start text-xs underline-offset-2 hover:underline text-atenuado"
        >
          Quitar marcador
        </button>
      )}
    </fieldset>
  );
}
