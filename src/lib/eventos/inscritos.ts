import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EstadoPago, MetodoPago, Sexo } from "@/lib/supabase/database.types";
import { correoUtil } from "@/lib/acompanantes/cuenta";

export type FiltrosInscritos = {
  q?: string;
  categoriaId?: string;
  talla?: string;
  estadoPago?: EstadoPago | "sin_pago";
  sexo?: Sexo;
};

export type InscritoFila = {
  id: string;
  numeroDorsal: number | null;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  /**
   * Quién responde por esta persona, cuando es el acompañante de otro corredor.
   * Es lo que sustituye al correo: el suyo es una dirección interna inventada a
   * la que no llega nada, y el organizador necesita a quién dirigirse.
   */
  gestionadoPor: { nombre: string | null; telefono: string | null } | null;
  sexo: Sexo | null;
  categoria: string;
  talla: string | null;
  precio: number;
  moneda: string;
  kitEntregado: boolean;
  creadoEn: string;
  pago: {
    id: string;
    estado: EstadoPago;
    metodo: MetodoPago;
    comprobanteUrl: string | null;
    referencia: string | null;
  } | null;
};

/**
 * Inscritos de un evento con su pago más reciente. Se hacen consultas separadas
 * en lugar de un select anidado porque los tipos del esquema están escritos a
 * mano y no declaran las relaciones.
 *
 * Los pagos solo se cargan si `incluirPagos` es true: un operador no tiene
 * permiso de lectura sobre `pagos` y la consulta volvería vacía de todas formas.
 */
export async function listarInscritos(
  eventoId: string,
  filtros: FiltrosInscritos = {},
  incluirPagos = true
): Promise<{ filas: InscritoFila[]; categorias: { id: string; nombre: string }[]; tallas: string[] }> {
  const supabase = await createClient();

  const [{ data: inscripciones }, { data: categorias }, { data: tallasEvento }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select(
        "id, corredor_id, categoria_id, numero_dorsal, talla, precio_pagado, moneda, kit_entregado, estado, created_at"
      )
      .eq("evento_id", eventoId)
      .eq("estado", "activa")
      .order("created_at", { ascending: false }),
    supabase.from("categorias").select("id, nombre").eq("evento_id", eventoId).order("nombre"),
    supabase.from("evento_tallas").select("talla").eq("evento_id", eventoId).order("talla"),
  ]);

  const catalogo = {
    categorias: categorias ?? [],
    tallas: (tallasEvento ?? []).map((t) => t.talla),
  };

  if (!inscripciones?.length) return { filas: [], ...catalogo };

  const ids = inscripciones.map((i) => i.id);
  const [{ data: perfiles }, { data: pagos }, { data: gestores }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombres, apellidos, correo, telefono, sexo")
      .in("id", [...new Set(inscripciones.map((i) => i.corredor_id))]),
    incluirPagos
      ? supabase
          .from("pagos")
          .select("id, inscripcion_id, estado, metodo, comprobante_url, referencia_externa, created_at")
          .in("inscripcion_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    // Por RPC y no por consulta directa: la política de `acompanantes` es del
    // titular, no de la empresa, y así debe seguir. La función abre solo lo
    // imprescindible —los inscritos de este evento— y comprueba la membresía.
    supabase.rpc("gestores_de_inscritos", { p_evento_id: eventoId }),
  ]);

  // Un mismo inscrito puede tener varios intentos de pago; interesa el último.
  const ultimoPago = new Map<string, NonNullable<typeof pagos>[number]>();
  for (const p of pagos ?? []) {
    if (p.inscripcion_id && !ultimoPago.has(p.inscripcion_id)) ultimoPago.set(p.inscripcion_id, p);
  }

  let filas: InscritoFila[] = inscripciones.map((i) => {
    const perfil = perfiles?.find((p) => p.id === i.corredor_id);
    const pago = ultimoPago.get(i.id);
    const gestor = gestores?.find((g) => g.usuario_id === i.corredor_id);
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
      gestionadoPor: gestor
        ? { nombre: gestor.titular_nombre, telefono: gestor.titular_telefono }
        : null,
      sexo: perfil?.sexo ?? null,
      categoria: catalogo.categorias.find((c) => c.id === i.categoria_id)?.nombre ?? "",
      talla: i.talla,
      precio: Number(i.precio_pagado),
      moneda: i.moneda,
      kitEntregado: i.kit_entregado,
      creadoEn: i.created_at,
      pago: pago
        ? {
            id: pago.id,
            estado: pago.estado,
            metodo: pago.metodo,
            comprobanteUrl: pago.comprobante_url,
            referencia: pago.referencia_externa,
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
        // También por el titular: buscar «Pérez» tiene que sacar al padre y a
        // los hijos que inscribió, que es como pregunta quien llega al mostrador.
        f.gestionadoPor?.nombre?.toLowerCase().includes(q) ||
        String(f.numeroDorsal ?? "").includes(q)
    );
  }
  if (filtros.categoriaId) {
    const nombre = catalogo.categorias.find((c) => c.id === filtros.categoriaId)?.nombre;
    filas = filas.filter((f) => f.categoria === nombre);
  }
  if (filtros.talla) filas = filas.filter((f) => f.talla === filtros.talla);
  if (filtros.sexo) filas = filas.filter((f) => f.sexo === filtros.sexo);
  if (filtros.estadoPago) {
    filas =
      filtros.estadoPago === "sin_pago"
        ? filas.filter((f) => !f.pago)
        : filas.filter((f) => f.pago?.estado === filtros.estadoPago);
  }

  return { filas, ...catalogo };
}
