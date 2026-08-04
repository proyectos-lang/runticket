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
  /** PNG en data URL, tal como sale del canvas de firma. */
  firmaPng?: string | null;
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

  if (datos.firmaPng?.startsWith("data:image/png;base64,")) {
    const png = await pdf.embedPng(datos.firmaPng);
    const escala = Math.min(180 / png.width, 70 / png.height);
    const w = png.width * escala;
    const h = png.height * escala;
    nuevaPaginaSiHaceFalta(h + 30);
    pagina.drawImage(png, { x: MARGEN, y: y - h, width: w, height: h });
    y -= h + 6;
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: MARGEN + 200, y },
      thickness: 0.75,
      color: rgb(0.6, 0.6, 0.65),
    });
    y -= 14;
    escribir("Firma del participante", { tamano: 9, espacio: 8 });
  } else {
    escribir("Aceptado mediante confirmación electrónica (casilla de aceptación).", {
      tamano: 9,
      espacio: 8,
    });
  }

  y -= 8;
  escribir("Constancia de aceptación", { tamano: 10, fuente: negrita, espacio: 6 });
  escribir(
    `Firmado el ${datos.firmadoEn.toISOString()} · IP ${datos.ip ?? "no registrada"} · Dispositivo: ${
      datos.dispositivo ?? "no registrado"
    }`,
    { tamano: 8, espacio: 4, color: rgb(0.4, 0.4, 0.45) }
  );

  return pdf.save();
}
