import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearCobro, estadoDelCobro } from "@/lib/pixelpay";

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
      if ((await sincronizarCobro(pago.pasarela_uuid)) === "pagado") return { tipo: "pagado" };
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

/**
 * Pregunta a PixelPay por un cobro y, si está pagado, cierra el pago.
 *
 * Es lo único que marca un pago con tarjeta como pagado, y lo usan tanto el
 * aviso de PixelPay como el portal al abrirse. El uuid llegue de donde llegue
 * solo sirve para saber a quién preguntar: la respuesta sale de PixelPay.
 */
export async function sincronizarCobro(uuid: string): Promise<string> {
  const estado = await estadoDelCobro(uuid);
  if (estado !== "paid") return "pendiente";

  const { data, error } = await createAdminClient().rpc("confirmar_pago_pasarela", {
    p_pasarela_uuid: uuid,
    p_referencia: uuid,
  });
  if (error) throw new Error(error.message);
  return data ?? "desconocido";
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
    return (await sincronizarCobro(pago.pasarela_uuid)) === "pagado";
  } catch (e) {
    console.error("PixelPay: no se pudo comprobar el cobro", pago.pasarela_uuid, e);
    return false;
  }
}
