"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TILES_OSCUROS, COLOR_RUTA } from "@/components/mapa/tema";
import { marcador, COLOR_UBICACION, COLOR_PUNTO_ENCUENTRO } from "@/components/mapa/iconos";
import { puntosDeGpx } from "@/lib/mapas/gpx";

export type MapaEventoProps = {
  lat: number;
  lng: number;
  titulo: string;
  puntoEncuentro?: { lat: number; lng: number } | null;
  rutaGpxUrl?: string | null;
};

export default function MapaEventoInner({
  lat,
  lng,
  titulo,
  puntoEncuentro,
  rutaGpxUrl,
}: MapaEventoProps) {
  const [ruta, setRuta] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!rutaGpxUrl) return;
    let cancelado = false;
    fetch(rutaGpxUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((xml) => !cancelado && setRuta(puntosDeGpx(xml)))
      .catch(() => {
        // Sin ruta dibujada: el mapa sigue siendo útil con los marcadores.
      });
    return () => {
      cancelado = true;
    };
  }, [rutaGpxUrl]);

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-2xl"
      style={{ zIndex: 0 }}
    >
      <TileLayer {...TILES_OSCUROS}
      />
      <Marker position={[lat, lng]} icon={marcador(COLOR_UBICACION)}>
        <Popup>{titulo}</Popup>
      </Marker>
      {puntoEncuentro && (
        <Marker position={[puntoEncuentro.lat, puntoEncuentro.lng]} icon={marcador(COLOR_PUNTO_ENCUENTRO)}>
          <Popup>Punto de encuentro</Popup>
        </Marker>
      )}
      {ruta.length > 1 && <Polyline positions={ruta} pathOptions={{ color: COLOR_RUTA, weight: 4 }} />}
    </MapContainer>
  );
}
