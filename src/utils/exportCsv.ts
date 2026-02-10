/**
 * Exportar datos a CSV (abre bien en Excel).
 * Escapa comillas y separadores para RFC 4180 básico.
 */
function escapeCsvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Arma una fila CSV (array de celdas) y la convierte a string.
 */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * Descarga un archivo CSV con nombre y contenido dados.
 * Uso: downloadCsv("gastos-2026-01", ["Fecha", "Descripción", ...], [ ["2026-01-01", "Alquiler", ...], ... ]);
 */
export function downloadCsv(
  filenameBase: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const BOM = "\uFEFF";
  const headerLine = csvRow(headers);
  const dataLines = rows.map((row) => csvRow(row));
  const csv = BOM + [headerLine, ...dataLines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
