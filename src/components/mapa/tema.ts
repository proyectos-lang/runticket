/**
 * Tema oscuro compartido por los dos mapas.
 *
 * Los tiles estándar de OpenStreetMap son claros y sobre el fondo del sistema
 * quedan como un rectángulo blanco en mitad de la pantalla. CARTO publica un
 * juego oscuro derivado de los mismos datos y de uso libre; su licencia exige
 * citar a CARTO **además** de a OpenStreetMap, así que la atribución lleva las
 * dos y no debe recortarse.
 */
export const TILES_OSCUROS = {
  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
} as const;

/**
 * La ruta es un dato, así que va en cian; salida y meta son la referencia de la
 * acción y van en naranja. El punto de encuentro es información secundaria: en
 * azul, que sobre el mapa oscuro se distingue del cian sin competir con él.
 */
export const COLOR_RUTA = "#3ad9ff";
export const COLOR_SALIDA_META = "#ff6a1a";
export const COLOR_ENCUENTRO = "#2f6bff";
