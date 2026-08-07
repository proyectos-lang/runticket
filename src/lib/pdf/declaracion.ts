import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DatosDeclaracion = {
  evento: string;
  empresa: string;
  fechaEvento: string;
  categoria: string;
  corredor: string;
  documento?: string | null;
  correo: string;
  version: number;
  contenido: string;
  firmadoEn: Date;
  ip?: string | null;
  dispositivo?: string | null;
  tutorNombre?: string | null;
  tutorDocumento?: string | null;
};

const MARGEN = 56;
const ANCHO = 595.28; // A4 vertical
const ALTO = 841.89;

/**
 * pdf-lib no hace saltos de línea: hay que medir cada palabra y cortar a mano.
 */
function envolver(texto: string, fuente: import("pdf-lib").PDFFont, tamano: number, ancho: number) {
  const lineas: string[] = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    if (!parrafo.trim()) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      const tentativa = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(tentativa, tamano) > ancho && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = tentativa;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

export async function generarPdfDeclaracion(datos: DatosDeclaracion): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;
  const anchoUtil = ANCHO - MARGEN * 2;

  const nuevaPaginaSiHaceFalta = (alto: number) => {
    if (y - alto < MARGEN) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
    }
  };

  const escribir = (
    texto: string,
    { tamano = 10, fuente = normal, espacio = 4, color = rgb(0.1, 0.1, 0.12) } = {}
  ) => {
    for (const linea of envolver(texto, fuente, tamano, anchoUtil)) {
      nuevaPaginaSiHaceFalta(tamano + espacio);
      if (linea) pagina.drawText(linea, { x: MARGEN, y, size: tamano, font: fuente, color });
      y -= tamano + espacio;
    }
  };

  escribir("DECLARACIÓN DE SALUD Y DESLINDE DE RESPONSABILIDAD", { tamano: 14, fuente: negrita, espacio: 10 });
  escribir(`${datos.empresa} · ${datos.evento}`, { tamano: 10, fuente: negrita, espacio: 12 });

  escribir(`Evento: ${datos.evento}`);
  escribir(`Fecha del evento: ${datos.fechaEvento}`);
  escribir(`Categoría: ${datos.categoria}`);
  escribir(`Participante: ${datos.corredor}`);
  if (datos.documento) escribir(`Documento de identidad: ${datos.documento}`);
  escribir(`Correo: ${datos.correo}`);
  if (datos.tutorNombre) {
    escribir(`Tutor responsable: ${datos.tutorNombre}${datos.tutorDocumento ? ` (${datos.tutorDocumento})` : ""}`);
  }
  y -= 10;

  escribir(`Texto de la declaración (versión ${datos.version})`, { tamano: 11, fuente: negrita, espacio: 8 });
  escribir(datos.contenido, { tamano: 10, espacio: 5 });
  y -= 16;

  /**
   * La constancia de aceptación, que es **la prueba** del documento.
   *
   * Antes aquí iba un trazo dibujado con el dedo. No probaba nada —no se coteja
   * con ninguna firma registrada y cualquiera puede garabatearlo— y durante un
   * tiempo se guardó en blanco sin que nadie lo notara. Lo que sí sostiene el
   * consentimiento es el acto y su rastro, así que va completo, enmarcado y con
   * la fecha en formato legible además del sello técnico.
   */
  const quienAcepta = datos.tutorNombre
    ? `${datos.tutorNombre}${datos.tutorDocumento ? `, documento ${datos.tutorDocumento},` : ""} como tutor de ${datos.corredor}`
    : `${datos.corredor}${datos.documento ? `, documento ${datos.documento},` : ""}`;

  const fechaLegible = new Intl.DateTimeFormat("es-HN", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "America/Tegucigalpa",
  }).format(datos.firmadoEn);

  const bloques: { texto: string; tamano: number; espacio: number; negrita?: boolean; gris?: boolean }[] = [
    { texto: "Constancia de aceptación electrónica", tamano: 11, espacio: 8, negrita: true },
    {
      texto:
        `${quienAcepta} declaró haber leído y aceptado íntegramente la versión ${datos.version} ` +
        `de este documento, y participa bajo su propia responsabilidad.`,
      tamano: 9.5,
      espacio: 8,
    },
    { texto: `Aceptado el ${fechaLegible} (hora de Honduras).`, tamano: 9, espacio: 6 },
    {
      texto:
        `Sello técnico — ${datos.firmadoEn.toISOString()} · IP ${datos.ip ?? "no registrada"} · ` +
        `Dispositivo: ${datos.dispositivo ?? "no registrado"}`,
      tamano: 7.5,
      espacio: 4,
      gris: true,
    },
  ];

  // El alto se mide, no se supone: con un nombre largo o un `user-agent` de los
  // que ocupan tres líneas, un recuadro de alto fijo se quedaba corto y el texto
  // salía por debajo del marco.
  const alturaCaja =
    bloques.reduce(
      (alto, b) =>
        alto +
        envolver(b.texto, b.negrita ? negrita : normal, b.tamano, anchoUtil).length *
          (b.tamano + b.espacio),
      0
    ) + 18;

  y -= 6;
  // Entera o en la página siguiente: partida por la mitad no se lee como una
  // constancia, que es justo lo que tiene que parecer.
  nuevaPaginaSiHaceFalta(alturaCaja + 12);

  pagina.drawRectangle({
    x: MARGEN - 8,
    y: y - alturaCaja,
    width: anchoUtil + 16,
    height: alturaCaja,
    borderColor: rgb(0.75, 0.75, 0.8),
    borderWidth: 0.75,
  });
  y -= 14;

  for (const b of bloques) {
    escribir(b.texto, {
      tamano: b.tamano,
      espacio: b.espacio,
      fuente: b.negrita ? negrita : normal,
      ...(b.gris ? { color: rgb(0.4, 0.4, 0.45) } : {}),
    });
  }

  return pdf.save();
}
