import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient, TAG_EVENTOS, tagEvento } from "@/lib/supabase/publico";
import type { Disciplina, EstadoEvento } from "@/lib/supabase/database.types";

/**
 * Estas consultas son **el catálogo público** y van todas cacheadas.
 *
 * Antes cada visita a la portada o a una ficha de carrera disparaba entre tres y
 * seis consultas a Supabase, y con `force-dynamic` en cada página no se
 * reaprovechaba ninguna: mil visitantes eran mil catálogos idénticos traídos mil
 * veces. Ahora se calcula una vez por ventana y se sirve desde caché.
 *
 * Van con `cacheTag` además de con vida limitada porque hay cambios que no
 * pueden esperar a que expire el plazo: publicar una carrera, cambiarle la fecha
 * o cerrarla tiene que verse ya. El panel invalida la etiqueta al guardar.
 *
 * **Ninguna puede leer cookies**: usan `createPublicClient()`, que consulta como
 * anónimo. Ver la nota de `lib/supabase/publico.ts`.
 */

export type EmpresaResumen = {
  id: string;
  nombreComercial: string;
  slug: string;
  logoUrl: string | null;
};

export type EventoPublico = {
  id: string;
  nombre: string;
  slug: string;
  fechaInicio: string;
  fechaLimiteInscripcion: string | null;
  direccion: string | null;
  imagenBannerUrl: string | null;
  moneda: string;
  estado: string;
  disciplina: Disciplina;
  departamentoId: string | null;
  empresa: EmpresaResumen | null;
  distancias: number[];
  precioDesde: number | null;
};

export type FiltrosEventos = {
  q?: string;
  ciudad?: string;
  mes?: string; // "YYYY-MM"
  distanciaMin?: number;
  distanciaMax?: number;
  empresaId?: string;
  disciplina?: Disciplina;
  departamentoId?: string;
  precioMax?: number;
  /** Solo eventos que aún no han ocurrido; se filtra en la consulta, no en memoria. */
  soloFuturos?: boolean;
};

/**
 * Separa una lista ya cargada en próximos y pasados. Vive fuera de los componentes
 * para no leer el reloj durante el render.
 */
export function separarPorFecha<T extends { fechaInicio: string }>(eventos: T[]) {
  const ahora = Date.now();
  return {
    proximos: eventos.filter((e) => new Date(e.fechaInicio).getTime() >= ahora),
    pasados: eventos.filter((e) => new Date(e.fechaInicio).getTime() < ahora).reverse(),
  };
}

/** Estados de evento que un visitante sin sesión puede ver (coincide con la RLS). */
const ESTADOS_PUBLICOS: EstadoEvento[] = ["publicado", "inscripciones_cerradas", "finalizado"];

export async function listarEventosPublicos(filtros: FiltrosEventos = {}): Promise<EventoPublico[]> {
  "use cache";
  // Los filtros forman parte de la clave, así que cada combinación tiene su
  // entrada. Vida corta a propósito: los cupos y los tramos de precio cambian
  // solos con el reloj, y una entrada por combinación con vida larga acumularía
  // catálogos viejos de filtros que nadie vuelve a pedir.
  cacheLife("minutes");
  cacheTag(TAG_EVENTOS);

  const supabase = createPublicClient();

  let query = supabase
    .from("eventos")
    .select(
      "id, nombre, slug, fecha_inicio, fecha_limite_inscripcion, direccion, imagen_banner_url, moneda, estado, disciplina, departamento_id, empresa_id"
    )
    .in("estado", ESTADOS_PUBLICOS)
    .order("fecha_inicio", { ascending: true });

  if (filtros.q) query = query.ilike("nombre", `%${filtros.q}%`);
  if (filtros.ciudad) query = query.ilike("direccion", `%${filtros.ciudad}%`);
  if (filtros.empresaId) query = query.eq("empresa_id", filtros.empresaId);
  if (filtros.disciplina) query = query.eq("disciplina", filtros.disciplina);
  if (filtros.departamentoId) query = query.eq("departamento_id", filtros.departamentoId);
  if (filtros.soloFuturos) query = query.gte("fecha_inicio", new Date().toISOString());

  if (filtros.mes && /^\d{4}-\d{2}$/.test(filtros.mes)) {
    const [anio, mes] = filtros.mes.split("-").map(Number);
    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));
    query = query.gte("fecha_inicio", desde.toISOString()).lt("fecha_inicio", hasta.toISOString());
  }

  const { data: eventos } = await query;
  if (!eventos?.length) return [];

  const [{ data: empresas }, { data: categorias }] = await Promise.all([
    supabase
      .from("empresas")
      .select("id, nombre_comercial, slug, logo_url")
      .in("id", [...new Set(eventos.map((e) => e.empresa_id))]),
    supabase
      .from("categorias")
      .select("evento_id, distancia_km, precio_base")
      .in(
        "evento_id",
        eventos.map((e) => e.id)
      ),
  ]);

  const resultado = eventos.map((e) => {
    const cats = categorias?.filter((c) => c.evento_id === e.id) ?? [];
    const empresa = empresas?.find((x) => x.id === e.empresa_id);
    const distancias = [
      ...new Set(cats.map((c) => c.distancia_km).filter((d): d is number => d !== null)),
    ].sort((a, b) => a - b);
    const precios = cats.map((c) => Number(c.precio_base)).filter((p) => !Number.isNaN(p));

    return {
      id: e.id,
      nombre: e.nombre,
      slug: e.slug,
      fechaInicio: e.fecha_inicio,
      fechaLimiteInscripcion: e.fecha_limite_inscripcion,
      direccion: e.direccion,
      imagenBannerUrl: e.imagen_banner_url,
      moneda: e.moneda,
      estado: e.estado,
      disciplina: e.disciplina,
      departamentoId: e.departamento_id,
      empresa: empresa
        ? {
            id: empresa.id,
            nombreComercial: empresa.nombre_comercial,
            slug: empresa.slug,
            logoUrl: empresa.logo_url,
          }
        : null,
      distancias,
      precioDesde: precios.length ? Math.min(...precios) : null,
    };
  });

  // Distancia y precio se filtran aquí porque ambos viven en las categorías
  // hijas y no se pueden expresar en la consulta a `eventos`.
  const { distanciaMin, distanciaMax, precioMax } = filtros;
  return resultado.filter((e) => {
    if (precioMax !== undefined && (e.precioDesde === null || e.precioDesde > precioMax)) return false;
    if (distanciaMin === undefined && distanciaMax === undefined) return true;
    return e.distancias.some(
      (d) => (distanciaMin === undefined || d >= distanciaMin) && (distanciaMax === undefined || d <= distanciaMax)
    );
  });
}

/**
 * Contadores del panel de filtros. Consulta aparte y deliberadamente mínima:
 * los números del sidebar describen el catálogo entero, no el resultado ya
 * filtrado —si menguaran con cada filtro, no servirían para decidir el
 * siguiente—.
 */
export async function contarPorDisciplina(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAG_EVENTOS);

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("eventos")
    .select("disciplina")
    .in("estado", ESTADOS_PUBLICOS)
    .gte("fecha_inicio", new Date().toISOString());
  const cuenta: Record<string, number> = {};
  for (const e of data ?? []) cuenta[e.disciplina] = (cuenta[e.disciplina] ?? 0) + 1;
  return cuenta;
}

/** Solo los departamentos que tienen alguna carrera: el resto estorba. */
export async function departamentosConCarreras(): Promise<{ id: string; nombre: string }[]> {
  "use cache";
  // El catálogo geográfico apenas se mueve; lo que cambia es qué departamentos
  // tienen carrera, y eso va con la etiqueta de eventos.
  cacheLife("hours");
  cacheTag(TAG_EVENTOS);

  const supabase = createPublicClient();
  const { data: eventos } = await supabase
    .from("eventos")
    .select("departamento_id")
    .in("estado", ESTADOS_PUBLICOS)
    .not("departamento_id", "is", null);
  const ids = [...new Set((eventos ?? []).map((e) => e.departamento_id).filter(Boolean))] as string[];
  if (!ids.length) return [];
  const { data } = await supabase.from("departamentos").select("id, nombre").in("id", ids).order("nombre");
  return data ?? [];
}

export type CategoriaConCupo = {
  id: string;
  nombre: string;
  distancia_km: number | null;
  desnivel_m: number | null;
  precio_base: number;
  precio_vigente: number;
  cupo_maximo: number | null;
  edad_minima: number | null;
  edad_maxima: number | null;
  hora_salida: string | null;
  inscritos: number;
  cupos_disponibles: number | null;
};

/**
 * Usa la función security definer: `inscripciones` no es legible por anon.
 *
 * **Deliberadamente sin cachear.** Es la única consulta pública que se queda
 * fuera, porque el requisito 3.4 pide cupos en tiempo real y una plaza que ya no
 * existe es justo el dato que no se puede servir viejo: el corredor llegaría al
 * formulario, lo llenaría y se lo rechazaría la transacción de cupo. Quien la
 * llama la envuelve en `<Suspense>`, así que el resto de la ficha se sirve
 * cacheada y solo esto se calcula en cada visita.
 */
export async function categoriasConCupo(eventoId: string): Promise<CategoriaConCupo[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("categorias_con_cupo", { p_evento_id: eventoId });
  return (data as CategoriaConCupo[] | null) ?? [];
}

export type PuntoEntrega = {
  id: string;
  nombre: string;
  direccion: string | null;
  horario: string | null;
  lat: number | null;
  lng: number | null;
};

export async function puntosDeEntrega(eventoId: string): Promise<PuntoEntrega[]> {
  "use cache";
  // Dónde se recoge el kit no cambia de un minuto a otro, y esto lo pide tanto
  // la ficha pública como la del corredor en su portal.
  cacheLife("hours");
  cacheTag(TAG_EVENTOS);

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("evento_puntos_entrega")
    .select("id, nombre, direccion, horario, lat, lng")
    .eq("evento_id", eventoId)
    .order("orden");
  return data ?? [];
}

export async function getEventoPorSlug(slug: string) {
  "use cache";
  // Etiqueta propia además de la general: al guardar los datos de una carrera se
  // invalida solo la suya, sin tirar el catálogo entero de la plataforma.
  cacheLife("hours");
  cacheTag(TAG_EVENTOS, tagEvento(slug));

  const supabase = createPublicClient();
  const { data } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  return data;
}
