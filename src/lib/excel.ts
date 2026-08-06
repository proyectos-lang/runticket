import "server-only";
import ExcelJS from "exceljs";

/**
 * Generación de hojas de cálculo, hermana de `lib/csv.ts`.
 *
 * Sigue el molde de `lib/pdf/`: recibe datos **planos y ya formateados** —quien
 * llama hace las consultas y decide los textos— y devuelve el binario. Aquí solo
 * se dibuja.
 *
 * Un `.xlsx` de verdad y no un CSV renombrado porque un informe necesita lo que
 * el CSV no puede dar: varias hojas, cabecera fija, autofiltro y, sobre todo,
 * **números que Excel entienda como números**. Un CSV con «1,250.00» se abre
 * como texto en media Honduras y no se puede sumar.
 */

export type FormatoColumna = "texto" | "numero" | "moneda" | "fecha";

export type ColumnaExcel = {
  cabecera: string;
  /** En caracteres, como los mide Excel. */
  ancho?: number;
  formato?: FormatoColumna;
};

export type HojaExcel = {
  nombre: string;
  columnas: ColumnaExcel[];
  filas: unknown[][];
  /** Fila de cabecera fija y desplegables de filtro. Solo para hojas tabulares. */
  filtrable?: boolean;
};

// Sin separador de miles en el formato de moneda: la máscara la interpreta Excel
// con la configuración regional de quien abre el archivo, y forzarla aquí
// produce cifras raras en un equipo configurado en otro país.
const MASCARA: Record<FormatoColumna, string | undefined> = {
  texto: undefined,
  numero: "0",
  moneda: "#,##0.00",
  fecha: "dd/mm/yyyy",
};

/** Excel rechaza estos caracteres en el nombre de una hoja, y 31 es su tope. */
function nombreDeHoja(nombre: string): string {
  return nombre.replace(/[*?:/\\[\]]/g, " ").slice(0, 31) || "Hoja";
}

export async function construirExcel(hojas: HojaExcel[]): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "RunTicket HN";
  libro.created = new Date();

  for (const hoja of hojas) {
    const ws = libro.addWorksheet(nombreDeHoja(hoja.nombre));

    ws.columns = hoja.columnas.map((c) => ({
      header: c.cabecera,
      width: c.ancho ?? Math.max(12, c.cabecera.length + 2),
    }));

    for (const fila of hoja.filas) ws.addRow(fila);

    const cabecera = ws.getRow(1);
    cabecera.font = { bold: true };
    cabecera.alignment = { vertical: "middle" };

    hoja.columnas.forEach((c, i) => {
      const mascara = MASCARA[c.formato ?? "texto"];
      if (mascara) ws.getColumn(i + 1).numFmt = mascara;
    });

    if (hoja.filtrable && hoja.columnas.length > 0) {
      // La cabecera se queda a la vista al desplazarse: con doscientas filas,
      // sin esto no se sabe qué columna se está mirando.
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columnas.length },
      };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export function respuestaExcel(nombreArchivo: string, datos: Uint8Array): Response {
  return new Response(datos as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      // Un informe con filtros aplicados no debe servirse desde una caché
      // intermedia a otra petición con filtros distintos.
      "Cache-Control": "no-store",
    },
  });
}
