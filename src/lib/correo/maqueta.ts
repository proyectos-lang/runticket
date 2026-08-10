import "server-only";

/**
 * El armazón visual de los correos que envía **la aplicación**.
 *
 * Es hermano de `supabase/plantillas/generar.mjs`, que hace lo mismo para los
 * tres correos de autenticación, y el parecido es deliberado: quien recibe la
 * confirmación de su cuenta y después el correo con su dorsal tiene que ver la
 * misma marca, no dos productos distintos.
 *
 * **Por qué son dos archivos y no uno.** Tienen consumidores incompatibles: el
 * panel de Supabase solo acepta HTML completo y estático, así que aquel genera
 * `.html` que se pegan a mano; estos se componen en cada envío con los datos de
 * un corredor concreto. Un módulo común obligaría a que un script de Node
 * importara TypeScript, que en este proyecto significa añadir tooling. Si tocas
 * los colores o la cabecera, **hay que tocar los dos**.
 *
 * El HTML va «a la antigua» —tablas, estilos en línea, sin flexbox— por el mismo
 * motivo que allí: Outlook renderiza con el motor de Word. Y el botón es una
 * tabla con fondo, no un `<a>` con relleno, porque Outlook recorta el relleno de
 * los enlaces y el botón quedaría convertido en texto suelto.
 */

/** Los mismos valores que `src/app/globals.css`, para que no se separen. */
const C = {
  fondo: "#07080a",
  superficie: "#0e1116",
  linea: "#232936",
  texto: "#f3f4f6",
  atenuado: "rgba(243,244,246,0.72)",
  mudo: "rgba(243,244,246,0.42)",
  naranja: "#ff6a1a",
  naranjaSuave: "#ff8a45",
  tinta: "#0b0500",
};

const SANS = "'Segoe UI', Arial, sans-serif";
const DISPLAY = "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";

/** Relleno del preencabezado: separa el texto de la vista previa del contenido. */
const RELLENO = "&#8199;&#65279;&#847; ".repeat(8);

export const sitio = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Escapa lo que venga de la base: un nombre con `<` rompería el HTML del correo. */
export function esc(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type Bloque =
  /** Párrafo. El primero va en tono fuerte; los siguientes, atenuados. */
  | { tipo: "parrafo"; texto: string }
  /** Dato destacado en grande: un dorsal, un importe. */
  | { tipo: "dato"; etiqueta: string; valor: string }
  /** Aviso enmarcado, para lo que hay que leer sí o sí. */
  | { tipo: "aviso"; texto: string };

export function maqueta({
  asunto,
  preencabezado,
  titulo,
  bloques,
  boton,
  nota,
}: {
  asunto: string;
  /** Lo que acompaña al asunto en la bandeja: la segunda oportunidad de que lo abran. */
  preencabezado: string;
  titulo: string;
  bloques: Bloque[];
  boton?: { texto: string; enlace: string };
  nota?: string;
}): string {
  const cuerpo = bloques
    .map((b, i) => {
      if (b.tipo === "parrafo") {
        return `<p style="margin:0 0 16px; font-family:${SANS}; font-size:16px; line-height:1.6; color:${i === 0 ? C.texto : C.atenuado};">${b.texto}</p>`;
      }
      if (b.tipo === "dato") {
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
                  <tr><td style="font-family:${SANS}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:${C.mudo}; padding-bottom:4px;">${b.etiqueta}</td></tr>
                  <tr><td style="font-family:${DISPLAY}; font-size:34px; font-weight:bold; color:${C.texto};">${b.valor}</td></tr>
                </table>`;
      }
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px; border:1px solid ${C.linea}; border-radius:8px;">
                <tr><td style="padding:14px 18px; font-family:${SANS}; font-size:14px; line-height:1.6; color:${C.atenuado};">${b.texto}</td></tr>
              </table>`;
    })
    .join("\n                ");

  const botonHtml = boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 8px;">
                  <tr>
                    <td align="center" bgcolor="${C.naranja}" style="border-radius:6px;">
                      <a href="${boton.enlace}" style="display:inline-block; padding:14px 30px; font-family:${SANS}; font-size:15px; font-weight:bold; text-transform:uppercase; letter-spacing:0.6px; color:${C.tinta}; text-decoration:none;">${boton.texto}</a>
                    </td>
                  </tr>
                </table>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${esc(asunto)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .contenedor { width: 100% !important; }
        .relleno { padding-left: 22px !important; padding-right: 22px !important; }
        .titulo { font-size: 26px !important; }
        .logo { width: 200px !important; }
      }
      a { color: ${C.naranjaSuave}; }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${C.fondo}; -webkit-font-smoothing:antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${esc(preencabezado)}
      ${RELLENO}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fondo}" style="background-color:${C.fondo};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" class="contenedor" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
            <tr>
              <td align="left" style="padding:0 0 22px;">
                <img class="logo" src="${sitio()}/logo-correo.png" width="240" height="40" alt="RunTicket HN" style="display:block; border:0; width:240px; height:auto;" />
              </td>
            </tr>
            <!-- Franja naranja: mantiene la marca aunque el cliente bloquee las
                 imágenes, cosa que Gmail hace por defecto con remitentes nuevos. -->
            <tr><td style="height:3px; background-color:${C.naranja}; font-size:0; line-height:0;">&nbsp;</td></tr>
            <tr>
              <td class="relleno" bgcolor="${C.superficie}" style="background-color:${C.superficie}; padding:34px 38px; border:1px solid ${C.linea}; border-top:0;">
                <h1 class="titulo" style="margin:0 0 20px; font-family:${DISPLAY}; font-size:30px; line-height:1.15; font-weight:bold; color:${C.texto};">
                  ${esc(titulo)}
                </h1>
                ${cuerpo}
                ${botonHtml}
              </td>
            </tr>
            <tr>
              <td class="relleno" style="padding:20px 38px 0;">
                <p style="margin:0; font-family:${SANS}; font-size:12px; line-height:1.6; color:${C.mudo};">
                  ${nota ? `${esc(nota)}<br /><br />` : ""}
                  Recibes este correo porque tienes una inscripción en RunTicket HN.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
