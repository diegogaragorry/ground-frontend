import type { ExtractedPdfText } from "./types";

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

function joinTokens(tokens: Array<{ x: number; text: string }>) {
  const out: string[] = [];
  let prevX = -Infinity;
  for (const token of [...tokens].sort((a, b) => a.x - b.x)) {
    const text = String(token.text ?? "").trim();
    if (!text) continue;
    if (out.length === 0) {
      out.push(text);
      prevX = token.x;
      continue;
    }
    if (token.x - prevX > 8) out.push(" ");
    out.push(text);
    prevX = token.x + text.length;
  }
  return out.join("").replace(/\s+/g, " ").trim();
}

let pdfJsPromise:
  | Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>
  | null = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfJs, worker]) => {
      pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfJs;
    });
  }
  return pdfJsPromise;
}

export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const { getDocument } = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows: Array<{ y: number; tokens: Array<{ x: number; text: string }> }> = [];

    for (const rawItem of content.items as PdfTextItem[]) {
      const text = String(rawItem?.str ?? "").trim();
      const transform = rawItem?.transform;
      if (!text || !transform || !Array.isArray(transform) || transform.length < 6) continue;

      const x = Number(transform[4] ?? 0);
      const y = Number(transform[5] ?? 0);
      const existing = rows.find((row) => Math.abs(row.y - y) <= 2.5);
      if (existing) {
        existing.tokens.push({ x, text });
      } else {
        rows.push({ y, tokens: [{ x, text }] });
      }
    }

    rows
      .sort((a, b) => b.y - a.y)
      .map((row) => joinTokens(row.tokens))
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }

  return {
    pageCount: pdf.numPages,
    lines,
    fullText: lines.join("\n"),
  };
}
