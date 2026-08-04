import L from "leaflet";

/**
 * Los iconos por defecto de Leaflet apuntan a imágenes que el bundler no resuelve,
 * así que se dibujan con CSS en un DivIcon.
 */
export function marcador(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:1rem;height:1rem;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Se reexportan con el nombre que ya usaban las pantallas para no tocarlas.
export { COLOR_SALIDA_META as COLOR_UBICACION, COLOR_ENCUENTRO as COLOR_PUNTO_ENCUENTRO } from "./tema";

/** Centro por defecto cuando el evento aún no tiene coordenadas. */
export const CENTRO_HONDURAS: [number, number] = [14.0723, -87.1921];
