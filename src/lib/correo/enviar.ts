import "server-only";

/**
 * Envío de correo transaccional, contra Resend.
 *
 * **Va con `fetch` y no con el SDK a propósito.** La API de Resend es un solo
 * POST con un JSON; el paquete `resend` traería un árbol de dependencias entero
 * para ahorrar quince líneas, en un proyecto que ya arrastra ocho avisos de
 * seguridad de npm. Si algún día hacen falta lotes o webhooks, se replantea.
 *
 * **Nunca lanza.** Es la propiedad más importante de este módulo: el correo
 * cuelga de acciones como confirmar un pago, y un fallo del proveedor no puede
 * deshacer un cobro ya registrado ni dejar al organizador con una pantalla de
 * error después de que el dinero se haya dado por bueno. Devuelve el resultado y
 * lo registra; quien llama decide si le importa.
 *
 * Sin `RESEND_API_KEY` no envía y lo dice. Así el proyecto arranca y compila en
 * un portátil sin credenciales, que es como se ha desarrollado hasta ahora, en
 * vez de reventar en cada acción que toque correo.
 */

const API = "https://api.resend.com/emails";

export type Adjunto = {
  filename: string;
  /** Contenido en base64, tal como lo espera la API. */
  content: string;
};

export type ResultadoEnvio =
  | { enviado: true; id: string }
  | { enviado: false; motivo: "sin_configurar" | "error"; detalle?: string };

/**
 * De quién sale el correo.
 *
 * Tiene que ser una dirección del dominio verificado en Resend, con sus
 * registros SPF y DKIM publicados. Con cualquier otra, Resend rechaza el envío
 * —no lo manda «como pueda»—, y es la comprobación que evita que el correo de
 * RunTicket acabe en spam por firmar con un dominio que no es suyo.
 */
const REMITENTE = process.env.CORREO_REMITENTE ?? "RunTicket HN <no-reply@runtickethn.com>";

export async function enviarCorreo(mensaje: {
  para: string;
  asunto: string;
  html: string;
  /** Alternativa en texto plano. Mejora la entregabilidad y los lectores viejos. */
  texto?: string;
  adjuntos?: Adjunto[];
}): Promise<ResultadoEnvio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.warn(
      `[correo] Sin RESEND_API_KEY: no se envió «${mensaje.asunto}» a ${mensaje.para}.`
    );
    return { enviado: false, motivo: "sin_configurar" };
  }

  try {
    const respuesta = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        ...(mensaje.texto ? { text: mensaje.texto } : {}),
        ...(mensaje.adjuntos?.length ? { attachments: mensaje.adjuntos } : {}),
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error(`[correo] Resend devolvió ${respuesta.status} para ${mensaje.para}: ${detalle}`);
      return { enviado: false, motivo: "error", detalle };
    }

    const { id } = (await respuesta.json()) as { id: string };
    return { enviado: true, id };
  } catch (e) {
    // Corte de red, DNS, timeout. Se registra y se sigue: ver la nota de arriba.
    const detalle = e instanceof Error ? e.message : "error desconocido";
    console.error(`[correo] No se pudo contactar con Resend para ${mensaje.para}: ${detalle}`);
    return { enviado: false, motivo: "error", detalle };
  }
}
