import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { APP_BASE } from "../constants";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";
import { extractPdfText } from "../import/pdf";
import { parseStatement } from "../import/parsers";
import { shouldAutoAcceptSuggestion, suggestTemplateForRowWithRules } from "../import/suggestions";
import { getCategoryDisplayName } from "../utils/categoryI18n";
import { buildMerchantRuleFingerprint } from "../utils/crypto";
import type {
  CurrencyId,
  ExpenseType,
  ImportRowStatus,
  LearnedMerchantRule,
  ParsedImportRow,
  ParsedStatementBalance,
  StatementParseResult,
  TemplateCandidate,
} from "../import/types";

type Category = { id: string; name: string; expenseType: ExpenseType; nameKey?: string | null };

type ExpenseTemplateApiRow = {
  id: string;
  description: string;
  categoryId: string;
  expenseType: ExpenseType;
  encryptedPayload?: string | null;
  category?: { id: string; name: string } | null;
};

type ExpensesPageData = {
  year: number;
  month: number;
  categories: Category[];
  monthCloses?: { year: number; rows: Array<{ year: number; month: number; isClosed?: boolean }> };
};

type MerchantMappingRuleApiRow = {
  id: string;
  merchantFingerprint: string;
  encryptedPayload: string;
  categoryId: string;
  expenseType: ExpenseType;
  useCount: number;
  lastLearnedAt?: string | null;
  category?: { id: string; name: string; nameKey?: string | null; expenseType?: ExpenseType } | null;
};

type InvestmentSummary = {
  id: string;
  name: string;
  type: "ACCOUNT" | "PORTFOLIO";
  currencyId: CurrencyId;
};

type ReviewRow = ParsedImportRow & {
  amountFinal: number;
  currencyIdFinal: CurrencyId;
  categoryIdFinal: string;
  descriptionFinal: string;
  expenseTypeFinal: ExpenseType | "";
  status: ImportRowStatus;
};

type StatementPreview = {
  fileName: string;
  pageCount: number;
  providerLabel: string;
  sourceKind: StatementParseResult["sourceKind"];
  statementDate?: string | null;
  periodLabel?: string | null;
  balanceSummary?: ParsedStatementBalance | null;
  mappedAccountId: string;
  shouldUpdateMappedAccount: boolean;
  rows: ReviewRow[];
  unsupportedReason?: string | null;
};

function parseYm(params: URLSearchParams) {
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function compactSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isEncryptedPlaceholder(value: string) {
  return /^\(encrypted-[a-z0-9]+\)$/i.test(value.trim());
}

function sanitizeImportedDescription(rawDescription: string, merchantRaw: string) {
  const description = compactSpaces(rawDescription ?? "");
  if (!description || description === "(encrypted)" || isEncryptedPlaceholder(description)) {
    return compactSpaces(merchantRaw ?? "");
  }
  return description;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number | null | undefined, currencyId: CurrencyId) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currencyId}`;
}

function nextYearMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function buildStatementAccountMatch(
  balanceSummary: ParsedStatementBalance | null | undefined,
  accounts: InvestmentSummary[]
) {
  if (!balanceSummary) return "";
  const sameCurrencyAccounts = accounts.filter((account) => account.currencyId === balanceSummary.currencyId);
  if (sameCurrencyAccounts.length === 0) return "";
  const hint = compactSpaces(balanceSummary.accountHint ?? "");
  if (!hint) return sameCurrencyAccounts.length === 1 ? sameCurrencyAccounts[0].id : "";
  const matchedByName = sameCurrencyAccounts.find((account) => compactSpaces(account.name).includes(hint));
  return matchedByName?.id ?? (sameCurrencyAccounts.length === 1 ? sameCurrencyAccounts[0].id : "");
}

function kindColor(kind: StatementPreview["sourceKind"]) {
  return kind === "credit_card_pdf" ? "rgba(21,128,61,0.12)" : "rgba(59,130,246,0.12)";
}

function kindTextColor(kind: StatementPreview["sourceKind"]) {
  return kind === "credit_card_pdf" ? "rgb(21,128,61)" : "rgb(29,78,216)";
}

function toEditableAmount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function SectionCard(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ display: "grid", gap: 12, border: "1px solid var(--border)" }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{props.title}</div>
        {props.subtitle ? (
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}

export default function ExpenseImportPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { encryptionKey, decryptPayload, encryptPayload, hasEncryptionSupport } = useEncryption();
  const { setHeader, showSuccess, serverFxRate } = useAppShell();
  const { year, month } = useAppYearMonth();
  const [searchParams] = useSearchParams();

  const targetYm = useMemo(() => parseYm(searchParams) ?? { year, month }, [searchParams, year, month]);
  const targetMonthLabel = `${targetYm.year}-${String(targetYm.month).padStart(2, "0")}`;
  const nextSnapshotYm = useMemo(() => nextYearMonth(targetYm.year, targetYm.month), [targetYm.month, targetYm.year]);
  const nextSnapshotMonthLabel = `${nextSnapshotYm.year}-${String(nextSnapshotYm.month).padStart(2, "0")}`;

  const [loadingContext, setLoadingContext] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<InvestmentSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateCandidate[]>([]);
  const [learnedRules, setLearnedRules] = useState<LearnedMerchantRule[]>([]);
  const [statements, setStatements] = useState<StatementPreview[]>([]);
  const [targetMonthClosed, setTargetMonthClosed] = useState(false);

  useEffect(() => {
    setHeader({
      title: t("expenseImport.title"),
      subtitle: t("expenseImport.subtitle"),
    });
  }, [setHeader, t]);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      setLoadingContext(true);
      setError("");
      try {
        const [pageData, templatesResp, rulesResp, investmentsResp] = await Promise.all([
          api<ExpensesPageData>(`/expenses/page-data?year=${targetYm.year}&month=${targetYm.month}`),
          api<{ rows: ExpenseTemplateApiRow[] }>("/admin/expenseTemplates"),
          api<{ rows: MerchantMappingRuleApiRow[] }>("/expenses/import/rules"),
          api<InvestmentSummary[]>("/investments"),
        ]);

        if (!active) return;
        setCategories(pageData.categories ?? []);
        const closed = (pageData.monthCloses?.rows ?? []).some((row) => row.month === targetYm.month && row.isClosed !== false);
        setTargetMonthClosed(closed);
        setAccounts((investmentsResp ?? []).filter((row) => row.type === "ACCOUNT"));

        const resolvedTemplates: TemplateCandidate[] = [];
        for (const row of templatesResp.rows ?? []) {
          let description = compactSpaces(row.description ?? "");
          if (row.encryptedPayload) {
            const decrypted = await decryptPayload<{ description?: string }>(row.encryptedPayload);
            description = compactSpaces(decrypted?.description ?? description);
          }
          if (!description || isEncryptedPlaceholder(description)) continue;
          resolvedTemplates.push({
            id: row.id,
            description,
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? "",
            expenseType: row.expenseType,
          });
        }

        if (!active) return;
        setTemplates(resolvedTemplates);

        const resolvedRules: LearnedMerchantRule[] = [];
        for (const row of rulesResp.rows ?? []) {
          if (!row.encryptedPayload) continue;
          const decrypted = await decryptPayload<{
            merchantNormalized?: string;
            merchantRaw?: string;
            descriptionSuggested?: string;
          }>(row.encryptedPayload);
          const merchantNormalized = compactSpaces(decrypted?.merchantNormalized ?? "");
          const descriptionSuggested = compactSpaces(decrypted?.descriptionSuggested ?? "");
          if (!merchantNormalized || !descriptionSuggested || descriptionSuggested === "(encrypted)" || isEncryptedPlaceholder(descriptionSuggested)) continue;
          resolvedRules.push({
            id: row.id,
            merchantFingerprint: row.merchantFingerprint,
            merchantNormalized,
            merchantRaw: compactSpaces(decrypted?.merchantRaw ?? ""),
            descriptionSuggested,
            categoryId: row.categoryId,
            categoryName: row.category?.name ?? "",
            expenseType: row.expenseType,
            useCount: Number(row.useCount ?? 1) || 1,
            lastLearnedAt: row.lastLearnedAt ?? null,
          });
        }

        if (!active) return;
        setLearnedRules(resolvedRules);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? t("common.error"));
      } finally {
        if (active) setLoadingContext(false);
      }
    }

    loadContext();
    return () => {
      active = false;
    };
  }, [decryptPayload, t, targetYm.month, targetYm.year]);

  useEffect(() => {
    if (accounts.length === 0) return;
    setStatements((prev) =>
      prev.map((statement) => {
        if (statement.mappedAccountId || !statement.balanceSummary) return statement;
        return {
          ...statement,
          mappedAccountId: buildStatementAccountMatch(statement.balanceSummary, accounts),
        };
      })
    );
  }, [accounts]);

  async function handleFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setParsing(true);
    setError("");

    try {
      const parsed = await Promise.all(
        files.map(async (file) => {
          const extracted = await extractPdfText(file);
          const statement = parseStatement(extracted);
          if (!statement) {
            return {
              fileName: file.name,
              pageCount: extracted.pageCount,
              providerLabel: t("expenseImport.unsupportedProvider"),
              sourceKind: "credit_card_pdf" as const,
              balanceSummary: null,
              mappedAccountId: "",
              shouldUpdateMappedAccount: false,
              rows: [],
              unsupportedReason: t("expenseImport.unsupportedBody"),
            } satisfies StatementPreview;
          }

          const rows: ReviewRow[] = statement.rows.map((row) => {
            const suggestion = suggestTemplateForRowWithRules(row, templates, learnedRules);
            const autoAccept = shouldAutoAcceptSuggestion(suggestion);
            return {
              ...row,
              suggestion,
              amountFinal: toEditableAmount(row.amount),
              currencyIdFinal: row.currencyId,
              descriptionFinal: suggestion?.descriptionSuggested ?? row.descriptionSuggested,
              categoryIdFinal: suggestion?.categoryId ?? "",
              expenseTypeFinal: suggestion?.expenseType ?? "",
              status: autoAccept || !row.shouldIgnore ? "accepted" : "ignored",
              shouldIgnore: autoAccept ? false : row.shouldIgnore,
              ignoreReason: autoAccept ? null : row.ignoreReason,
            };
          });

          return {
            fileName: file.name,
            pageCount: extracted.pageCount,
            providerLabel: statement.providerLabel,
            sourceKind: statement.sourceKind,
            statementDate: statement.statementDate,
            periodLabel: statement.periodLabel,
            balanceSummary: statement.balanceSummary ?? null,
            mappedAccountId: buildStatementAccountMatch(statement.balanceSummary, accounts),
            shouldUpdateMappedAccount:
              statement.sourceKind === "bank_statement_pdf" && statement.balanceSummary?.closingBalance != null,
            rows,
          } satisfies StatementPreview;
        })
      );

      setStatements(parsed);
    } catch (err: any) {
      setError(err?.message ?? t("common.error"));
    } finally {
      setParsing(false);
    }
  }

  function updateReviewRow(statementIndex: number, rowId: string, patch: Partial<ReviewRow>) {
    setStatements((prev) =>
      prev.map((statement, idx) => {
        if (idx !== statementIndex) return statement;
        return {
          ...statement,
          rows: statement.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
        };
      })
    );
  }

  function updateStatement(statementIndex: number, patch: Partial<StatementPreview>) {
    setStatements((prev) =>
      prev.map((statement, idx) => (idx === statementIndex ? { ...statement, ...patch } : statement))
    );
  }

  const acceptedCount = (rows: ReviewRow[]) => rows.filter((row) => row.status === "accepted").length;
  const ignoredCount = (rows: ReviewRow[]) => rows.filter((row) => row.status === "ignored").length;

  const rowsAccepted = useMemo(
    () => statements.flatMap((statement) => statement.rows.filter((row) => row.status === "accepted").map((row) => ({ statement, row }))),
    [statements]
  );
  const rowsMissingCategory = rowsAccepted.filter(({ row }) => !row.categoryIdFinal);
  const rowsMissingDescription = rowsAccepted.filter(({ row }) => !row.descriptionFinal.trim());
  const rowsInvalidAmount = rowsAccepted.filter(
    ({ row }) => !Number.isFinite(Number(row.amountFinal)) || Number(row.amountFinal) === 0
  );
  const importBlockingMessage =
    targetMonthClosed
      ? t("expenseImport.targetMonthClosed", { month: targetMonthLabel })
      : rowsMissingCategory.length > 0
        ? t("expenseImport.importBlockedMissingCategory", { count: rowsMissingCategory.length })
        : rowsMissingDescription.length > 0
          ? t("expenseImport.importBlockedMissingDescription", { count: rowsMissingDescription.length })
          : rowsInvalidAmount.length > 0
            ? t("expenseImport.importBlockedInvalidAmount", { count: rowsInvalidAmount.length })
            : rowsAccepted.length === 0
              ? t("expenseImport.importBlockedNoAccepted")
              : "";
  const canImport =
    rowsAccepted.length > 0 &&
    rowsMissingCategory.length === 0 &&
    rowsMissingDescription.length === 0 &&
    rowsInvalidAmount.length === 0 &&
    !targetMonthClosed &&
    !importing &&
    !parsing &&
    !loadingContext;

  async function importAcceptedRows() {
    if (!canImport) {
      setError(importBlockingMessage || t("expenseImport.importBlockedGeneric"));
      return;
    }
    if (serverFxRate == null || !(serverFxRate > 0)) {
      setError(t("expenseImport.fxRequired"));
      return;
    }

    setImporting(true);
    setError("");

    try {
      const targetDate = `${targetYm.year}-${String(targetYm.month).padStart(2, "0")}`;
      const learnedRulesPayload =
        hasEncryptionSupport && encryptionKey
          ? await Promise.all(
              rowsAccepted.map(async ({ row }) => {
                const merchantNormalized = compactSpaces(row.merchantNormalized ?? "");
                const descriptionSuggested = sanitizeImportedDescription(row.descriptionFinal, row.merchantRaw);
                if (!merchantNormalized || !row.categoryIdFinal || !descriptionSuggested) return null;
                const merchantFingerprint = await buildMerchantRuleFingerprint(encryptionKey, merchantNormalized);
                const encryptedPayload = await encryptPayload({
                  merchantNormalized,
                  merchantRaw: row.merchantRaw,
                  descriptionSuggested,
                });
                if (!encryptedPayload) return null;
                return {
                  merchantFingerprint,
                  categoryId: row.categoryIdFinal,
                  expenseType:
                    row.expenseTypeFinal ||
                    categories.find((category) => category.id === row.categoryIdFinal)?.expenseType ||
                    "VARIABLE",
                  encryptedPayload,
                };
              })
            )
          : [];
      const items = await Promise.all(
        rowsAccepted.map(async ({ statement, row }) => {
          const amount = Math.round(Number(row.amountFinal) * 100) / 100;
          const amountUsd =
            row.currencyIdFinal === "USD" ? amount : Math.round((amount / serverFxRate) * 100) / 100;
          const finalDescription = sanitizeImportedDescription(row.descriptionFinal, row.merchantRaw);
          const encryptedPayload = await encryptPayload({
            description: finalDescription,
            amount,
            amountUsd,
            importMeta: {
              sourceDate: row.date,
              merchantRaw: row.merchantRaw,
              providerLabel: statement.providerLabel,
              fileName: statement.fileName,
              statementDate: statement.statementDate ?? null,
              sourceKind: statement.sourceKind,
            },
          });

          return {
            description: encryptedPayload ? "(encrypted)" : finalDescription,
            amount: encryptedPayload ? 0 : amount,
            amountUsd,
            date: targetDate,
            categoryId: row.categoryIdFinal,
            currencyId: row.currencyIdFinal,
            usdUyuRate: row.currencyIdFinal === "UYU" ? serverFxRate : undefined,
            expenseType: row.expenseTypeFinal || categories.find((category) => category.id === row.categoryIdFinal)?.expenseType || "VARIABLE",
            ...(encryptedPayload ? { encryptedPayload } : {}),
          };
        })
      );

      const result = await api<{ count: number }>("/expenses/import/commit", {
        method: "POST",
        body: JSON.stringify({ items, learnedRules: learnedRulesPayload.filter(Boolean) }),
      });

      const balanceUpdates = new Map<
        string,
        {
          investmentId: string;
          closingBalance: number;
          currencyId: CurrencyId;
        }
      >();

      for (const statement of statements) {
        if (
          statement.sourceKind !== "bank_statement_pdf" ||
          !statement.shouldUpdateMappedAccount ||
          !statement.mappedAccountId ||
          statement.balanceSummary?.closingBalance == null
        ) {
          continue;
        }
        const account = accounts.find((row) => row.id === statement.mappedAccountId);
        if (!account || account.currencyId !== statement.balanceSummary.currencyId) continue;
        balanceUpdates.set(statement.mappedAccountId, {
          investmentId: statement.mappedAccountId,
          closingBalance: statement.balanceSummary.closingBalance,
          currencyId: statement.balanceSummary.currencyId,
        });
      }

      const snapshotResults = await Promise.allSettled(
        Array.from(balanceUpdates.values()).map(async (update) => {
          const closingCapitalUsd =
            update.currencyId === "UYU"
              ? Math.round((update.closingBalance / serverFxRate) * 100) / 100
              : update.closingBalance;
          const encryptedPayload = await encryptPayload({
            closingCapital: update.closingBalance,
            closingCapitalUsd,
          });
          const body = encryptedPayload
            ? {
                encryptedPayload,
                closingCapital: 0,
                usdUyuRate: update.currencyId === "UYU" ? serverFxRate : undefined,
              }
            : {
                closingCapital: update.closingBalance,
                ...(update.currencyId === "UYU" ? { usdUyuRate: serverFxRate } : {}),
              };

          await api(`/investments/${update.investmentId}/snapshots/${nextSnapshotYm.year}/${nextSnapshotYm.month}`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
        })
      );

      const balancesUpdated = snapshotResults.filter((result) => result.status === "fulfilled").length;
      const balancesFailed = snapshotResults.length - balancesUpdated;

      if (balancesUpdated > 0 && balancesFailed === 0) {
        showSuccess(
          t("expenseImport.importedSuccessWithBalances", {
            count: result.count,
            month: targetMonthLabel,
            balanceCount: balancesUpdated,
            nextMonth: nextSnapshotMonthLabel,
          })
        );
      } else if (balancesUpdated > 0 && balancesFailed > 0) {
        showSuccess(
          t("expenseImport.importedSuccessPartialBalances", {
            count: result.count,
            month: targetMonthLabel,
            balanceCount: balancesUpdated,
            nextMonth: nextSnapshotMonthLabel,
          })
        );
      } else {
        showSuccess(t("expenseImport.importedSuccess", { count: result.count, month: targetMonthLabel }));
      }
      nav(`${APP_BASE}/expenses`, { replace: false });
    } catch (err: any) {
      setError(err?.message ?? t("common.error"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SectionCard title={t("expenseImport.uploadTitle")}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label
              className="btn primary"
              title={t("expenseImport.parseLocalNote")}
              style={{ cursor: parsing ? "not-allowed" : "pointer", opacity: parsing ? 0.7 : 1 }}
            >
              <input
                type="file"
                accept="application/pdf"
                multiple
                style={{ display: "none" }}
                disabled={parsing || loadingContext}
                onChange={(event) => {
                  void handleFilesSelected(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
              {parsing ? t("expenseImport.parsing") : t("expenseImport.choosePdf")}
            </label>
            {loadingContext ? (
              <span className="muted" style={{ fontSize: 13 }}>
                {t("common.loading")}
              </span>
            ) : null}
          </div>

          <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
            {targetMonthClosed
              ? t("expenseImport.targetMonthClosed", { month: targetMonthLabel })
              : t("expenseImport.targetMonthNote", { month: targetMonthLabel })}
          </div>
        </div>
      </SectionCard>

      {error ? <div className="card" style={{ color: "var(--danger)" }}>{error}</div> : null}

      {statements.length > 0 ? (
        <div className="grid" style={{ gap: 16 }}>
          {statements.map((statement, statementIndex) => {
            const mappedAccount = accounts.find((account) => account.id === statement.mappedAccountId) ?? null;
            const currencyMismatch =
              !!mappedAccount &&
              !!statement.balanceSummary &&
              mappedAccount.currencyId !== statement.balanceSummary.currencyId;

            return (
            <div key={`${statement.fileName}-${statementIndex}`} className="card" style={{ display: "grid", gap: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 260 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{statement.fileName}</div>
                    <span
                      className="badge"
                      style={{
                        background: kindColor(statement.sourceKind),
                        color: kindTextColor(statement.sourceKind),
                        borderColor: "transparent",
                      }}
                    >
                      {statement.sourceKind === "credit_card_pdf" ? t("expenseImport.creditCardPdf") : t("expenseImport.bankStatementPdf")}
                    </span>
                  </div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55 }}>
                    {statement.providerLabel}
                    {statement.periodLabel ? ` • ${statement.periodLabel}` : ""}
                    {statement.statementDate ? ` • ${t("expenseImport.statementDate")}: ${formatDate(statement.statementDate)}` : ""}
                    {` • ${statement.pageCount} ${t("expenseImport.pages")}`}
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className="badge">{t("expenseImport.rowsDetected", { count: statement.rows.length })}</span>
                  <span className="badge">{t("expenseImport.acceptedCount", { count: acceptedCount(statement.rows) })}</span>
                  <span className="badge">{t("expenseImport.ignoredCount", { count: ignoredCount(statement.rows) })}</span>
                </div>
              </div>

              {statement.sourceKind === "bank_statement_pdf" && statement.balanceSummary ? (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "rgba(59,130,246,0.04)",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{t("expenseImport.accountMappingTitle")}</div>
                  <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 6, minWidth: 280, flex: "1 1 320px" }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t("expenseImport.accountMappingLabel")}
                      </span>
                      <select
                        className="select"
                        value={statement.mappedAccountId}
                        onChange={(event) =>
                          updateStatement(statementIndex, {
                            mappedAccountId: event.target.value,
                            shouldUpdateMappedAccount: !!event.target.value && statement.balanceSummary?.closingBalance != null,
                          })
                        }
                      >
                        <option value="">{t("expenseImport.accountMappingPlaceholder")}</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currencyId}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "grid", gap: 4, minWidth: 160 }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t("expenseImport.detectedOpeningBalance")}
                      </span>
                      <strong>{formatMoney(statement.balanceSummary.openingBalance, statement.balanceSummary.currencyId)}</strong>
                    </div>

                    <div style={{ display: "grid", gap: 4, minWidth: 160 }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {t("expenseImport.detectedClosingBalance")}
                      </span>
                      <strong>{formatMoney(statement.balanceSummary.closingBalance, statement.balanceSummary.currencyId)}</strong>
                    </div>
                  </div>

                  {statement.balanceSummary.accountHint ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t("expenseImport.accountHintDetected", { hint: statement.balanceSummary.accountHint })}
                    </div>
                  ) : null}

                  {accounts.length === 0 ? (
                    <div className="muted" style={{ fontSize: 13 }}>
                      {t("expenseImport.noAccountsAvailable")}
                    </div>
                  ) : null}

                  {currencyMismatch ? (
                    <div style={{ color: "var(--danger)", fontSize: 13 }}>
                      {t("expenseImport.accountCurrencyMismatch")}
                    </div>
                  ) : null}

                  <label className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={statement.shouldUpdateMappedAccount && !!statement.mappedAccountId && !currencyMismatch}
                      disabled={!statement.mappedAccountId || statement.balanceSummary.closingBalance == null || currencyMismatch}
                      onChange={(event) =>
                        updateStatement(statementIndex, {
                          shouldUpdateMappedAccount: event.target.checked,
                        })
                      }
                    />
                    <span>{t("expenseImport.saveClosingBalance")}</span>
                  </label>

                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("expenseImport.saveClosingBalanceHelp", { nextMonth: nextSnapshotMonthLabel })}
                  </div>
                </div>
              ) : null}

              {statement.unsupportedReason ? (
                <div style={{ color: "var(--danger)" }}>{statement.unsupportedReason}</div>
              ) : statement.rows.length === 0 ? (
                <div className="muted">{t("expenseImport.noRows")}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ minWidth: 1240 }}>
                    <thead>
                      <tr>
                        <th>{t("expenses.date")}</th>
                        <th style={{ width: 260 }}>{t("expenseImport.originalDescription")}</th>
                        <th className="right" style={{ width: 140 }}>{t("expenses.amount")}</th>
                        <th style={{ width: 110 }}>{t("expenses.curr")}</th>
                        <th style={{ width: 130 }}>{t("expenseImport.statusColumn")}</th>
                        <th style={{ width: 230 }}>{t("expenseImport.suggestedCategory")}</th>
                        <th style={{ width: 380 }}>{t("expenseImport.finalDescription")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate(row.date)}</td>
                          <td style={{ maxWidth: 260 }}>
                            <div style={{ display: "grid", gap: 4 }}>
                              <span style={{ wordBreak: "break-word" }}>{row.merchantRaw}</span>
                              <span className="muted" style={{ fontSize: 12 }}>
                                {t(`expenseImport.sourceType.${row.sourceType}`)}
                              </span>
                            </div>
                          </td>
                          <td className="right">
                            <input
                              className="input"
                              type="number"
                              step="0.01"
                              value={Number.isFinite(row.amountFinal) ? row.amountFinal : 0}
                              onChange={(event) =>
                                updateReviewRow(statementIndex, row.id, {
                                  amountFinal: toEditableAmount(event.target.value),
                                })
                              }
                              style={{ width: 120, textAlign: "right" }}
                            />
                          </td>
                          <td>
                            <select
                              className="select"
                              value={row.currencyIdFinal}
                              onChange={(event) =>
                                updateReviewRow(statementIndex, row.id, {
                                  currencyIdFinal: event.target.value as "UYU" | "USD",
                                })
                              }
                            >
                              <option value="UYU">UYU</option>
                              <option value="USD">USD</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="select"
                              value={row.status}
                              onChange={(event) =>
                                updateReviewRow(statementIndex, row.id, {
                                  status: event.target.value as ImportRowStatus,
                                })
                              }
                            >
                              <option value="accepted">{t("expenseImport.accepted")}</option>
                              <option value="ignored">{t("expenseImport.ignored")}</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="select"
                              value={row.categoryIdFinal}
                              onChange={(event) => {
                                const category = categories.find((item) => item.id === event.target.value);
                                updateReviewRow(statementIndex, row.id, {
                                  categoryIdFinal: event.target.value,
                                  expenseTypeFinal: category?.expenseType ?? row.expenseTypeFinal,
                                });
                              }}
                            >
                              <option value="">{t("expenseImport.noSuggestion")}</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {getCategoryDisplayName(category, t)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input"
                              value={row.descriptionFinal}
                              onChange={(event) => updateReviewRow(statementIndex, row.id, { descriptionFinal: event.target.value })}
                              style={{ minWidth: 320 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })}

          <div className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 850 }}>{t("expenseImport.importTitle")}</div>
            <div className="muted" style={{ lineHeight: 1.6 }}>
              {t("expenseImport.importBody", { month: targetMonthLabel })}
            </div>
            {!canImport && importBlockingMessage ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(245,158,11,0.12)",
                  color: "rgb(146,64,14)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {importBlockingMessage}
              </div>
            ) : null}
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge">{t("expenseImport.acceptedCount", { count: rowsAccepted.length })}</span>
              {rowsInvalidAmount.length > 0 ? (
                <span className="badge" style={{ background: "rgba(220,38,38,0.08)", color: "rgb(153,27,27)", borderColor: "transparent" }}>
                  {t("expenseImport.invalidAmount", { count: rowsInvalidAmount.length })}
                </span>
              ) : null}
              {rowsMissingCategory.length > 0 ? (
                <span className="badge" style={{ background: "rgba(220,38,38,0.08)", color: "rgb(153,27,27)", borderColor: "transparent" }}>
                  {t("expenseImport.missingCategory", { count: rowsMissingCategory.length })}
                </span>
              ) : null}
              {rowsMissingDescription.length > 0 ? (
                <span className="badge" style={{ background: "rgba(220,38,38,0.08)", color: "rgb(153,27,27)", borderColor: "transparent" }}>
                  {t("expenseImport.missingDescription", { count: rowsMissingDescription.length })}
                </span>
              ) : null}
            </div>
            <div>
              <button className="btn primary" type="button" onClick={importAcceptedRows} disabled={!canImport}>
                {importing ? t("expenseImport.importingSelected") : t("expenseImport.importSelected")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
