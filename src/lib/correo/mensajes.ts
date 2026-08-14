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

/** Datos del evento que necesitan todos los correos. */
async function cargarEvento(admin: ReturnType<typeof createAdminClient>, eventoId: string) {
  const { data } = await admin
    .from("eventos")
    .select("nombre, fecha_inicio, zona_horaria, direccion, moneda")
    .eq("id", eventoId)
    .maybeSingle();
  return data;
}

/**
 * Acuse de la inscripción, recién hecha y antes de pagar.
 *
 * **Un solo correo por operación, no uno por persona.** Una familia se inscribe
 * de una vez y paga de una vez; cuatro correos idénticos al mismo buzón se leen
 * como un fallo del sistema. Se escribe a quien hizo la inscripción, que es
 * quien responde del pago, y se le enumeran los inscritos.
 *
 * No lleva dorsal ni QR: todavía no existen. El dorsal se asigna al confirmarse
 * el pago, y ese es otro correo.
 */
export async function avisarInscripcionRecibida(inscripcionIds: string[]): Promise<void> {
  if (!inscripcionIds.length) return;
  const admin = createAdminClient();

  const { data: inscripciones } = await admin
    .from("inscripciones")
    .select("id, corredor_id, evento_id, categoria_id, precio_pagado, moneda, grupo_inscripcion_id, created_by")
    .in("id", inscripcionIds)
    .eq("estado", "activa");
  if (!inscripciones?.length) return;

  const evento = await cargarEvento(admin, inscripciones[0].evento_id);
  if (!evento) return;

  /**
   * Sin costo no hay nada que coordinar: el disparador ya asignó los dorsales al
   * insertar, así que en vez del acuse «falta pagar» va directamente el correo
   * con el dorsal y el QR de cada uno.
   *
   * Se mira el importe y no si la categoría es gratuita, para que un cupón del
   * 100 % caiga por el mismo camino: el criterio es el mismo que usa la base.
   */
  if (inscripciones.every((i) => Number(i.precio_pagado) === 0)) {
    await avisarDorsalListo(inscripciones.map((i) => i.id), "gratis");
    return;
  }

  // El destinatario es quien hizo la operación; con acompañantes, el titular.
  const titularId = inscripciones[0].created_by ?? inscripciones[0].corredor_id;
  const { data: titular } = await admin
    .from("perfiles")
    .select("nombres, correo")
    .eq("id", titularId)
    .maybeSingle();
  const para = correoUtil(titular?.correo);
  if (!para) return;

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombres, apellidos")
    .in("id", [...new Set(inscripciones.map((i) => i.corredor_id))]);
  const { data: categorias } = await admin
    .from("categorias")
    .select("id, nombre")
    .in("id", [...new Set(inscripciones.map((i) => i.categoria_id))]);

  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim()]));
  const nombreCat = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  const quienes = inscripciones
    .map((i) => `${esc(nombrePerfil.get(i.corredor_id) ?? "Corredor")} — ${esc(nombreCat.get(i.categoria_id) ?? "")}`)
    .join("<br />");
  const total = inscripciones.reduce((a, i) => a + Number(i.precio_pagado), 0);
  const cuando = formatFechaLarga(evento.fecha_inicio, evento.zona_horaria);
  const varias = inscripciones.length > 1;

  // Con grupo, el pago vive en la ficha de la familia; suelta, en la suya.
  const destino = inscripciones[0].grupo_inscripcion_id
    ? `${sitio()}/portal/grupos/${inscripciones[0].grupo_inscripcion_id}`
    : `${sitio()}/portal/inscripciones/${inscripciones[0].id}`;

  const asunto = `Inscripción recibida · ${evento.nombre}`;
  await enviarCorreo({
    para,
    asunto,
    html: maqueta({
      asunto,
      preencabezado: `${varias ? `${inscripciones.length} inscripciones` : "Tu inscripción"} · falta coordinar el pago`,
      titulo: varias ? "Inscripciones recibidas" : "Estás inscrito",
      bloques: [
        {
          tipo: "parrafo",
          texto: `${esc(titular?.nombres ?? "Hola")}, guardamos ${varias ? "vuestras plazas" : "tu plaza"} en <strong>${esc(evento.nombre)}</strong>, el ${esc(cuando)}.`,
        },
        { tipo: "aviso", texto: quienes },
        {
          tipo: "dato",
          etiqueta: varias ? "Total a pagar" : "A pagar",
          valor: `${evento.moneda} ${total.toFixed(2)}`,
        },
        {
          tipo: "parrafo",
          texto:
            "<strong>Todavía falta el pago.</strong> Hasta que el organizador lo confirme no se asigna el dorsal. Desde el botón de abajo puedes coordinarlo por WhatsApp o subir tu comprobante de transferencia.",
        },
      ],
      boton: { texto: varias ? "Pagar la inscripción" : "Completar mi pago", enlace: destino },
    }),
    texto: `Inscripción recibida en ${evento.nombre} (${cuando}).\nTotal: ${evento.moneda} ${total.toFixed(2)}\nFalta coordinar el pago: ${destino}`,
  });
}

/**
 * Avisa de que el organizador rechazó el comprobante, con su motivo.
 *
 * Cierra el requisito 4.5. Hasta ahora el motivo solo se veía entrando al
 * portal, así que quien subía un comprobante borroso no se enteraba de que había
 * que repetirlo hasta que le extrañaba no tener dorsal.
 */
export async function avisarPagoRechazado(pagoId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: pago } = await admin
    .from("pagos")
    .select("id, inscripcion_id, grupo_inscripcion_id, estado, notas")
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago || pago.estado !== "rechazado") return;

  let consulta = admin.from("inscripciones").select("id, corredor_id, evento_id, grupo_inscripcion_id");
  consulta = pago.grupo_inscripcion_id
    ? consulta.eq("grupo_inscripcion_id", pago.grupo_inscripcion_id)
    : consulta.eq("id", pago.inscripcion_id!);
  const { data: inscripciones } = await consulta.eq("estado", "activa");
  if (!inscripciones?.length) return;

  const evento = await cargarEvento(admin, inscripciones[0].evento_id);
  if (!evento) return;

  // Un rechazo es del pago, no de cada persona: se escribe una sola vez.
  const { data: perfil } = await admin
    .from("perfiles")
    .select("nombres, correo")
    .eq("id", inscripciones[0].corredor_id)
    .maybeSingle();
  const para = correoUtil(perfil?.correo);
  if (!para) return;

  const destino = pago.grupo_inscripcion_id
    ? `${sitio()}/portal/grupos/${pago.grupo_inscripcion_id}`
    : `${sitio()}/portal/inscripciones/${inscripciones[0].id}`;

  const asunto = `Revisa tu pago de ${evento.nombre}`;
  await enviarCorreo({
    para,
    asunto,
    html: maqueta({
      asunto,
      preencabezado: "El organizador no pudo dar por bueno tu comprobante",
      titulo: "Tu pago necesita otra revisión",
      bloques: [
        {
          tipo: "parrafo",
          texto: `${esc(perfil?.nombres ?? "Hola")}, el organizador de <strong>${esc(evento.nombre)}</strong> no pudo dar por bueno tu comprobante.`,
        },
        ...(pago.notas
          ? ([{ tipo: "aviso", texto: `<strong>Motivo:</strong> ${esc(pago.notas)}` }] as const)
          : []),
        {
          tipo: "parrafo",
          texto:
            "Tu plaza sigue reservada. Sube un comprobante nuevo o coordina el pago por WhatsApp desde tu inscripción.",
        },
      ],
      boton: { texto: "Revisar mi pago", enlace: destino },
    }),
    texto: `El organizador no pudo dar por bueno tu comprobante de ${evento.nombre}.${pago.notas ? `\nMotivo: ${pago.notas}` : ""}\n\nTu plaza sigue reservada: ${destino}`,
  });
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
  let consulta = admin.from("inscripciones").select("id");
  consulta = pago.grupo_inscripcion_id
    ? consulta.eq("grupo_inscripcion_id", pago.grupo_inscripcion_id)
    : consulta.eq("id", pago.inscripcion_id!);

  const { data: suyas } = await consulta.eq("estado", "activa");
  await avisarDorsalListo((suyas ?? []).map((i) => i.id), "pago_confirmado");
}

/**
 * Manda a cada corredor su dorsal y su QR.
 *
 * Se llega aquí por **dos caminos** y por eso está separado del pago:
 *
 *  - `pago_confirmado`: el organizador dio el cobro por bueno y el disparador
 *    asignó el dorsal.
 *  - `gratis`: la inscripción no costaba nada, así que
 *    `auto_asignar_dorsal_gratis` (migración 0005) le puso dorsal en el mismo
 *    instante de crearse. **Aquí no hay ni habrá fila en `pagos`**, así que sin
 *    este camino el corredor de una carrera sin costo se quedaba sin su QR: era
 *    el único que no recibía nada.
 *
 * Lo único que cambia entre los dos es cómo se explica; el dorsal, el QR y el
 * enlace son los mismos.
 */
export async function avisarDorsalListo(
  inscripcionIds: string[],
  motivo: "pago_confirmado" | "gratis"
): Promise<void> {
  if (!inscripcionIds.length) return;
  const admin = createAdminClient();

  const { data: inscripciones } = await admin
    .from("inscripciones")
    .select("id, corredor_id, evento_id, numero_dorsal, codigo_qr, talla, estado")
    .in("id", inscripcionIds)
    .eq("estado", "activa");
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
      titulo: motivo === "gratis" ? "Ya estás dentro" : "Tu pago está confirmado",
      bloques: [
        {
          tipo: "parrafo",
          texto:
            motivo === "gratis"
              ? `${esc(perfil?.nombres ?? "Hola")}, tu inscripción a <strong>${esc(evento.nombre)}</strong> está lista. Esta carrera no tiene costo, así que no hay nada más que hacer.`
              : `${esc(perfil?.nombres ?? "Hola")}, el organizador confirmó tu pago de <strong>${esc(evento.nombre)}</strong>. Tu plaza está asegurada.`,
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
      texto: `${motivo === "gratis" ? `Tu inscripción a ${evento.nombre} está lista; esta carrera no tiene costo.` : `Tu pago de ${evento.nombre} está confirmado.`}\nDorsal: ${i.numero_dorsal ?? "por asignar"}\nCuándo: ${cuando}\n\nTu inscripción: ${sitio()}/portal/inscripciones/${i.id}`,
      adjuntos: [await adjuntoQr(i.codigo_qr, i.numero_dorsal)],
    });
  }
}
