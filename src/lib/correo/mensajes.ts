import "server-only";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { correoUtil } from "@/lib/acompanantes/cuenta";
import { formatFechaLarga } from "@/lib/format";
import { enviarCorreo } from "./enviar";
import { maqueta, esc, sitio } from "./maqueta";

/**
 * Los correos que manda la aplicación, y la lógica de a quién le tocan.
 *
 * Se usa el cliente administrador porque esto corre **después** de una acción
 * del organizador y necesita leer datos del corredor —su correo, su dorsal— que
 * la RLS no le abre al organizador fila a fila. Todo lo que sale de aquí va al
 * propio interesado, nunca a un tercero.
 */

/**
 * El QR como PNG adjunto, negro sobre blanco.
 *
 * Negro sobre blanco no es decisión estética: es la primera de las tres
 * restricciones técnicas del diseño. Un QR con módulos claros sobre fondo oscuro
 * falla en buena parte de los lectores, y este se escanea en la entrega de kits
 * con prisa y mala luz.
 *
 * Va adjunto y no incrustado por URL porque el corredor tiene que poder
 * enseñarlo **sin cobertura** en la puerta del evento; un `<img>` remoto exige
 * conexión justo cuando el recinto no la tiene.
 */
async function adjuntoQr(codigoQr: string, dorsal: number | null) {
  const buffer = await QRCode.toBuffer(codigoQr, {
    type: "png",
    width: 600,
    margin: 2, // Zona de silencio: sin ella muchos lectores no enganchan.
    color: { dark: "#000000", light: "#ffffff" },
  });
  return {
    filename: `dorsal-${dorsal ?? "runticket"}.png`,
    content: buffer.toString("base64"),
  };
}

/**
 * Avisa a los corredores de que su pago quedó confirmado, con su dorsal y su QR.
 *
 * Cubre el pago suelto y el familiar: un pago de grupo confirma varias
 * inscripciones de una vez y cada una tiene su propio dorsal, así que sale un
 * correo por persona.
 *
 * **A los acompañantes no se les escribe.** Su dirección es interna e inventada
 * —no existe buzón detrás— y `correoUtil` es quien lo sabe. De ellos responde el
 * titular, que recibe el suyo.
 */
export async function avisarPagoConfirmado(pagoId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: pago } = await admin
    .from("pagos")
    .select("id, inscripcion_id, grupo_inscripcion_id, estado")
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago || pago.estado !== "pagado") return;

  // El dorsal lo asigna un disparador al confirmarse el pago, así que a estas
  // alturas ya existe.
  let consulta = admin
    .from("inscripciones")
    .select("id, corredor_id, evento_id, numero_dorsal, codigo_qr, talla, estado");
  consulta = pago.grupo_inscripcion_id
    ? consulta.eq("grupo_inscripcion_id", pago.grupo_inscripcion_id)
    : consulta.eq("id", pago.inscripcion_id!);

  const { data: inscripciones } = await consulta.eq("estado", "activa");
  if (!inscripciones?.length) return;

  const { data: evento } = await admin
    .from("eventos")
    .select("nombre, fecha_inicio, zona_horaria, direccion")
    .eq("id", inscripciones[0].evento_id)
    .maybeSingle();
  if (!evento) return;

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombres, correo")
    .in("id", [...new Set(inscripciones.map((i) => i.corredor_id))]);
  const porId = new Map((perfiles ?? []).map((p) => [p.id, p]));

  const cuando = formatFechaLarga(evento.fecha_inicio, evento.zona_horaria);

  for (const i of inscripciones) {
    const perfil = porId.get(i.corredor_id);
    const para = correoUtil(perfil?.correo);
    if (!para || !i.codigo_qr) continue;

    const html = maqueta({
      asunto: `Tu dorsal para ${evento.nombre}`,
      preencabezado: `Dorsal ${i.numero_dorsal ?? ""} · ${cuando}`,
      titulo: "Tu pago está confirmado",
      bloques: [
        {
          tipo: "parrafo",
          texto: `${esc(perfil?.nombres ?? "Hola")}, el organizador confirmó tu pago de <strong>${esc(evento.nombre)}</strong>. Tu plaza está asegurada.`,
        },
        ...(i.numero_dorsal !== null
          ? ([{ tipo: "dato", etiqueta: "Tu dorsal", valor: String(i.numero_dorsal) }] as const)
          : []),
        { tipo: "parrafo", texto: `<strong>${esc(cuando)}</strong>${evento.direccion ? ` · ${esc(evento.direccion)}` : ""}` },
        {
          tipo: "aviso",
          texto:
            "Tu código QR va adjunto a este correo. Guárdalo en el teléfono: te lo pedirán al recoger el kit, y así lo tienes aunque no haya cobertura en el recinto.",
        },
      ],
      boton: { texto: "Ver mi inscripción", enlace: `${sitio()}/portal/inscripciones/${i.id}` },
      nota: "Si no reconoces esta inscripción, responde a este correo y lo revisamos.",
    });

    await enviarCorreo({
      para,
      asunto: `Tu dorsal para ${evento.nombre}`,
      html,
      texto: `Tu pago de ${evento.nombre} está confirmado.\nDorsal: ${i.numero_dorsal ?? "por asignar"}\nCuándo: ${cuando}\n\nTu inscripción: ${sitio()}/portal/inscripciones/${i.id}`,
      adjuntos: [await adjuntoQr(i.codigo_qr, i.numero_dorsal)],
    });
  }
}
