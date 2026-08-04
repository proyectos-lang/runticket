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

export async function generarPdfCertificado(datos: DatosCertificado): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cursiva = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const centrar = (texto: string, fuente: typeof normal, tamano: number) =>
    (ANCHO - fuente.widthOfTextAtSize(texto, tamano)) / 2;

  const escribirCentrado = (
    texto: string,
    y: number,
    tamano: number,
    fuente = normal,
    color = rgb(0.1, 0.1, 0.12)
  ) => {
    pagina.drawText(texto, { x: centrar(texto, fuente, tamano), y, size: tamano, font: fuente, color });
  };

  // Doble marco decorativo
  pagina.drawRectangle({
    x: 28, y: 28, width: ANCHO - 56, height: ALTO - 56,
    borderColor: rgb(0.06, 0.72, 0.51), borderWidth: 3,
  });
  pagina.drawRectangle({
    x: 40, y: 40, width: ANCHO - 80, height: ALTO - 80,
    borderColor: rgb(0.85, 0.85, 0.88), borderWidth: 1,
  });

  escribirCentrado("CERTIFICADO DE PARTICIPACIÓN", ALTO - 110, 26, negrita);
  escribirCentrado("Se otorga el presente certificado a", ALTO - 160, 12, normal, rgb(0.45, 0.45, 0.5));

  // El nombre se reduce si es largo, para no salirse del marco.
  const tamanoNombre = datos.corredor.length > 34 ? 30 : 40;
  escribirCentrado(datos.corredor, ALTO - 215, tamanoNombre, negrita);
  pagina.drawLine({
    start: { x: 160, y: ALTO - 232 },
    end: { x: ANCHO - 160, y: ALTO - 232 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.83),
  });

  escribirCentrado(
    `por haber completado satisfactoriamente la categoría ${datos.categoria} de`,
    ALTO - 262,
    12,
    normal,
    rgb(0.35, 0.35, 0.4)
  );
  escribirCentrado(datos.evento, ALTO - 296, 22, negrita);
  escribirCentrado(datos.fechaEvento, ALTO - 322, 12, normal, rgb(0.45, 0.45, 0.5));

  if (datos.tiempo) {
    const detalles = [
      `Tiempo oficial: ${datos.tiempo}`,
      datos.posicionGeneral ? `Posición general: ${datos.posicionGeneral}` : null,
      datos.posicionCategoria ? `Posición en categoría: ${datos.posicionCategoria}` : null,
    ]
      .filter(Boolean)
      .join("     ·     ");
    escribirCentrado(detalles, ALTO - 372, 13, negrita, rgb(0.06, 0.55, 0.4));
  }

  escribirCentrado(datos.empresa, 108, 13, cursiva, rgb(0.3, 0.3, 0.35));
  pagina.drawLine({
    start: { x: ANCHO / 2 - 110, y: 126 },
    end: { x: ANCHO / 2 + 110, y: 126 },
    thickness: 0.75,
    color: rgb(0.75, 0.75, 0.78),
  });
  escribirCentrado("Organizador", 92, 9, normal, rgb(0.55, 0.55, 0.6));

  if (datos.patrocinadores?.length) {
    escribirCentrado(
      datos.patrocinadores.slice(0, 6).join("   ·   "),
      60,
      8,
      normal,
      rgb(0.6, 0.6, 0.65)
    );
  }

  return pdf.save();
}
