/**
 * Extrae los puntos de un GPX (<trkpt lat="" lon="">) sin dependencias extra.
 * Solo funciona en el navegador: usa DOMParser.
 */
export function puntosDeGpx(xml: string): [number, number][] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return [];
  return [...doc.querySelectorAll("trkpt, rtept")]
    .map((p) => [Number(p.getAttribute("lat")), Number(p.getAttribute("lon"))] as [number, number])
    .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
}

/**
 * Validación de un GPX en el servidor. No se puede usar DOMParser (no existe en
 * Node), así que se comprueba la forma del documento con búsquedas de texto:
 * suficiente para descartar un archivo que no es una ruta.
 */
export function pareceGpxValido(contenido: string): boolean {
  if (!contenido.includes("<gpx")) return false;
  return contenido.includes("<trkpt") || contenido.includes("<rtept");
}

export const TAMANO_MAXIMO_GPX = 5 * 1024 * 1024;
