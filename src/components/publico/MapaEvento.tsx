"use client";

import dynamic from "next/dynamic";
import type { MapaEventoProps } from "./MapaEventoInner";

// Leaflet toca `window` al importarse, así que no puede renderizarse en el servidor.
const Mapa = dynamic(() => import("./MapaEventoInner"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-2xl bg-superficie-2" />
  ),
});

export function MapaEvento(props: MapaEventoProps) {
  return <Mapa {...props} />;
}
