/**
 * Escapa un valor para CSV: entrecomilla si contiene separador, comillas o salto
 * de línea, y duplica las comillas internas (RFC 4180).
 */
function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Construye un CSV con BOM UTF-8: sin él, Excel en Windows abre los acentos y la
 * ñ como caracteres corruptos, que es justo donde se abrirán estos reportes.
 */
export function construirCsv(cabeceras: string[], filas: unknown[][]): string {
  const lineas = [cabeceras.map(celda).join(","), ...filas.map((f) => f.map(celda).join(","))];
  return "﻿" + lineas.join("\r\n");
}

export function respuestaCsv(nombreArchivo: string, contenido: string): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
