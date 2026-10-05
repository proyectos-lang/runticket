/**
 * Cómo contacta con RunTicket quien quiere organizar carreras.
 *
 * Es el mismo número con el que se coordinan los comprobantes de pago en «Mi
 * empresa». Se puede cambiar sin tocar código con la variable
 * `NEXT_PUBLIC_WHATSAPP_PLATAFORMA` (solo dígitos, con el código de país).
 */
export const WHATSAPP_PLATAFORMA = (process.env.NEXT_PUBLIC_WHATSAPP_PLATAFORMA ?? "+504 9999-0000").trim();

/** Enlace wa.me con el mensaje ya escrito. */
export function enlaceWhatsAppPlataforma(mensaje: string): string {
  return `https://wa.me/${WHATSAPP_PLATAFORMA.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(mensaje)}`;
}

export const MENSAJE_ORGANIZADOR =
  "Hola, organizo carreras y quiero dar de alta mi empresa en RunTicket HN.";
