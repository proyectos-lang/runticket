import "server-only";
import { createHash, createHmac } from "crypto";

/**
 * Cliente mínimo de PixelPay, la pasarela del banco.
 *
 * Se habla con la API directamente en vez de usar `@pixelpay/sdk-core`: el SDK
 * está pensado para capturar la tarjeta en nuestra página (con 3DS en el
 * navegador), y aquí la tarjeta nunca pasa por RunTicket. El corredor paga en
 * la página de cobro de PixelPay y nosotros solo creamos el cobro y preguntamos
 * por él.
 *
 * Dos llamadas, las dos firmadas desde el servidor:
 *
 * · `api/v2/generate` crea el cobro y devuelve su enlace.
 * · `api/v2/transaction/status` dice si ese cobro ya está pagado. Es la única
 *   fuente de verdad: ni el aviso (webhook) ni el regreso del corredor bastan
 *   por sí solos para dar un pago por bueno.
 *
 * Documentación: https://docs.pixelpay.com/docs/es/secure-signature y el
 * artículo «Generador de Cobros vía API» del centro de ayuda de PixelPay.
 */

type Config = { endpoint: string; keyId: string; secretKey: string };

function config(): Config | null {
  const endpoint = process.env.PIXELPAY_ENDPOINT?.replace(/\/+$/, "");
  const keyId = process.env.PIXELPAY_KEY_ID;
  const secretKey = process.env.PIXELPAY_SECRET_KEY;
  if (!endpoint || !keyId || !secretKey) return null;
  return { endpoint, keyId, secretKey };
}

/** Sin credenciales no se ofrece el pago con tarjeta; el resto sigue igual. */
export function pixelpayConfigurado(): boolean {
  return config() !== null;
}

/**
 * Cabeceras de autenticación. `x-client-signature` es un HMAC SHA3-512, con la
 * llave secreta, de los campos que exige cada servicio unidos con `|`; el
 * último siempre es el endpoint del comercio.
 */
function cabeceras(c: Config, camposFirma: string[]): Record<string, string> {
  return {
    Accept: "application/json",
    "x-auth-key": c.keyId,
    "x-auth-hash": createHash("sha512").update(c.secretKey).digest("hex"),
    "x-client-signature": createHmac("sha3-512", c.secretKey)
      .update([c.keyId, ...camposFirma, c.endpoint].join("|"))
      .digest("hex"),
  };
}

/** Diez segundos: por encima, el corredor ya está mirando una pantalla colgada. */
const TIEMPO_MAXIMO_MS = 10_000;

async function llamar(c: Config, ruta: string, init: RequestInit): Promise<{ status: number; cuerpo: unknown }> {
  const respuesta = await fetch(`${c.endpoint}/${ruta}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  });
  const texto = await respuesta.text();
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto;
  }
  return { status: respuesta.status, cuerpo };
}

/** El primer mensaje legible de una respuesta de error de PixelPay. */
function mensajeDeError(cuerpo: unknown): string {
  if (cuerpo && typeof cuerpo === "object") {
    const { message, errors } = cuerpo as { message?: string; errors?: Record<string, string[]> };
    const primero = errors && Object.values(errors)[0]?.[0];
    if (primero) return primero;
    if (message) return message;
  }
  return "PixelPay no respondió como se esperaba.";
}

export type Cobro = { uuid: string; url: string };

/**
 * Crea un cobro en PixelPay y devuelve su enlace de pago.
 *
 * `orden` tiene que ser única por cobro: forma parte de la firma y es lo que
 * PixelPay muestra como número de orden.
 */
export async function crearCobro(datos: {
  orden: string;
  asunto: string;
  nombre: string;
  email: string;
  monto: number;
  moneda: string;
  /** Vuelven tal cual en el aviso de PixelPay, en el campo `extra`. */
  extras?: Record<string, string>;
}): Promise<Cobro> {
  const c = config();
  if (!c) throw new Error("PixelPay no está configurado.");

  const cuerpo = new URLSearchParams({
    order: datos.orden,
    subject: datos.asunto.slice(0, 120),
    name: datos.nombre.slice(0, 120),
    email: datos.email,
    amount: datos.monto.toFixed(2),
    currency: datos.moneda.toUpperCase(),
  });
  if (datos.extras) cuerpo.set("extras", JSON.stringify(datos.extras));

  const { status, cuerpo: respuesta } = await llamar(c, "api/v2/generate", {
    method: "POST",
    headers: cabeceras(c, [datos.orden]),
    body: cuerpo,
  });

  const r = respuesta as { success?: boolean; url?: string; payment_uuid?: string } | null;
  if (status !== 200 || !r?.success || !r.url || !r.payment_uuid) {
    throw new Error(mensajeDeError(respuesta));
  }
  return { uuid: r.payment_uuid, url: r.url };
}

/**
 * Estado de un cobro según PixelPay: `pending` mientras nadie lo pague, `paid`
 * cuando se cobró. Cualquier otro valor se trata como «no pagado».
 */
export async function estadoDelCobro(uuid: string): Promise<string> {
  const c = config();
  if (!c) throw new Error("PixelPay no está configurado.");

  const { status, cuerpo } = await llamar(c, "api/v2/transaction/status", {
    method: "POST",
    headers: { ...cabeceras(c, [uuid]), "Content-Type": "application/json" },
    body: JSON.stringify({ payment_uuid: uuid }),
  });

  const r = cuerpo as { success?: boolean; data?: { status?: string } } | null;
  if (status !== 200 || !r?.success || !r.data?.status) {
    throw new Error(mensajeDeError(cuerpo));
  }
  return r.data.status;
}
