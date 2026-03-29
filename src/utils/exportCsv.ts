/**
 * Exportar datos a CSV (abre bien en Excel).
 * Escapa comillas y separadores para RFC 4180 básico.
 */
type CsvCell = string | number | null | undefined;

function getCsvLocale() {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang;
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

function getCsvDelimiter(locale: string) {
  const decimalSeparator =
    new Intl.NumberFormat(locale, { useGrouping: false })
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";
  return decimalSeparator === "," ? ";" : ",";
}

function formatCsvValue(value: CsvCell, locale: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale, {
      useGrouping: false,
      maximumFractionDigits: 20,
    }).format(value);
  }
  return String(value ?? "");
}

function escapeCsvCell(value: CsvCell, delimiter: string, locale: string): string {
  const s = formatCsvValue(value, locale);
  if (s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Arma una fila CSV (array de celdas) y la convierte a string.
 */
export function csvRow(cells: CsvCell[], delimiter = ",", locale = getCsvLocale()): string {
  return cells.map((cell) => escapeCsvCell(cell, delimiter, locale)).join(delimiter);
}

/**
 * Descarga un archivo CSV con nombre y contenido dados.
 * Uso: downloadCsv("gastos-2026-01", ["Fecha", "Descripción", ...], [ ["2026-01-01", "Alquiler", ...], ... ]);
 */
export function downloadCsv(
  filenameBase: string,
  headers: string[],
  rows: CsvCell[][]
): void {
  const locale = getCsvLocale();
  const delimiter = getCsvDelimiter(locale);
  const BOM = "\uFEFF";
  const sepLine = `sep=${delimiter}`;
  const headerLine = csvRow(headers, delimiter, locale);
  const dataLines = rows.map((row) => csvRow(row, delimiter, locale));
  const csv = BOM + [sepLine, headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
