import { DISCIPLINAS } from "@/lib/disciplinas";
import { primero, uuidOpcional, unoDe, conFormato } from "@/lib/parametros";

/**
 * Los filtros del catálogo (`/eventos?…`), validados.
 *
 * Vive aparte porque lo usan dos sitios: la página, para consultar, y el proxy,
 * para **redirigir a la URL limpia antes de renderizar** cuando llega algo que
 * no es un filtro (un parámetro repetido, un valor inventado). La auditoría de
 * seguridad metió `orden=type C:\Windows\win.ini` y lo encontró en la
 * respuesta; con la redirección en el proxy, esa petición nunca llega a pintar
 * una página.
 */
export type Busqueda = {
  q?: string;
  ciudad?: string;
  mes?: string;
  distancia?: string;
  disciplina?: string;
  departamento?: string;
  precioMax?: string;
  orden?: string;
  vista?: string;
};

type Crudos = Record<string, string | string[] | undefined>;

export function limpiarBusqueda(crudo: Crudos): Busqueda {
  return {
    q: primero(crudo.q, 80),
    ciudad: uuidOpcional(crudo.ciudad),
    mes: conFormato(crudo.mes, /^\d{4}-(0[1-9]|1[0-2])$/),
    distancia: conFormato(crudo.distancia, /^[0-9]{1,3}(-[0-9]{0,3})?$/, 10),
    disciplina: unoDe(crudo.disciplina, DISCIPLINAS),
    departamento: uuidOpcional(crudo.departamento),
    precioMax: conFormato(crudo.precioMax, /^[0-9]{1,6}$/),
    orden: unoDe(crudo.orden, ["precio"] as const),
    vista: unoDe(crudo.vista, ["rejilla"] as const),
  };
}

/**
 * La consulta canónica para unos parámetros recibidos, o `null` si ya era
 * canónica. `_rsc` es el marcador de las peticiones internas de Next y no
 * cuenta como parámetro.
 */
export function consultaCanonica(params: URLSearchParams): string | null {
  const crudos: Crudos = {};
  for (const [k, v] of params) {
    if (k === "_rsc") continue;
    if (!(k in crudos)) crudos[k] = v; // el primero manda
  }
  const limpios = new URLSearchParams(
    Object.entries(limpiarBusqueda(crudos)).filter(([, v]) => v) as [string, string][]
  );
  const recibidos = new URLSearchParams(Object.entries(crudos) as [string, string][]);
  // Un parámetro repetido también se considera sucio. El orden, no: un enlace
  // con los mismos filtros en otro orden no merece una redirección.
  const repetidos = [...params.keys()].length !== new Set([...params.keys()]).size;
  limpios.sort();
  recibidos.sort();
  if (!repetidos && limpios.toString() === recibidos.toString()) return null;
  return limpios.toString();
}
