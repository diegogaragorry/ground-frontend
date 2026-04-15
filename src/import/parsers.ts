import type {
  CurrencyId,
  ExtractedPdfText,
  ImportSourceKind,
  ImportSourceType,
  ParsedStatementBalance,
  ParsedImportRow,
  StatementParseResult,
  SupportedProviderKey,
} from "./types";

function compactSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanupSantanderCheckingDescription(value: string) {
  return compactSpaces(
    String(value ?? "")
      .replace(/\b\d{5,}\b/g, " ")
      .replace(/\b(?=[A-Z0-9]{6,}\b)[A-Z0-9]*\d[A-Z0-9]*\b/gi, " ")
      .replace(/#+\d{4}/g, " ")
      .replace(/TARJ:/gi, " ")
      .replace(/\bDB\.\s*PAGO\s+SUELDOS\b/gi, " ")
      .replace(/\bDEBITO\s+\d+\s+OPERACION\s+EN\s+SUPERNET\s+O\s+SMS\b/gi, " ")
      .replace(/\bDEBITO\s+OPERACION\s+EN\s+SUPERNET\s+O\s+SMS\b/gi, " ")
      .replace(/\bOPERACION\s+EN\b/gi, " ")
      .replace(/\bSUPERNET\s+O\s+SMS\b/gi, " ")
      .replace(/\bPAGO\s+DE\s+SERVICIO\s+POR\s+BANRED\s+SERVICIO\s+DE\s+PAGOS\s+BANRED\b/gi, " ")
      .replace(/\bPAGO\s+DE\s+SERVICIO(?:\s+POR\s+BANRED)?(?:\s+\d+)?\s+SERVICIO\s+DE\s+PAGOS\s+BANRED\b/gi, " ")
      .replace(/\bSERVICIO\s+DE\s+PAGOS\s+BANRED\b/gi, " ")
      .replace(/\bPAGO\s+DE\s+SERVICIO\b/gi, " ")
      .replace(/\bPAGOS\s+BANRED\b/gi, " ")
      .replace(/\bPOR\s+BANRED\b/gi, " ")
      .replace(/\bCOMPRA\s+CON\s+TARJETA\s+DEBITO\b/gi, " ")
      .replace(/\bPAGO\s+SERVICIO\s+VISA\b/gi, "PAGO TARJETA VISA ")
      .replace(/\bTRANSF\s+INSTANTANEA\s+ENVIADA\b/gi, "TRANSFERENCIA ENVIADA ")
      .replace(/\bTRANSFERENCIA\s+RECIBIDA\b/gi, "TRANSFERENCIA RECIBIDA ")
      .replace(/\bABONO\s+POR\s+PAGO\s+A\s+PROVEEDORES\b/gi, "ABONO PROVEEDOR ")
      .replace(/\b1\s+TRF\.\s*PLAZA-\b/gi, "TRANSFERENCIA PLAZA ")
      .replace(/\bTRF\.\s*PLAZA-\s*/gi, "TRANSFERENCIA PLAZA ")
      .replace(/\bNRR:\s*\d+\b/gi, " ")
      .replace(/\s*,\s*/g, " ")
      .replace(/^(?:\d+\s+){1,3}/, "")
  );
}

function detectSantanderCheckingCurrency(fullText: string): CurrencyId {
  const match =
    fullText.match(/Cuenta Corriente Select[\s\S]{0,80}\b(USD|UYU)\b/i) ??
    fullText.match(/\bMoneda\b[\s\S]{0,40}\b(USD|UYU)\b/i);
  return String(match?.[1] ?? "UYU").toUpperCase() === "USD" ? "USD" : "UYU";
}

function extractLabeledAmount(lines: string[], label: string) {
  const line = lines.find((item) => new RegExp(`^${label}\\b`, "i").test(item));
  if (!line) return null;
  const match = line.match(/(-?[\d\.,]+)\s*$/);
  return match ? parseFlexibleAmount(match[1]) : null;
}

function extractSantanderCheckingAccountHint(fullText: string) {
  const line = fullText.split(/\r?\n/).map((item) => compactSpaces(item)).find((item) => /Cuenta Corriente Select/i.test(item));
  if (!line) return null;
  const match = line.match(/Cuenta Corriente Select,\s*([0-9]+)\s+(?:USD|UYU)\b/i);
  return compactSpaces(match?.[1] ?? "");
}

export function normalizeImportText(value: string) {
  return compactSpaces(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .toLowerCase()
  );
}

function parseFlexibleAmount(raw: string) {
  const value = String(raw ?? "").trim();
  if (!value) return 0;
  const negative = value.includes("-");
  const cleaned = value.replace(/[^0-9,.-]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const numeric = Number(normalized.replace(/(?!^)-/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return negative ? -Math.abs(numeric) : numeric;
}

function toIsoDate(day: string, month: string, year: string) {
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toIsoDateFromSlash(value: string) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  return toIsoDate(match[1], match[2], match[3]);
}

function findStatementDate(fullText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match?.[1]) {
      const iso = toIsoDateFromSlash(match[1]);
      if (iso) return iso;
    }
  }
  return null;
}

function classifySourceType(description: string, amount: number, sourceKind: ImportSourceKind): ImportSourceType {
  const normalized = normalizeImportText(description);
  if (!normalized) return "unknown";
  if (/saldo anterior|saldo pendiente|saldo final|saldo contado|pago minimo|total a pagar/.test(normalized)) return "adjustment";
  if (/su pago|pago automatico|pagos\b|pago servicio visa|pago de tarjeta/.test(normalized)) return "payment";
  if (/transferencia|transf|trf plaza|abono por pago|abono /.test(normalized)) return amount > 0 ? "income" : "transfer";
  if (/seguro|gastos administrativos|cargo anual|iva|impuesto|comision|financiacion/.test(normalized)) return "fee";
  if (/reduc iva|promociones|desc\b|descuento|ajuste|reverso/.test(normalized)) return "adjustment";
  if (sourceKind === "bank_statement_pdf" && amount > 0) return "income";
  return "purchase";
}

function defaultIgnoreFor(description: string, amount: number, sourceKind: ImportSourceKind) {
  const sourceType = classifySourceType(description, amount, sourceKind);
  if (sourceType === "payment") return { sourceType, shouldIgnore: true, ignoreReason: "Pago o cancelación de saldo" };
  if (sourceType === "transfer") return { sourceType, shouldIgnore: true, ignoreReason: "Transferencia interna o enviada" };
  if (sourceType === "income") return { sourceType, shouldIgnore: true, ignoreReason: "Ingreso o crédito recibido" };
  if (sourceType === "adjustment" && amount === 0) return { sourceType, shouldIgnore: true, ignoreReason: "Línea de resumen o ajuste sin impacto" };
  return { sourceType, shouldIgnore: false, ignoreReason: null };
}

function buildRow(input: {
  date: string;
  merchantRaw: string;
  amount: number;
  currencyId: CurrencyId;
  sourceKind: ImportSourceKind;
  classificationText?: string;
  cardLast4?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const description = compactSpaces(input.merchantRaw);
  const classificationText = compactSpaces(input.classificationText ?? description);
  const defaults = defaultIgnoreFor(classificationText, input.amount, input.sourceKind);
  const keepSignedAmount =
    input.sourceKind === "credit_card_pdf" &&
    defaults.sourceType === "adjustment" &&
    input.amount < 0;
  return {
    id: crypto.randomUUID(),
    date: input.date,
    merchantRaw: description,
    merchantNormalized: normalizeImportText(description),
    descriptionSuggested: description,
    amount: keepSignedAmount ? Math.round(input.amount * 100) / 100 : Math.round(Math.abs(input.amount) * 100) / 100,
    currencyId: input.currencyId,
    sourceType: defaults.sourceType,
    status: defaults.shouldIgnore ? "ignored" : "accepted",
    shouldIgnore: defaults.shouldIgnore,
    ignoreReason: defaults.ignoreReason,
    cardLast4: input.cardLast4 ?? null,
    metadata: input.metadata,
    suggestion: null,
  } satisfies ParsedImportRow;
}

function parseSantanderCreditCard(statement: ExtractedPdfText): StatementParseResult {
  const lines = statement.lines.map((line) => compactSpaces(line));
  const startIndex = lines.findIndex((line) => line === "Detalle");
  const headerIndex = lines.findIndex((line, idx) => idx > startIndex && /^Fecha Tarjeta Detalle/.test(line));
  const endIndex = lines.findIndex((line, idx) => idx > headerIndex && /^Saldo final\b/.test(line));
  const detailLines = lines.slice(headerIndex + 1, endIndex > -1 ? endIndex : undefined);
  const rows: ParsedImportRow[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const [firstLine, ...continuationLines] = current;
    current = [];
    if (!firstLine || !/^\d{2}\/\d{2}\/\d{4}\b/.test(firstLine)) return;
    const match = firstLine.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d\.,]+)\s+(-?[\d\.,]+)\s+(-?[\d\.,]+)$/);
    if (!match) return;
    const [, rawDate, body, ignoredColumn, uyuColumn, usdColumn] = match;
    void ignoredColumn;
    const cardLast4Match = body.match(/X{5}-(\d{4})/);
    const cleaned = compactSpaces([body.replace(/X{5}-\d{4}/g, ""), ...continuationLines].join(" "));
    const uyu = parseFlexibleAmount(uyuColumn);
    const usd = parseFlexibleAmount(usdColumn);
    const amount = Math.abs(usd) > 0 ? usd : uyu;
    const currencyId: CurrencyId = Math.abs(usd) > 0 ? "USD" : "UYU";
    rows.push(
      buildRow({
        date: toIsoDateFromSlash(rawDate),
        merchantRaw: cleaned,
        amount,
        currencyId,
        sourceKind: "credit_card_pdf",
        cardLast4: cardLast4Match?.[1] ?? null,
        metadata: { providerKey: "santander_credit_card_uy" },
      })
    );
  };

  for (const line of detailLines) {
    if (/^(Saldo Anterior|Saldo final)\b/.test(line)) continue;
    if (/^\d{2}\/\d{2}\/\d{4}\b/.test(line)) {
      flush();
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  flush();

  return {
    providerKey: "santander_credit_card_uy",
    providerLabel: "Santander Uruguay · Tarjeta de crédito",
    sourceKind: "credit_card_pdf",
    statementDate: findStatementDate(statement.fullText, [/Fecha de Cierre\s+(\d{1,2}\/\d{1,2}\/\d{4})/]),
    periodLabel: statement.fullText.match(/Período Consultado\s+([A-Za-zÁÉÍÓÚáéíóú]+\s+\d{4})/)?.[1] ?? null,
    rows,
  };
}

function parseItauCreditCard(statement: ExtractedPdfText): StatementParseResult {
  const lines = statement.lines.map((line) => compactSpaces(line));
  const startIndex = lines.findIndex((line) => /^SALDO DEL ESTADO DE CUENTA ANTERIOR\b/.test(line));
  const endIndex = lines.findIndex((line, idx) => idx > startIndex && /^SALDO CONTADO\b/.test(line));
  const detailLines = lines.slice(startIndex, endIndex > -1 ? endIndex : undefined);
  const statementDate = statement.fullText.match(/^\d{2}\/\d{2}\/\d{2}$/m)?.[0] ?? null;
  const rows: ParsedImportRow[] = [];

  for (const line of detailLines) {
    if (/^SALDO DEL ESTADO DE CUENTA ANTERIOR\b/.test(line)) continue;
    if (/^SALDO CONTADO\b/.test(line)) break;

    const dated = line.match(/^(\d{2})\s+(\d{2})\s+(\d{2})\s+(.+?)\s+(-?[\d\.,]+)$/);
    if (dated) {
      const [, day, month, year, rawBody, rawAmount] = dated;
      const tokens = rawBody.split(/\s+/);
      const cardLast4 = /^\d{4}$/.test(tokens[0] ?? "") ? tokens.shift() ?? null : null;
      const installmentHint = /\b\d{1,2}\/\d{1,2}\b/.test(tokens[tokens.length - 1] ?? "") ? tokens.pop() ?? null : null;
      rows.push(
        buildRow({
          date: toIsoDate(day, month, year),
          merchantRaw: tokens.join(" "),
          amount: parseFlexibleAmount(rawAmount),
          currencyId: "UYU",
          sourceKind: "credit_card_pdf",
          cardLast4,
          metadata: {
            providerKey: "itau_credit_card_uy",
            ...(installmentHint ? { installmentHint } : {}),
          },
        })
      );
      continue;
    }

    const undated = line.match(/^(SEGURO DE VIDA SOBRE SALDO)\s+(-?[\d\.,]+)$/);
    if (undated && statementDate) {
      rows.push(
        buildRow({
          date: toIsoDateFromSlash(statementDate),
          merchantRaw: undated[1],
          amount: parseFlexibleAmount(undated[2]),
          currencyId: "UYU",
          sourceKind: "credit_card_pdf",
          metadata: { providerKey: "itau_credit_card_uy" },
        })
      );
    }
  }

  return {
    providerKey: "itau_credit_card_uy",
    providerLabel: "Itaú Uruguay · Tarjeta de crédito",
    sourceKind: "credit_card_pdf",
    statementDate: statementDate ? toIsoDateFromSlash(statementDate) : null,
    rows,
  };
}

function parseBbvaCreditCard(statement: ExtractedPdfText): StatementParseResult {
  const lines = statement.lines.map((line) => compactSpaces(line));
  const startIndex = lines.findIndex((line) => /^Fecha Descripción Pesos Dólares$/.test(line));
  const endIndex = lines.findIndex((line, idx) => idx > startIndex && /^SALDO CONTADO\b/.test(line));
  const detailLines = lines.slice(startIndex + 1, endIndex > -1 ? endIndex : undefined);
  const statementDate =
    findStatementDate(statement.fullText, [/Fecha de cierre\s+(\d{2}\/\d{2}\/\d{4})/]) ??
    findStatementDate(statement.fullText, [/Vencimiento actual\s+(\d{2}\/\d{2}\/\d{4})/]);
  const rows: ParsedImportRow[] = [];

  for (const line of detailLines) {
    if (/^(SALDO ANTERIOR|SALDO PENDIENTE|TARJETA\b)/.test(line)) continue;

    const dated = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d\.,]+)\s+(-?[\d\.,]+)$/);
    if (dated) {
      const [, rawDate, rawBody, uyuColumn, usdColumn] = dated;
      const uyu = parseFlexibleAmount(uyuColumn);
      const usd = parseFlexibleAmount(usdColumn);
      rows.push(
        buildRow({
          date: toIsoDateFromSlash(rawDate),
          merchantRaw: rawBody,
          amount: Math.abs(usd) > 0 ? usd : uyu,
          currencyId: Math.abs(usd) > 0 ? "USD" : "UYU",
          sourceKind: "credit_card_pdf",
          metadata: { providerKey: "bbva_credit_card_uy" },
        })
      );
      continue;
    }

    const undated = line.match(/^(.+?)\s+(-?[\d\.,]+)\s+(-?[\d\.,]+)$/);
    if (undated && statementDate) {
      const [, rawBody, uyuColumn, usdColumn] = undated;
      if (/^(Total a pagar|Pago mínimo|Tasas Efectivas Anuales|Tasas Actuales)/i.test(rawBody)) continue;
      const uyu = parseFlexibleAmount(uyuColumn);
      const usd = parseFlexibleAmount(usdColumn);
      rows.push(
        buildRow({
          date: statementDate,
          merchantRaw: rawBody,
          amount: Math.abs(usd) > 0 ? usd : uyu,
          currencyId: Math.abs(usd) > 0 ? "USD" : "UYU",
          sourceKind: "credit_card_pdf",
          metadata: { providerKey: "bbva_credit_card_uy" },
        })
      );
    }
  }

  return {
    providerKey: "bbva_credit_card_uy",
    providerLabel: "BBVA Uruguay · Tarjeta de crédito",
    sourceKind: "credit_card_pdf",
    statementDate,
    rows,
  };
}

function parseSantanderChecking(statement: ExtractedPdfText): StatementParseResult {
  const lines = statement.lines.map((line) => compactSpaces(line));
  const startIndex = lines.findIndex((line) => /^Saldo inicial\b/.test(line));
  const endIndex = lines.findIndex((line, idx) => idx > startIndex && /^Saldo final\b/.test(line));
  const movementLines = lines.slice(startIndex + 1, endIndex > -1 ? endIndex : undefined);
  const rows: ParsedImportRow[] = [];
  const currencyId = detectSantanderCheckingCurrency(statement.fullText);
  const balanceSummary: ParsedStatementBalance = {
    openingBalance: extractLabeledAmount(lines, "Saldo inicial"),
    closingBalance: extractLabeledAmount(lines, "Saldo final"),
    currencyId,
    accountHint: extractSantanderCheckingAccountHint(statement.fullText),
  };
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const blockLines = [...current];
    current = [];
    const firstLine = blockLines[0] ?? "";
    const compactBlockLines = blockLines.map((line) => compactSpaces(line)).filter(Boolean);
    const inlineMatch = firstLine.match(/^(\d{2}\/\d{2}\/\d{2})(?:\d{0,2})?\s+(.+?)\s+(-?[\d\.,]+)\s+([\d\.,]+)$/);
    const splitMatch = firstLine.match(/^(\d{2}\/\d{2}\/\d{2})(?:\d{0,2})?\s+(.+)$/);
    if (!inlineMatch && !splitMatch) return;

    const rawDatePrefix = inlineMatch?.[1] ?? splitMatch?.[1] ?? "";
    let descriptionLines = [compactSpaces(inlineMatch?.[2] ?? splitMatch?.[2] ?? "")].filter(Boolean);
    let rawAmount = inlineMatch?.[3] ?? "";
    let yearSuffix = "";
    const continuationLines = compactBlockLines.slice(1);

    for (const line of continuationLines) {
      if (!yearSuffix) {
        const y = line.match(/^(\d{2})\b/)?.[1] ?? "";
        if (y) yearSuffix = y;
      }

      if (/^\d{1,4}(?:\s+\d{1,6})*$/.test(line)) {
        continue;
      }

      if (!rawAmount) {
        const amountOnly = line.match(/^(-?[\d\.,]+)\s+([\d\.,]+)$/);
        if (amountOnly) {
          rawAmount = amountOnly[1];
          break;
        }

        const trailingAmount = line.match(/^(.+?)\s+(-?[\d\.,]+)\s+([\d\.,]+)$/);
        if (trailingAmount && /[A-Za-zÁÉÍÓÚáéíóú]/.test(trailingAmount[1])) {
          descriptionLines.push(compactSpaces(trailingAmount[1]));
          rawAmount = trailingAmount[2];
          break;
        }
      }

      descriptionLines.push(line);
    }

    if (!rawAmount) return;

    const date = toIsoDateFromSlash(`${rawDatePrefix}${yearSuffix}`);
    const rawText = descriptionLines
      .filter((line) => !/^\d{1,4}(?:\s+\d{1,6})*$/.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const text = cleanupSantanderCheckingDescription(rawText);
    rows.push(
      buildRow({
        date,
        merchantRaw: text,
        amount: parseFlexibleAmount(rawAmount),
        currencyId,
        sourceKind: "bank_statement_pdf",
        classificationText: rawText,
        metadata: { providerKey: "santander_checking_uy" },
      })
    );
  };

  for (const line of movementLines) {
    if (/^\d{2}\/\d{2}\/\d{2}(?:\d{0,2})?\b/.test(line)) {
      flush();
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  flush();

  return {
    providerKey: "santander_checking_uy",
    providerLabel: "Santander Uruguay · Cuenta corriente",
    sourceKind: "bank_statement_pdf",
    statementDate: null,
    periodLabel: statement.fullText.match(/Movimientos\s+(\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null,
    balanceSummary,
    rows,
  };
}

export function detectProvider(statement: ExtractedPdfText): SupportedProviderKey | null {
  const text = statement.fullText;
  if (/Tarjeta de crédito Visa Soy Santander/i.test(text)) return "santander_credit_card_uy";
  if (/UD\. HA GENERADO .* MILLAS ITAU/i.test(text) || /SALDO DEL ESTADO DE CUENTA ANTERIOR/i.test(text)) return "itau_credit_card_uy";
  if (/Fecha Descripción Pesos Dólares/i.test(text) && /Próximo vencimiento/i.test(text)) return "bbva_credit_card_uy";
  if (/Cuenta Corriente Select/i.test(text) && /Movimientos/i.test(text)) return "santander_checking_uy";
  return null;
}

export function parseStatement(statement: ExtractedPdfText): StatementParseResult | null {
  const provider = detectProvider(statement);
  if (!provider) return null;
  switch (provider) {
    case "santander_credit_card_uy":
      return parseSantanderCreditCard(statement);
    case "itau_credit_card_uy":
      return parseItauCreditCard(statement);
    case "bbva_credit_card_uy":
      return parseBbvaCreditCard(statement);
    case "santander_checking_uy":
      return parseSantanderChecking(statement);
    default:
      return null;
  }
}
