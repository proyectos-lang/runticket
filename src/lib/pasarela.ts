import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearCobro, consultarCobro } from "@/lib/pixelpay";
import { avisarPagoConfirmado } from "@/lib/correo/mensajes";

/**
 * El pago con tarjeta, de punta a punta, para una inscripción suelta o para un
 * grupo. Las dos pantallas del portal lo usan igual; solo cambia qué se paga.
 */

export type ResultadoInicio =
  | { tipo: "redirigir"; url: string }
  | { tipo: "pagado" }
  | { tipo: "error"; mensaje: string };

const ERRORES_CONOCIDOS: Record<string, string> = {
  COMPROBANTE_EN_REVISION:
    "Ya enviaste un comprobante y el organizador lo está revisando. Espera su respuesta antes de pagar con tarjeta.",
  PAGO_ES_DE_GRUPO: "Esta inscripción se paga junto con tu grupo.",
};

/**
 * Prepara el pago y devuelve adónde mandar al corredor.
 *
 * El importe lo fija `preparar_pago_pasarela` en la base; de aquí no sale
 * ningún número que haya elegido el navegador. Si ya había un cobro abierto por
 * el mismo importe se reutiliza, para que volver a pulsar el botón no deje un
 * reguero de cobros en PixelPay.
 */
export async function iniciarPagoConTarjeta(
  destino: { inscripcionId: string } | { grupoId: string },
  asunto: string
): Promise<ResultadoInicio> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { tipo: "error", mensaje: "Inicia sesión para pagar." };

  const { data: pagoId, error } = await supabase.rpc("preparar_pago_pasarela", {
    p_inscripcion_id: "inscripcionId" in destino ? destino.inscripcionId : null,
    p_grupo_id: "grupoId" in destino ? destino.grupoId : null,
  });
  if (error || !pagoId) {
    const clave = Object.keys(ERRORES_CONOCIDOS).find((k) => error?.message.includes(k));
    return {
      tipo: "error",
      mensaje: clave ? ERRORES_CONOCIDOS[clave] : "No se pudo preparar el pago. Inténtalo de nuevo.",
    };
  }

  // Las columnas de la pasarela se escriben con la llave de servicio: el
  // corredor no tiene permiso de UPDATE sobre `pagos`, y así debe seguir.
  const admin = createAdminClient();
  const { data: pago } = await admin
    .from("pagos")
    .select("id, monto, moneda, pasarela_uuid, pasarela_url")
    .eq("id", pagoId)
    .single();
  if (!pago) return { tipo: "error", mensaje: "No se pudo preparar el pago." };

  try {
    if (pago.pasarela_uuid && pago.pasarela_url) {
      // Puede que ya lo haya pagado y vuelva a pulsar antes de que llegue el aviso.
      const r = await verificarCobro(pago.pasarela_uuid);
      if (r === "pagado" || r === "ya_pagado") return { tipo: "pagado" };
      return { tipo: "redirigir", url: pago.pasarela_url };
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombres, apellidos")
      .eq("id", user.id)
      .maybeSingle();
    const nombre = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || user.email;

    const cobro = await crearCobro({
      // Única por cobro: el id del pago más un sello, porque un mismo pago
      // puede necesitar un cobro nuevo si cambia el importe del grupo.
      orden: `RT-${pago.id.slice(0, 8)}-${Date.now().toString(36)}`.toUpperCase(),
      asunto,
      nombre,
      email: user.email,
      monto: Number(pago.monto),
      moneda: pago.moneda,
      extras: { pago_id: pago.id },
    });

    const { error: errorGuardado } = await admin
      .from("pagos")
      .update({
        pasarela_uuid: cobro.uuid,
        pasarela_url: cobro.url,
        pasarela_monto: Number(pago.monto),
      })
      .eq("id", pago.id);
    if (errorGuardado) throw new Error(errorGuardado.message);

    return { tipo: "redirigir", url: cobro.url };
  } catch (e) {
    console.error("PixelPay: no se pudo iniciar el cobro", pago.id, e);
    return {
      tipo: "error",
      mensaje: "La pasarela del banco no respondió. Inténtalo en unos minutos o usa otra forma de pago.",
    };
  }
}

export type ResultadoVerificacion =
  | "pagado"
  | "ya_pagado"
  | "a_revision"
  | "ignorado"
  | "falso_positivo"
  | "pendiente"
  | "desconocido";

/**
 * Pregunta a PixelPay por un cobro y concilia el pago con lo que responda.
 *
 * Es lo único que marca un pago con tarjeta como pagado, y lo usan el aviso de
 * PixelPay, el portal al abrirse, el botón del panel y la conciliación diaria.
 * El uuid llegue de donde llegue solo sirve para saber a quién preguntar: la
 * respuesta sale de PixelPay, y queda guardada como evidencia en el pago
 * (estado, transacción, autorización, importe y la respuesta completa).
 */
export async function verificarCobro(uuid: string): Promise<ResultadoVerificacion> {
  const consulta = await consultarCobro(uuid);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("registrar_verificacion_pasarela", {
    p_pasarela_uuid: uuid,
    p_estado: consulta.estado,
    p_detalle: consulta.crudo,
    p_monto_cobrado: consulta.monto,
    p_transaccion: consulta.transaccion,
    p_autorizacion: consulta.autorizacion,
  });
  if (error) throw new Error(error.message);
  const resultado = (data ?? "desconocido") as ResultadoVerificacion;

  if (resultado === "falso_positivo" || resultado === "a_revision" || resultado === "ignorado") {
    console.warn("PixelPay: el cobro no cuadra con RunTicket", uuid, resultado, consulta.estado);
  }

  // Mismo correo que cuando el organizador aprueba a mano: el dorsal y el QR.
  if (resultado === "pagado") {
    const { data: pago } = await admin.from("pagos").select("id").eq("pasarela_uuid", uuid).maybeSingle();
    if (pago) await avisarPagoConfirmado(pago.id);
  }
  return resultado;
}

/**
 * Al abrir el portal: si hay un pago con tarjeta pendiente, se comprueba.
 *
 * Cubre el caso en que el aviso de PixelPay no llegó (o todavía no llegó) y el
 * corredor vuelve de pagar. Un fallo de la pasarela no rompe la página: el
 * pago sigue pendiente y se volverá a mirar en la próxima visita.
 */
export async function comprobarPagoPendiente(pago: {
  estado: string;
  metodo: string;
  pasarela_uuid: string | null;
} | null): Promise<boolean> {
  if (!pago?.pasarela_uuid || pago.metodo !== "pasarela" || pago.estado !== "pendiente") {
    return false;
  }
  try {
    return (await verificarCobro(pago.pasarela_uuid)) === "pagado";
  } catch (e) {
    console.error("PixelPay: no se pudo comprobar el cobro", pago.pasarela_uuid, e);
    return false;
  }
}

export type ResumenConciliacionPixelPay = {
  revisados: number;
  errores: number;
  porResultado: Partial<Record<ResultadoVerificacion, number>>;
};

/**
 * Vuelve a preguntar a PixelPay por los cobros que importan:
 *
 * · los abiertos (pendientes o en revisión), por si se pagaron y no llegó el
 *   aviso;
 * · los que RunTicket da por pagados con tarjeta, por si PixelPay no los
 *   respalda — el falso positivo que no puede pasar desapercibido.
 *
 * Uno a uno y sin paralelismo: son pocos, y así no se castiga a PixelPay.
 */
export async function conciliarConPixelPay(opciones: {
  empresaId?: string;
  /** Solo cobros creados en los últimos N días. */
  dias?: number;
  limite?: number;
} = {}): Promise<ResumenConciliacionPixelPay> {
  let consulta = createAdminClient()
    .from("pagos")
    .select("pasarela_uuid")
    .not("pasarela_uuid", "is", null)
    .in("estado", ["pendiente", "en_verificacion", "pagado"])
    .order("created_at", { ascending: false })
    .limit(opciones.limite ?? 300);
  if (opciones.empresaId) consulta = consulta.eq("empresa_id", opciones.empresaId);
  if (opciones.dias) {
    consulta = consulta.gte("created_at", new Date(Date.now() - opciones.dias * 86_400_000).toISOString());
  }

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);

  const resumen: ResumenConciliacionPixelPay = { revisados: 0, errores: 0, porResultado: {} };
  for (const { pasarela_uuid } of data ?? []) {
    try {
      const r = await verificarCobro(pasarela_uuid!);
      resumen.porResultado[r] = (resumen.porResultado[r] ?? 0) + 1;
      resumen.revisados++;
    } catch (e) {
      resumen.errores++;
      console.error("PixelPay: no se pudo conciliar", pasarela_uuid, e);
    }
  }
  return resumen;
}
