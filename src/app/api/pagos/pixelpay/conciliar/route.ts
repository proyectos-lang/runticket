import { timingSafeEqual } from "crypto";
import { conciliarConPixelPay } from "@/lib/pasarela";
import { pixelpayConfigurado } from "@/lib/pixelpay";

/**
 * Conciliación diaria con PixelPay, lanzada por el cron de Vercel (vercel.json).
 *
 * Vercel llama con `Authorization: Bearer <CRON_SECRET>`. Sin esa variable la
 * ruta no hace nada: preferible a dejar abierta a cualquiera una tarea que
 * consulta todos los cobros de todas las empresas.
 *
 * Revisa los cobros del último mes; los más viejos ya tuvieron treinta
 * oportunidades de cuadrar, y el panel conserva el botón para uno concreto.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const recibido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${secreto}`;
  if (
    !secreto ||
    recibido.length !== esperado.length ||
    !timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
  ) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!pixelpayConfigurado()) {
    return Response.json({ ok: false, motivo: "PixelPay sin configurar" }, { status: 503 });
  }

  const resumen = await conciliarConPixelPay({ dias: 30 });
  console.info("PixelPay: conciliación diaria", resumen);
  return Response.json({ ok: true, ...resumen });
}
