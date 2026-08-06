import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import type { EstadoPago, MetodoPago, Sexo } from "@/lib/supabase/database.types";
import { correoUtil } from "@/lib/acompanantes/cuenta";
import { rangoDeEdad, RANGOS_EDAD, type RangoEdad } from "@/lib/edades";
import { edadEnFecha } from "@/lib/format";

/**
 * Tope de filas del informe.
 *
 * El módulo no tiene paginación —no la tiene ninguna pantalla del proyecto— y en
 * «todas las carreras» el padrón de una empresa con varios años de historia
 * puede ser grande. Antes que traerlo entero y que la pantalla se arrastre, se
 * corta; pero **el corte se dice en pantalla**, porque un informe truncado en
 * silencio se lee como si fuera completo y con eso se toman decisiones.
 */
export const LIMITE_INFORME = 2000;

export type FiltrosInscritos = {
  q?: string;
  eventoId?: string;
  categoriaId?: string;
  talla?: string;
  estadoPago?: EstadoPago | "sin_pago";
  sexo?: Sexo;
  kit?: "entregado" | "pendiente";
  asistencia?: "presente" | "ausente";
  rangoEdad?: RangoEdad;
  dorsal?: "con" | "sin";
};

/**
 * Traduce la URL a filtros. La pantalla y la exportación tienen que leer los
 * mismos parámetros de la misma manera: si divergen, el Excel deja de
 * corresponderse con la tabla que el usuario está mirando.
 */
export function filtrosDeParams(params: URLSearchParams): FiltrosInscritos {
  const uno = (clave: string) => params.get(clave) || undefined;
  const entre = <T extends string>(clave: string, validos: readonly T[]): T | undefined => {
    const v = params.get(clave);
    return v && (validos as readonly string[]).includes(v) ? (v as T) : undefined;
  };

  return {
    q: uno("q"),
    eventoId: uno("evento"),
    categoriaId: uno("categoria"),
    talla: uno("talla"),
    sexo: entre("sexo", ["femenino", "masculino", "otro"] as const),
    estadoPago: uno("pago") as FiltrosInscritos["estadoPago"],
    kit: entre("kit", ["entregado", "pendiente"] as const),
    asistencia: entre("asistencia", ["presente", "ausente"] as const),
    rangoEdad: entre("edad", RANGOS_EDAD),
    dorsal: entre("dorsal", ["con", "sin"] as const),
  };
}

export type InscritoFila = {
  id: string;
  numeroDorsal: number | null;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  documento: string | null;
  /**
   * Quién responde por esta persona, cuando es el acompañante de otro corredor.
   * Es lo que sustituye al correo: el suyo es una dirección interna inventada a
   * la que no llega nada, y el organizador necesita a quién dirigirse.
   */
  gestionadoPor: { nombre: string | null; telefono: string | null } | null;
  sexo: Sexo | null;
  /** Cumplida el día de la carrera, que es el criterio de las categorías. */
  edad: number | null;
  rangoEdad: RangoEdad | null;
  ciudad: string | null;
  eventoId: string;
  evento: string;
  categoriaId: string;
  categoria: string;
  distanciaKm: number | null;
  talla: string | null;
  club: string | null;
  equipo: string | null;
  precio: number;
  moneda: string;
  kitEntregado: boolean;
  kitEntregadoEn: string | null;
  asistenciaConfirmada: boolean;
  codigoQr: string | null;
  /** Inscripciones que comparten un mismo pago familiar. */
  grupoId: string | null;
  creadoEn: string;
  pago: {
    id: string;
    estado: EstadoPago;
    metodo: MetodoPago;
    /** Lo realmente cobrado, que puede no coincidir con el precio inscrito. */
    monto: number;
    comprobanteUrl: string | null;
    referencia: string | null;
    verificadoEn: string | null;
  } | null;
};

export type CategoriaInscritos = {
  id: string;
  nombre: string;
  eventoId: string;
  /** null = cupo abierto. Lo necesita el medidor de ocupación del resumen. */
  cupoMaximo: number | null;
};

export type CatalogoInscritos = {
  eventos: { id: string; nombre: string }[];
  categorias: CategoriaInscritos[];
  tallas: string[];
};

export type ResultadoInscritos = CatalogoInscritos & {
  filas: InscritoFila[];
  /** Cuántas filas se dejaron fuera por el tope, para poder decirlo. */
  truncado: boolean;
};

/** Lo que el formulario público guarda en `inscripciones.datos_adicionales`. */
type DatosAdicionales = { club?: string | null; equipo?: string | null };

/**
 * El padrón, con su pago más reciente, listo para pintar o exportar.
 *
 * Con `eventoId` en `null` recorre **todas las carreras de la empresa activa**,
 * que es lo que necesita el gerente para ver el conjunto; con un id, solo esa.
 *
 * Se hacen consultas separadas en lugar de un select anidado porque los tipos
 * del esquema están escritos a mano y no declaran las relaciones.
 *
 * Los pagos solo se cargan si `incluirPagos` es true: un operador no tiene
 * permiso de lectura sobre `pagos` y la consulta volvería vacía de todas formas.
 */
export async function listarInscritos(
  eventoId: string | null,
  filtros: FiltrosInscritos = {},
  incluirPagos = true
): Promise<ResultadoInscritos> {
  const supabase = await createClient();
  const membresia = await getEmpresaActivaDelPanel();

  const { data: eventosData } = await supabase
    .from("eventos")
    .select("id, nombre, fecha_inicio")
    .eq("empresa_id", membresia.empresaId)
    .order("fecha_inicio", { ascending: false });

  // Con una carrera concreta el ámbito es esa; sin ella, todas las de la empresa.
  // El filtro de carrera del propio informe acota dentro de ese ámbito.
  const delAmbito = (eventosData ?? []).filter((e) => !eventoId || e.id === eventoId);
  const enfocados = filtros.eventoId
    ? delAmbito.filter((e) => e.id === filtros.eventoId)
    : delAmbito;
  const idsEvento = enfocados.map((e) => e.id);

  const catalogoVacio: CatalogoInscritos = {
    eventos: delAmbito.map((e) => ({ id: e.id, nombre: e.nombre })),
    categorias: [],
    tallas: [],
  };
  if (idsEvento.length === 0) {
    return { filas: [], truncado: false, ...catalogoVacio };
  }

  // Los filtros que caben en la consulta bajan a SQL; `q`, `sexo`, la edad y el
  // pago se resuelven después porque cruzan `perfiles` y `pagos`.
  let consulta = supabase
    .from("inscripciones")
    .select(
      "id, evento_id, corredor_id, categoria_id, numero_dorsal, codigo_qr, talla, precio_pagado, moneda, kit_entregado, kit_entregado_en, asistencia_confirmada, grupo_inscripcion_id, datos_adicionales, created_at"
    )
    .in("evento_id", idsEvento)
    .eq("estado", "activa");

  if (filtros.categoriaId) consulta = consulta.eq("categoria_id", filtros.categoriaId);
  if (filtros.talla) consulta = consulta.eq("talla", filtros.talla);
  if (filtros.kit) consulta = consulta.eq("kit_entregado", filtros.kit === "entregado");
  if (filtros.asistencia)
    consulta = consulta.eq("asistencia_confirmada", filtros.asistencia === "presente");
  if (filtros.dorsal === "con") consulta = consulta.not("numero_dorsal", "is", null);
  if (filtros.dorsal === "sin") consulta = consulta.is("numero_dorsal", null);

  // Una de más: si vuelve, es que había más de las que caben.
  const [{ data: crudas }, { data: categorias }, { data: tallasEvento }] = await Promise.all([
    consulta.order("created_at", { ascending: false }).limit(LIMITE_INFORME + 1),
    supabase
      .from("categorias")
      .select("id, nombre, distancia_km, cupo_maximo, evento_id")
      .in("evento_id", idsEvento),
    supabase.from("evento_tallas").select("talla").in("evento_id", idsEvento),
  ]);

  const catalogo: CatalogoInscritos = {
    eventos: catalogoVacio.eventos,
    categorias: (categorias ?? [])
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        eventoId: c.evento_id,
        cupoMaximo: c.cupo_maximo,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    tallas: [...new Set((tallasEvento ?? []).map((t) => t.talla))].sort(),
  };

  const truncado = (crudas?.length ?? 0) > LIMITE_INFORME;
  const inscripciones = (crudas ?? []).slice(0, LIMITE_INFORME);
  if (inscripciones.length === 0) return { filas: [], truncado: false, ...catalogo };

  const ids = inscripciones.map((i) => i.id);
  const corredorIds = [...new Set(inscripciones.map((i) => i.corredor_id))];

  const [{ data: perfiles }, { data: pagos }, gestoresPorEvento] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombres, apellidos, correo, telefono, sexo, fecha_nacimiento, documento_identidad, ciudad_id")
      .in("id", corredorIds),
    incluirPagos
      ? supabase
          .from("pagos")
          .select(
            "id, inscripcion_id, estado, metodo, monto, comprobante_url, referencia_externa, verificado_en, created_at"
          )
          .in("inscripcion_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    // Por RPC y no por consulta directa: la política de `acompanantes` es del
    // titular, no de la empresa, y así debe seguir. La función abre solo lo
    // imprescindible —los inscritos de un evento suyo— y comprueba la membresía.
    // Recibe un evento, así que con varias carreras se pregunta por cada una.
    Promise.all(
      idsEvento.map((id) => supabase.rpc("gestores_de_inscritos", { p_evento_id: id }))
    ),
  ]);

  const gestores = gestoresPorEvento.flatMap((r) => r.data ?? []);

  // La ciudad vive en otra tabla y solo hace falta el nombre.
  const ciudadIds = [...new Set((perfiles ?? []).map((p) => p.ciudad_id).filter(Boolean))] as string[];
  const { data: ciudades } = ciudadIds.length
    ? await supabase.from("ciudades").select("id, nombre").in("id", ciudadIds)
    : { data: [] as { id: string; nombre: string }[] };

  // Índices por id: con dos mil filas, un `find` por fila y por tabla es un
  // recorrido completo cada vez.
  const porId = <T extends { id: string }>(lista: T[] | null) =>
    new Map((lista ?? []).map((x) => [x.id, x]));

  const mapaPerfil = porId(perfiles);
  const mapaCategoria = porId(catalogo.categorias);
  const mapaEvento = new Map(enfocados.map((e) => [e.id, e]));
  const mapaCiudad = porId(ciudades);
  const mapaDistancia = new Map((categorias ?? []).map((c) => [c.id, c.distancia_km]));
  const mapaGestor = new Map(gestores.map((g) => [g.usuario_id, g]));

  // Un mismo inscrito puede tener varios intentos de pago; interesa el último.
  const ultimoPago = new Map<string, NonNullable<typeof pagos>[number]>();
  for (const p of pagos ?? []) {
    if (p.inscripcion_id && !ultimoPago.has(p.inscripcion_id)) ultimoPago.set(p.inscripcion_id, p);
  }

  let filas: InscritoFila[] = inscripciones.map((i) => {
    const perfil = mapaPerfil.get(i.corredor_id);
    const pago = ultimoPago.get(i.id);
    const gestor = mapaGestor.get(i.corredor_id);
    const evento = mapaEvento.get(i.evento_id);
    const extra = (i.datos_adicionales ?? {}) as DatosAdicionales;

    // La edad que tendrá el día de la carrera, no la de hoy: es el criterio con
    // el que se validó su categoría al inscribirse.
    const edad =
      perfil?.fecha_nacimiento && evento
        ? edadEnFecha(perfil.fecha_nacimiento, evento.fecha_inicio)
        : null;

    return {
      id: i.id,
      numeroDorsal: i.numero_dorsal,
      nombre: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || "(sin nombre)",
      // `correoUtil` descarta las direcciones internas de acompañante: no llevan
      // a nadie y enseñarlas invita a escribir a un buzón que no existe.
      correo: correoUtil(perfil?.correo),
      // El teléfono del titular sirve para los dos, que es de lo que se trata:
      // por ese dorsal se llama al adulto responsable.
      telefono: perfil?.telefono ?? gestor?.titular_telefono ?? null,
      documento: perfil?.documento_identidad ?? null,
      gestionadoPor: gestor
        ? { nombre: gestor.titular_nombre, telefono: gestor.titular_telefono }
        : null,
      sexo: perfil?.sexo ?? null,
      edad,
      rangoEdad: rangoDeEdad(edad),
      ciudad: perfil?.ciudad_id ? (mapaCiudad.get(perfil.ciudad_id)?.nombre ?? null) : null,
      eventoId: i.evento_id,
      evento: evento?.nombre ?? "",
      categoriaId: i.categoria_id,
      categoria: mapaCategoria.get(i.categoria_id)?.nombre ?? "",
      distanciaKm: mapaDistancia.get(i.categoria_id) ?? null,
      talla: i.talla,
      club: extra.club ?? null,
      equipo: extra.equipo ?? null,
      precio: Number(i.precio_pagado),
      moneda: i.moneda,
      kitEntregado: i.kit_entregado,
      kitEntregadoEn: i.kit_entregado_en,
      asistenciaConfirmada: i.asistencia_confirmada,
      codigoQr: i.codigo_qr,
      grupoId: i.grupo_inscripcion_id,
      creadoEn: i.created_at,
      pago: pago
        ? {
            id: pago.id,
            estado: pago.estado,
            metodo: pago.metodo,
            monto: Number(pago.monto),
            comprobanteUrl: pago.comprobante_url,
            referencia: pago.referencia_externa,
            verificadoEn: pago.verificado_en,
          }
        : null,
    };
  });

  if (filtros.q) {
    const q = filtros.q.toLowerCase();
    filas = filas.filter(
      (f) =>
        f.nombre.toLowerCase().includes(q) ||
        f.correo?.toLowerCase().includes(q) ||
        f.documento?.toLowerCase().includes(q) ||
        f.club?.toLowerCase().includes(q) ||
        // También por el titular: buscar «Pérez» tiene que sacar al padre y a
        // los hijos que inscribió, que es como pregunta quien llega al mostrador.
        f.gestionadoPor?.nombre?.toLowerCase().includes(q) ||
        String(f.numeroDorsal ?? "").includes(q)
    );
  }
  if (filtros.sexo) filas = filas.filter((f) => f.sexo === filtros.sexo);
  if (filtros.rangoEdad) filas = filas.filter((f) => f.rangoEdad === filtros.rangoEdad);
  if (filtros.estadoPago) {
    filas =
      filtros.estadoPago === "sin_pago"
        ? filas.filter((f) => !f.pago)
        : filas.filter((f) => f.pago?.estado === filtros.estadoPago);
  }

  return { filas, truncado, ...catalogo };
}
