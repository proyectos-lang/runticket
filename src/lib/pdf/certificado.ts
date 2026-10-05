import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type DatosCertificado = {
  corredor: string;
  evento: string;
  categoria: string;
  fechaEvento: string;
  empresa: string;
  /** Ya formateado (h:mm:ss); si no hubo cronometraje se omite. */
  tiempo?: string | null;
  posicionGeneral?: number | null;
  posicionCategoria?: number | null;
  patrocinadores?: string[];
};

// A4 apaisado, como se espera de un diploma.
const ANCHO = 841.89;
const ALTO = 595.28;

/**
 * Colores de la marca, los mismos de la interfaz. El certificado se imprime,
 * así que el papel es claro; la identidad la ponen la franja oscura de arriba,
 * el naranja y el azul del «HN».
 */
const TINTA = rgb(0.055, 0.067, 0.086); // #0e1116
const NARANJA = rgb(1, 0.416, 0.102); // #ff6a1a
const AZUL = rgb(0.184, 0.42, 1); // #2f6bff
const GRIS = rgb(0.45, 0.46, 0.5);
const GRIS_CLARO = rgb(0.86, 0.87, 0.89);

export async function generarPdfCertificado(datos: DatosCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado · ${datos.evento}`);
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cursivaNegrita = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

  const centrar = (texto: string, fuente: typeof normal, tamano: number) =>
    (ANCHO - fuente.widthOfTextAtSize(texto, tamano)) / 2;

  const escribirCentrado = (texto: string, y: number, tamano: number, fuente = normal, color = TINTA) => {
    pagina.drawText(texto, { x: centrar(texto, fuente, tamano), y, size: tamano, font: fuente, color });
  };

  // Franja oscura con la marca, como la cabecera de la aplicación.
  pagina.drawRectangle({ x: 0, y: ALTO - 78, width: ANCHO, height: 78, color: TINTA });
  pagina.drawRectangle({ x: 0, y: ALTO - 82, width: ANCHO, height: 4, color: NARANJA });
  const marca = [
    { texto: "Run", fuente: cursivaNegrita, color: rgb(0.953, 0.957, 0.965) },
    { texto: "Ticket", fuente: cursivaNegrita, color: NARANJA },
  ];
  const tamanoMarca = 26;
  const anchoMarca = marca.reduce((a, m) => a + m.fuente.widthOfTextAtSize(m.texto, tamanoMarca), 0) + 14;
  let x = (ANCHO - anchoMarca) / 2;
  for (const m of marca) {
    pagina.drawText(m.texto, { x, y: ALTO - 50, size: tamanoMarca, font: m.fuente, color: m.color });
    x += m.fuente.widthOfTextAtSize(m.texto, tamanoMarca);
  }
  pagina.drawText("HN", { x: x + 3, y: ALTO - 40, size: 14, font: cursivaNegrita, color: AZUL });

  // Marco fino, como las tarjetas de la interfaz.
  pagina.drawRectangle({
    x: 36, y: 36, width: ANCHO - 72, height: ALTO - 130,
    borderColor: GRIS_CLARO, borderWidth: 1,
  });

  escribirCentrado("CERTIFICADO DE PARTICIPACIÓN", ALTO - 140, 13, negrita, GRIS);
  escribirCentrado("Se otorga a", ALTO - 178, 12, normal, GRIS);

  // El nombre se reduce si es largo, para no salirse del marco.
  const tamanoNombre = datos.corredor.length > 30 ? 32 : 42;
  escribirCentrado(datos.corredor.toUpperCase(), ALTO - 224, tamanoNombre, cursivaNegrita);
  pagina.drawRectangle({ x: ANCHO / 2 - 40, y: ALTO - 244, width: 80, height: 3, color: NARANJA });

  escribirCentrado(`por completar la categoría ${datos.categoria} de`, ALTO - 278, 12, normal, GRIS);
  escribirCentrado(datos.evento, ALTO - 314, 24, negrita);
  escribirCentrado(datos.fechaEvento, ALTO - 338, 12, normal, GRIS);

  if (datos.tiempo) {
    // Tres celdas, como la pantalla de resultado: tiempo, puesto general, categoría.
    const celdas = [
      { etiqueta: "TIEMPO OFICIAL", valor: datos.tiempo },
      datos.posicionGeneral ? { etiqueta: "PUESTO GENERAL", valor: String(datos.posicionGeneral) } : null,
      datos.posicionCategoria ? { etiqueta: "EN SU CATEGORÍA", valor: String(datos.posicionCategoria) } : null,
    ].filter((c): c is { etiqueta: string; valor: string } => c !== null);
    const anchoCelda = 180;
    const inicio = (ANCHO - anchoCelda * celdas.length) / 2;
    celdas.forEach((c, i) => {
      const cx = inicio + anchoCelda * i + anchoCelda / 2;
      pagina.drawText(c.valor, {
        x: cx - negrita.widthOfTextAtSize(c.valor, 24) / 2, y: ALTO - 392, size: 24, font: negrita, color: TINTA,
      });
      pagina.drawText(c.etiqueta, {
        x: cx - normal.widthOfTextAtSize(c.etiqueta, 8) / 2, y: ALTO - 408, size: 8, font: normal, color: GRIS,
      });
      if (i > 0) {
        pagina.drawRectangle({ x: inicio + anchoCelda * i, y: ALTO - 412, width: 0.75, height: 42, color: GRIS_CLARO });
      }
    });
  }

  escribirCentrado(datos.empresa, 104, 13, negrita);
  pagina.drawRectangle({ x: ANCHO / 2 - 110, y: 124, width: 220, height: 0.75, color: GRIS_CLARO });
  escribirCentrado("ORGANIZADOR", 90, 8, normal, GRIS);

  if (datos.patrocinadores?.length) {
    escribirCentrado(datos.patrocinadores.slice(0, 6).join("   ·   "), 60, 8, normal, GRIS);
  }
  escribirCentrado("runtickethn.com", 44, 8, normal, GRIS);

  return pdf.save();
}
