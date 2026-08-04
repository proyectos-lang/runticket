import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export type DatosDorsal = {
  dorsal: number;
  /**
   * Lo que se codifica en el QR. Se pasa ya construido como URL de check-in en
   * vez de como token suelto: así, al escanearlo con la cámara normal de
   * cualquier teléfono, el operador aterriza en la pantalla de entrega con el
   * corredor ya cargado. Con un token en crudo solo veía una cadena sin sentido.
   */
  urlCheckin: string;
  corredor: string;
  evento: string;
  categoria: string;
  fechaEvento: string;
  empresa: string;
  patrocinadores?: string[];
};

// A5 apaisado: entra en una hoja A4 al imprimir y el dorsal queda a tamaño real.
const ANCHO = 595.28;
const ALTO = 420;

export async function generarPdfDorsal(datos: DatosDorsal): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const centrar = (texto: string, fuente: typeof normal, tamano: number) =>
    (ANCHO - fuente.widthOfTextAtSize(texto, tamano)) / 2;

  // Encabezado
  pagina.drawText(datos.evento, {
    x: centrar(datos.evento, negrita, 16),
    y: ALTO - 46,
    size: 16,
    font: negrita,
    color: rgb(0.1, 0.1, 0.12),
  });
  pagina.drawText(`${datos.fechaEvento} · ${datos.categoria}`, {
    x: centrar(`${datos.fechaEvento} · ${datos.categoria}`, normal, 10),
    y: ALTO - 64,
    size: 10,
    font: normal,
    color: rgb(0.45, 0.45, 0.5),
  });

  // Número: es lo único que se lee a distancia, así que ocupa el centro.
  const numero = String(datos.dorsal);
  const tamanoNumero = numero.length >= 5 ? 130 : numero.length === 4 ? 150 : 170;
  pagina.drawText(numero, {
    x: centrar(numero, negrita, tamanoNumero),
    y: 150,
    size: tamanoNumero,
    font: negrita,
    color: rgb(0.05, 0.05, 0.07),
  });

  pagina.drawText(datos.corredor, {
    x: centrar(datos.corredor, negrita, 18),
    y: 112,
    size: 18,
    font: negrita,
    color: rgb(0.1, 0.1, 0.12),
  });

  // QR para el check-in. Corrección de errores alta (Q) y tamaño generoso:
  // se escanea desde la pantalla de un teléfono, a veces con el dorsal doblado
  // o con poca luz, y una H/M pequeña fallaba.
  const pngQr = await QRCode.toBuffer(datos.urlCheckin, {
    errorCorrectionLevel: "Q",
    margin: 1,
    width: 512,
  });
  const qr = await pdf.embedPng(pngQr);
  const ladoQr = 120;
  pagina.drawImage(qr, { x: ANCHO - ladoQr - 32, y: 30, width: ladoQr, height: ladoQr });
  pagina.drawText("Escanea para retirar tu kit", {
    x: ANCHO - ladoQr - 32 + 8,
    y: 20,
    size: 7,
    font: normal,
    color: rgb(0.5, 0.5, 0.55),
  });

  pagina.drawText(datos.empresa, {
    x: 32,
    y: 40,
    size: 9,
    font: normal,
    color: rgb(0.45, 0.45, 0.5),
  });

  if (datos.patrocinadores?.length) {
    const texto = datos.patrocinadores.slice(0, 6).join("  ·  ");
    pagina.drawText(texto, {
      x: 32,
      y: 26,
      size: 7,
      font: normal,
      color: rgb(0.55, 0.55, 0.6),
    });
  }

  // Marco de recorte
  pagina.drawRectangle({
    x: 16,
    y: 16,
    width: ANCHO - 32,
    height: ALTO - 32,
    borderColor: rgb(0.85, 0.85, 0.88),
    borderWidth: 1,
  });

  return pdf.save();
}
