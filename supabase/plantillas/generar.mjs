/**
 * Genera las plantillas de correo de autenticación.
 *
 * Los tres correos comparten cabecera, tipografía, botón y pie. El panel de
 * Supabase no admite parciales ni includes: cada plantilla tiene que ser un HTML
 * completo y autónomo. Mantener tres copias a mano garantiza que se separen en
 * cuanto alguien toque una, así que la estructura vive **aquí una sola vez** y
 * los `.html` se generan.
 *
 *   node supabase/plantillas/generar.mjs
 *
 * Los .html generados se versionan igualmente: son lo que se pega en el panel.
 *
 * Por qué el HTML está escrito «a la antigua» —tablas, estilos en línea, sin
 * flexbox—: Outlook renderiza con el motor de Word. Y el botón es una tabla con
 * fondo, no un <a> con relleno, porque Outlook recorta el relleno de los enlaces
 * y el botón quedaría convertido en una línea de texto suelta.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

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

function plantilla({ asunto, preencabezado, titulo, parrafos, boton, enlace, nota, despedida }) {
  const cuerpo = parrafos
    .map(
      (p, i) =>
        `<p style="margin:0 0 ${i === parrafos.length - 1 ? 28 : 16}px; font-family:${SANS}; font-size:16px; line-height:1.6; color:${i === 0 ? C.texto : C.atenuado};">
                  ${p}
                </p>`
    )
    .join("\n                ");

  return `<!--
  RunTicket HN · ${asunto}

  GENERADO por supabase/plantillas/generar.mjs — no editar a mano.
  Cambia el generador y vuelve a ejecutarlo, o los tres correos se separarán.

  Se pega en Supabase → Authentication → Emails. El asunto va en su campo:
  ${asunto}
-->
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${asunto}</title>
    <style>
      /* Solo lo que no cabe en línea. Quien las ignore se queda con los
         atributos, que ya dan un resultado correcto. */
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
    <!-- Preencabezado: es el texto que acompaña al asunto en la bandeja de
         entrada. Aquí pesa más de lo normal, porque el remitente aparece como
         «Supabase Auth» y esto es lo único que dice de quién viene el correo. -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${preencabezado}
      ${RELLENO}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.fondo}" style="background-color:${C.fondo};">
      <tr>
        <td align="center" style="padding:32px 12px;">

          <table role="presentation" class="contenedor" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${C.superficie}; border-radius:14px; overflow:hidden;">

            <tr>
              <td align="center" bgcolor="${C.superficie}" style="background-color:${C.superficie}; padding:30px 24px 24px;">
                <img class="logo" src="{{ .SiteURL }}/logo-correo.png" width="240" alt="RunTicket HN" style="display:block; width:240px; max-width:70%; height:auto; border:0; outline:none; text-decoration:none;" />
              </td>
            </tr>

            <!-- Franja de marca: da color aunque el cliente bloquee la imagen. -->
            <tr>
              <td height="4" bgcolor="${C.naranja}" style="background-color:${C.naranja}; height:4px; line-height:4px; font-size:0;">&nbsp;</td>
            </tr>

            <tr>
              <td class="relleno" style="padding:38px 36px 0;">
                <h1 class="titulo" style="margin:0 0 20px; font-family:${DISPLAY}; font-size:30px; line-height:1.15; font-weight:bold; font-style:italic; color:${C.texto};">
                  ${titulo}
                </h1>
                ${cuerpo}
              </td>
            </tr>

            <tr>
              <td class="relleno" align="center" style="padding:0 36px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="${C.naranja}" style="background-color:${C.naranja}; border-radius:999px;">
                      <a href="${enlace}"
                         style="display:inline-block; padding:16px 40px; font-family:${SANS}; font-size:16px; font-weight:bold; line-height:1; color:${C.tinta}; text-decoration:none; border-radius:999px;">
                        ${boton}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Respaldo: hay clientes y filtros corporativos que desactivan los
                 botones, y sin esto el correo se queda sin salida. -->
            <tr>
              <td class="relleno" style="padding:0 36px 28px;">
                <p style="margin:0 0 8px; font-family:${SANS}; font-size:13px; line-height:1.5; color:${C.mudo};">
                  ¿No funciona el botón? Copia y pega esta dirección en tu navegador:
                </p>
                <p style="margin:0; font-family:'Courier New', monospace; font-size:12px; line-height:1.5; color:${C.naranjaSuave}; word-break:break-all;">
                  ${enlace}
                </p>
              </td>
            </tr>

            <tr>
              <td class="relleno" style="padding:0 36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td height="1" bgcolor="${C.linea}" style="background-color:${C.linea}; height:1px; line-height:1px; font-size:0;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="relleno" style="padding:24px 36px 34px;">
                <p style="margin:0 0 20px; font-family:${SANS}; font-size:13px; line-height:1.6; color:${C.mudo};">
                  ${nota}
                </p>
                <p style="margin:0; font-family:${SANS}; font-size:15px; line-height:1.6; color:${C.texto};">
                  ${despedida}<br />
                  <strong style="color:${C.naranjaSuave};">Equipo RunTicket HN</strong>
                </p>
              </td>
            </tr>
          </table>

          <table role="presentation" class="contenedor" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">
            <tr>
              <td align="center" style="padding:22px 24px 8px;">
                <p style="margin:0; font-family:${SANS}; font-size:12px; line-height:1.6; color:${C.mudo};">
                  RunTicket HN — Inscripciones para corredores y eventos deportivos.
                </p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/**
 * `{{ .TokenHash }}` en vez de `{{ .ConfirmationURL }}`: el enlace por defecto
 * depende de una cookie que solo existe en el navegador donde se originó la
 * acción, así que abrir el correo en el móvil habiendo empezado en el portátil
 * falla. Con el token verificable la ruta funciona desde cualquier dispositivo.
 */
const enlaceDe = (tipo, destino) =>
  `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=${tipo}&next=${destino}`;

const CORREOS = [
  {
    archivo: "confirmacion.html",
    asunto: "Confirma tu cuenta en RunTicket HN",
    preencabezado: "Confirma tu correo y empieza a inscribirte en tus próximas carreras.",
    titulo: "¡Ya casi estás en la meta!",
    parrafos: [
      "Hola, corredor:",
      "Gracias por registrarte en RunTicket HN. Para activar tu cuenta y comenzar a inscribirte en tus próximas carreras, confirma tu correo electrónico haciendo clic en el siguiente botón.",
    ],
    boton: "Confirmar mi correo",
    enlace: enlaceDe("signup", "/bienvenida"),
    nota: "Si no creaste esta cuenta, puedes ignorar este mensaje.",
    despedida: "Nos vemos en la próxima meta.",
  },
  {
    archivo: "recuperacion.html",
    asunto: "Recupera tu contraseña de RunTicket HN",
    preencabezado: "Elige una contraseña nueva y vuelve a la carrera.",
    titulo: "Vamos a recuperar el ritmo",
    parrafos: [
      "Hola, corredor:",
      "Recibimos una solicitud para cambiar la contraseña de tu cuenta en RunTicket HN. Pulsa el botón para elegir una nueva. El enlace caduca en una hora.",
    ],
    boton: "Cambiar mi contraseña",
    enlace: enlaceDe("recovery", "/actualizar-password"),
    nota: "Si no pediste este cambio, ignora este mensaje: tu contraseña actual sigue funcionando.",
    despedida: "Nos vemos en la próxima meta.",
  },
  {
    archivo: "invitacion.html",
    asunto: "Te invitaron a organizar carreras en RunTicket HN",
    preencabezado: "Activa tu acceso al panel del organizador.",
    titulo: "Te esperan en la línea de salida",
    parrafos: [
      "Hola:",
      "Te invitaron a formar parte de un equipo organizador en RunTicket HN. Desde el panel podrás publicar carreras, gestionar inscripciones y entregar kits el día del evento.",
      "Pulsa el botón para activar tu acceso y elegir tu contraseña.",
    ],
    boton: "Activar mi acceso",
    enlace: enlaceDe("invite", "/panel"),
    nota: "Si no esperabas esta invitación, puedes ignorar este mensaje.",
    despedida: "Nos vemos en la próxima meta.",
  },
];

for (const correo of CORREOS) {
  writeFileSync(join(AQUI, correo.archivo), plantilla(correo), "utf8");
  console.log(`  ${correo.archivo.padEnd(20)} ${correo.asunto}`);
}
