import { verificarCobro } from "@/lib/pasarela";
import { pixelpayConfigurado } from "@/lib/pixelpay";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Aviso de PixelPay cuando se paga un cobro (su «webhook»).
 *
 * Se configura en PixelPay, en Preferencias › Opciones del API: activar el
 * webhook y poner como URL de éxito `https://<dominio>/api/pagos/pixelpay`.
 *
 * **No se cree nada de lo que trae.** El cuerpo es JSON sin firmar que
 * cualquiera podría mandar, y el `payment_hash` que incluye tampoco sirve de
 * prueba: es el mismo que PixelPay le enseña al comprador en la URL de regreso.
 * Del aviso solo se toma el uuid del cobro, y el estado se le pregunta a
 * PixelPay con nuestras credenciales. Lo peor que puede hacer un aviso falso es
 * provocar esa consulta.
 *
 * PixelPay reintenta hasta tres veces, cada cinco minutos, si no recibe un 200.
 * Por eso solo se responde con error cuando el fallo es nuestro y reintentar
 * puede arreglarlo; un aviso que no corresponde a ningún pago se acepta y se
 * olvida.
 */
export async function POST(request: Request) {
  if (!pixelpayConfigurado()) {
    return Response.json({ ok: false }, { status: 503 });
  }

  let uuid: unknown;
  try {
    ({ uuid } = (await request.json()) as { uuid?: unknown });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  // Los uuid de cobro de PixelPay tienen la forma P-xxxxxxxx-xxxx-…
  if (typeof uuid !== "string" || !/^P-[0-9a-f-]{36}$/i.test(uuid)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    // Antes de molestar a PixelPay: ¿es un cobro nuestro y sigue abierto?
    const { data: pago, error } = await createAdminClient()
      .from("pagos")
      .select("estado")
      .eq("pasarela_uuid", uuid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pago || !["pendiente", "en_verificacion"].includes(pago.estado)) {
      return Response.json({ ok: true, resultado: pago ? "sin_cambios" : "desconocido" });
    }

    const resultado = await verificarCobro(uuid);
    return Response.json({ ok: true, resultado });
  } catch (e) {
    console.error("PixelPay: no se pudo procesar el aviso", uuid, e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
