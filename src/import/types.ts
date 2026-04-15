export type ImportSourceKind = "credit_card_pdf" | "bank_statement_pdf";
export type ExpenseType = "FIXED" | "VARIABLE";
export type CurrencyId = "UYU" | "USD";
export type ImportRowStatus = "accepted" | "ignored";
export type ImportSourceType =
  | "purchase"
  | "payment"
  | "fee"
  | "transfer"
  | "income"
  | "adjustment"
  | "unknown";

export type SupportedProviderKey =
  | "santander_credit_card_uy"
  | "itau_credit_card_uy"
  | "bbva_credit_card_uy"
  | "santander_checking_uy";

export type TemplateCandidate = {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  expenseType: ExpenseType;
};

export type ImportSuggestion = {
  templateId?: string | null;
  categoryId: string;
  categoryName: string;
  expenseType: ExpenseType;
  descriptionSuggested: string;
  score: number;
  reason: string;
};

export type LearnedMerchantRule = {
  id: string;
  merchantFingerprint: string;
  merchantNormalized: string;
  merchantRaw?: string;
  descriptionSuggested: string;
  categoryId: string;
  categoryName: string;
  expenseType: ExpenseType;
  useCount: number;
  lastLearnedAt?: string | null;
};

export type ParsedImportRow = {
  id: string;
  date: string;
  merchantRaw: string;
  merchantNormalized: string;
  descriptionSuggested: string;
  amount: number;
  currencyId: CurrencyId;
  sourceType: ImportSourceType;
  status: ImportRowStatus;
  shouldIgnore: boolean;
  ignoreReason?: string | null;
  cardLast4?: string | null;
  metadata?: Record<string, unknown>;
  suggestion?: ImportSuggestion | null;
};

export type ParsedStatementBalance = {
  openingBalance?: number | null;
  closingBalance?: number | null;
  currencyId: CurrencyId;
  accountHint?: string | null;
};

export type StatementParseResult = {
  providerKey: SupportedProviderKey;
  providerLabel: string;
  sourceKind: ImportSourceKind;
  statementDate?: string | null;
  periodLabel?: string | null;
  balanceSummary?: ParsedStatementBalance | null;
  rows: ParsedImportRow[];
};

export type ExtractedPdfText = {
  pageCount: number;
  lines: string[];
  fullText: string;
};
