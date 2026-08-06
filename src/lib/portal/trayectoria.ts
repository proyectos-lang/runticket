import { createClient } from "@/lib/supabase/server";
import type { EstadoInscripcion, EstadoPago } from "@/lib/supabase/database.types";

/**
 * Cómo se clasifica una inscripción en la cuenta del corredor.
 *
 * `finalizada` no es un estado de la base de datos: la tabla solo distingue
 * activa / anulada / transferida / lista de espera. Una carrera está finalizada
 * cuando sigue activa y su evento ya ocurrió, que es lo que el corredor
 * entiende por «ya la corrí».
 */
export type ClaseCarrera = "proxima" | "finalizada" | "cancelada";

export type CarreraDelCorredor = {
  inscripcionId: string;
  eventoId: string;
  evento: string;
  slug: string;
  fecha: string;
  zonaHoraria: string;
  categoria: string;
  distanciaKm: number | null;
  dorsal: number | null;
  codigoQr: string | null;
  talla: string | null;
  estado: EstadoInscripcion;
  estadoPago: EstadoPago | null;
  precio: number;
  moneda: string;
  kitEntregado: boolean;
  kitEntregadoEn: string | null;
  /** Postgres devuelve el interval como texto, p. ej. "01:23:45". */
  tiempo: string | null;
  puesto: number | null;
  /** Cuántos corredores tienen tiempo publicado en ese evento. */
  participantes: number | null;
  /** Su mejor marca hasta hoy en esa distancia. */
  esRecord: boolean;
  /**
   * Si el certificado se puede descargar ya. No es lo mismo que `clase` sea
   * "finalizada": esa se deriva de la fecha, y el PDF exige además que el
   * organizador haya cerrado el evento.
   */
  tieneCertificado: boolean;
  /** False cuando la carrera es de un acompañante y no del titular. */
  esPropia: boolean;
  /** Nombre de quien corre; solo se muestra cuando no es el titular. */
  participante: string | null;
  clase: ClaseCarrera;
};

export type Trayectoria = {
  carreras: CarreraDelCorredor[];
  proximas: CarreraDelCorredor[];
  finalizadas: CarreraDelCorredor[];
  canceladas: CarreraDelCorredor[];
  metricas: {
    carreras: number;
    kmTotales: number;
    mejor: { tiempo: string; distanciaKm: number | null } | null;
  };
  /** Del club declarado en la inscripción más reciente; no está en el perfil. */
  club: string | null;
  /** Año de la primera inscripción, para el «DESDE 2023» de la cabecera. */
  desdeAnio: number | null;
};

/** "01:23:45" → 5025. Devuelve null si el formato no es el esperado. */
export function segundosDeIntervalo(intervalo: string | null): number | null {
  if (!intervalo) return null;
  const m = intervalo.match(/(\d+):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const VACIA: Trayectoria = {
  carreras: [],
  proximas: [],
  finalizadas: [],
  canceladas: [],
  metricas: { carreras: 0, kmTotales: 0, mejor: null },
  club: null,
  desdeAnio: null,
};

/**
 * Todo lo que la sección de cuenta necesita, en una sola pasada.
 *
 * Se resuelve aquí y no en cada pantalla porque las métricas deben calcularse
 * sobre el conjunto completo: sumarlas en el cliente sobre una página parcial
 * daría cifras distintas según por dónde se entre.
 */
export async function trayectoriaDelCorredor(corredorId: string): Promise<Trayectoria> {
  const supabase = await createClient();

  /**
   * También las de los acompañantes: quien inscribe a su hijo necesita ver su
   * dorsal y su código de retiro desde aquí, porque esa persona no tiene cuenta
   * con la que entrar. La RLS de la migración 0026 es la que lo permite.
   */
  const { data: relaciones } = await supabase
    .from("acompanantes")
    .select("usuario_id")
    .eq("titular_id", corredorId);

  const idsAcompanantes = (relaciones ?? []).map((r) => r.usuario_id);
  const participantes = [corredorId, ...idsAcompanantes];

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select(
      "id, evento_id, categoria_id, talla, numero_dorsal, codigo_qr, precio_pagado, moneda, estado, kit_entregado, kit_entregado_en, datos_adicionales, created_at, corredor_id"
    )
    .in("corredor_id", participantes)
    .order("created_at", { ascending: false });

  if (!inscripciones?.length) return VACIA;

  // Nombres de los acompañantes, para poder rotular cada tarjeta.
  const { data: perfilesAcompanantes } = idsAcompanantes.length
    ? await supabase.from("perfiles").select("id, nombres, apellidos").in("id", idsAcompanantes)
    : { data: [] as { id: string; nombres: string | null; apellidos: string | null }[] };

  const ids = inscripciones.map((i) => i.id);
  const eventoIds = [...new Set(inscripciones.map((i) => i.evento_id))];
  const categoriaIds = [...new Set(inscripciones.map((i) => i.categoria_id))];

  const [{ data: eventos }, { data: categorias }, { data: resultados }, { data: pagos }] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("id, nombre, slug, fecha_inicio, zona_horaria, estado")
        .in("id", eventoIds),
      supabase.from("categorias").select("id, nombre, distancia_km").in("id", categoriaIds),
      supabase
        .from("resultados")
        .select("inscripcion_id, tiempo_oficial, posicion_general")
        .in("inscripcion_id", ids),
      supabase
        .from("pagos")
        .select("inscripcion_id, estado, created_at")
        .in("inscripcion_id", ids)
        .order("created_at", { ascending: false }),
    ]);

  // Participantes con tiempo publicado por evento, para situar el puesto. Una
  // sola consulta con el filtro embebido en vez de una por carrera; RLS solo
  // deja ver los publicados, que es justo lo que hay que contar.
  const { data: publicados } = await supabase
    .from("resultados")
    .select("posicion_general, inscripciones!inner(evento_id)")
    .eq("publicado", true)
    .in("inscripciones.evento_id", eventoIds);

  const participantesPorEvento = new Map<string, number>();
  for (const r of (publicados ?? []) as unknown as { inscripciones: { evento_id: string } }[]) {
    const id = r.inscripciones.evento_id;
    participantesPorEvento.set(id, (participantesPorEvento.get(id) ?? 0) + 1);
  }

  const ahora = Date.now();
  const carreras: CarreraDelCorredor[] = inscripciones
    .map((i) => {
      const evento = eventos?.find((e) => e.id === i.evento_id);
      const categoria = categorias?.find((c) => c.id === i.categoria_id);
      const resultado = resultados?.find((r) => r.inscripcion_id === i.id);
      // Los pagos vienen ordenados de más reciente a más antiguo: el primero
      // que aparece para esta inscripción es el que manda.
      const pago = pagos?.find((p) => p.inscripcion_id === i.id);
      const yaOcurrio = evento ? new Date(evento.fecha_inicio).getTime() < ahora : false;

      const clase: ClaseCarrera =
        i.estado === "anulada" || i.estado === "transferida"
          ? "cancelada"
          : yaOcurrio
            ? "finalizada"
            : "proxima";

      return {
        inscripcionId: i.id,
        eventoId: i.evento_id,
        evento: evento?.nombre ?? "",
        slug: evento?.slug ?? "",
        fecha: evento?.fecha_inicio ?? "",
        zonaHoraria: evento?.zona_horaria ?? "America/Tegucigalpa",
        categoria: categoria?.nombre ?? "",
        distanciaKm: categoria?.distancia_km ?? null,
        dorsal: i.numero_dorsal,
        codigoQr: i.codigo_qr,
        talla: i.talla,
        estado: i.estado,
        estadoPago: (pago?.estado as EstadoPago | undefined) ?? null,
        precio: Number(i.precio_pagado),
        moneda: i.moneda,
        kitEntregado: i.kit_entregado,
        kitEntregadoEn: i.kit_entregado_en,
        tiempo: resultado?.tiempo_oficial ?? null,
        puesto: resultado?.posicion_general ?? null,
        participantes: participantesPorEvento.get(i.evento_id) ?? null,
        esPropia: i.corredor_id === corredorId,
        participante:
          i.corredor_id === corredorId
            ? null
            : (() => {
                const p = perfilesAcompanantes?.find((x) => x.id === i.corredor_id);
                return [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || "Acompañante";
              })(),
        esRecord: false,
        // Mismo criterio exacto que aplica el endpoint del PDF: evento cerrado
        // por el organizador e inscripción activa. Antes esto salía de la tabla
        // `certificados`, en la que no escribe nadie —ni la aplicación ni la
        // base—, así que la descarga no aparecía jamás aunque el PDF existiera.
        tieneCertificado: evento?.estado === "finalizado" && i.estado === "activa",
        clase,
      };
    })
    .filter((c) => c.evento)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Récord personal por distancia: la marca más rápida de cada una, no la más
  // reciente. Es lo que un corredor entiende por «marca».
  //
  // Solo cuentan las suyas: si entraran las de sus acompañantes, el tiempo de su
  // hijo en los 5K aparecería como su propia marca personal.
  const mejorPorDistancia = new Map<number, { id: string; segundos: number }>();
  for (const c of carreras) {
    if (!c.esPropia) continue;
    if (c.clase !== "finalizada") continue;
    const s = segundosDeIntervalo(c.tiempo);
    if (s === null || c.distanciaKm === null) continue;
    const actual = mejorPorDistancia.get(c.distanciaKm);
    if (!actual || s < actual.segundos) {
      mejorPorDistancia.set(c.distanciaKm, { id: c.inscripcionId, segundos: s });
    }
  }
  const idsRecord = new Set([...mejorPorDistancia.values()].map((v) => v.id));
  for (const c of carreras) c.esRecord = idsRecord.has(c.inscripcionId);

  const finalizadas = carreras.filter((c) => c.clase === "finalizada");
  // Las métricas de la cabecera son del titular, no de la familia.
  const propiasFinalizadas = finalizadas.filter((c) => c.esPropia);

  // Los kilómetros solo suman las carreras con distancia declarada: una
  // categoría sin distancia no puede inventarse una.
  const kmTotales = propiasFinalizadas.reduce((a, c) => a + (c.distanciaKm ?? 0), 0);

  let mejor: Trayectoria["metricas"]["mejor"] = null;
  let mejorSegundos = Infinity;
  for (const c of propiasFinalizadas) {
    const s = segundosDeIntervalo(c.tiempo);
    if (s !== null && s < mejorSegundos) {
      mejorSegundos = s;
      mejor = { tiempo: c.tiempo!, distanciaKm: c.distanciaKm };
    }
  }

  // El club no está en el perfil: se declara en cada inscripción. Vale el de la
  // más reciente que lo traiga.
  const propias = inscripciones.filter((i) => i.corredor_id === corredorId);
  const club =
    propias
      .map((i) => (i.datos_adicionales as { club?: string | null } | null)?.club)
      .find((c) => typeof c === "string" && c.trim()) ?? null;

  const primera = propias.at(-1);

  return {
    carreras,
    proximas: carreras.filter((c) => c.clase === "proxima").reverse(),
    finalizadas,
    canceladas: carreras.filter((c) => c.clase === "cancelada"),
    metricas: { carreras: propiasFinalizadas.length, kmTotales, mejor },
    club,
    desdeAnio: primera ? new Date(primera.created_at).getFullYear() : null,
  };
}
