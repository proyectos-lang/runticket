/**
 * A qué bandeja pertenece cada aviso.
 *
 * `notificaciones` es una tabla **por usuario**, y una misma persona puede ser
 * corredora y a la vez administrar una empresa —de hecho es lo normal en un
 * organizador pequeño—. Sin esta separación, al entrar al panel vería mezclados
 * sus avisos de corredor («se liberó un cupo») con los de su empresa («nueva
 * inscripción»), y en el portal le pasaría lo mismo al revés.
 *
 * Es la **única** definición del reparto. La usan las dos bandejas y los dos
 * contadores del menú; si cada uno tuviera la suya, un tipo nuevo aparecería en
 * la lista de una pantalla y no en el contador que la anuncia.
 */
export const TIPOS_DE_PANEL = ["inscripcion_nueva"] as const;

/** Lo que espera PostgREST en un filtro `not.in`: `(a,b,c)`. */
export const TIPOS_DE_PANEL_SQL = `(${TIPOS_DE_PANEL.join(",")})`;
