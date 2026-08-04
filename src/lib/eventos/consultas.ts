import { createClient } from "@/lib/supabase/server";
import type { Disciplina, EstadoEvento } from "@/lib/supabase/database.types";

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
  const supabase = await createClient();

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
  const supabase = await createClient();
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
  const supabase = await createClient();
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

/** Usa la función security definer: `inscripciones` no es legible por anon. */
export async function categoriasConCupo(eventoId: string): Promise<CategoriaConCupo[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("evento_puntos_entrega")
    .select("id, nombre, direccion, horario, lat, lng")
    .eq("evento_id", eventoId)
    .order("orden");
  return data ?? [];
}

export async function getEventoPorSlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  return data;
}
