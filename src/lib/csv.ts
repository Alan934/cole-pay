/**
 * Armado de CSV pensado para que Excel en español lo abra bien.
 *
 * Excel no lee el CSV con un separador fijo: usa el "separador de listas" de
 * la configuración regional de Windows, que en es-AR (y en toda la región) es
 * el punto y coma. Con comas, la fila entera cae en una sola columna.
 */

/** Punto y coma: lo que espera Excel en configuración regional en español. */
const SEPARATOR = ";";

/**
 * Marca de orden de bytes. Sin esto Excel abre el archivo como Latin-1 y los
 * acentos salen rotos ("Joaquín" -> "JoaquÃ­n").
 */
const BOM = "﻿";

/** Entrecomilla si el valor contiene el separador, comillas o saltos de línea. */
function escapeCell(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(SEPARATOR) || /["\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Encabezado + filas -> texto CSV listo para descargar. */
export function buildCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(SEPARATOR));
  // CRLF: el fin de línea que espera Excel en Windows.
  return BOM + lines.join("\r\n");
}
