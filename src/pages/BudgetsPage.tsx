import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth, useDisplayCurrency } from "../layout/AppShell";
import { downloadCsv } from "../utils/exportCsv";
import { getFxDefault } from "../utils/fx";
import { formatAmountUsdWith } from "../utils/formatCurrency";

type AnnualResp = {
  year: number;
  months: Array<{
    month: number; // 1..12
    isClosed: boolean;
    incomeUsd: number;

    baseExpensesUsd: number;
    otherExpensesUsd: number;

    // total expenses (base + other) - backend lo devuelve
    expensesUsd: number;

    investmentEarningsUsd: number;
    balanceUsd: number;
    netWorthUsd: number; // start
    source: "locked" | "computed";
  }>;
};

const m2 = (m: number) => String(m).padStart(2, "0");
const months12 = Array.from({ length: 12 }, (_, i) => i + 1);

type DraftMap = Record<number, { other?: string }>;

function sanitizeNumber(raw: string) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export default function BudgetsPage() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, serverFxRate } = useAppShell();
  const { year, month: currentMonth } = useAppYearMonth();
  const { formatAmountUsd, currencyLabel, preferredDisplayCurrencyId } = useDisplayCurrency();

  const [otherExpensesCurrency, setOtherExpensesCurrency] = useState<"USD" | "UYU">(
    () => preferredDisplayCurrencyId
  );

  const otherExpensesRate = serverFxRate ?? getFxDefault();
  const otherExpensesRateOrNull = otherExpensesCurrency === "UYU" && Number.isFinite(otherExpensesRate) && otherExpensesRate > 0 ? otherExpensesRate : null;

  const tableRef = useRef<HTMLDivElement>(null);
  const onboardingActive = meLoaded && !!me && onboardingStep === "budget";

  function goTable() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function skipOnboarding() {
    setOnboardingStep("done");
    nav(APP_BASE, { replace: false });
  }
  function markStepDone() {
    setOnboardingStep("dashboard");
    nav(APP_BASE, { replace: false });
  }

  useEffect(() => {
    setHeader({
      title: t("budgets.title"),
      subtitle: (
        <>
          {t("budgets.subtitlePrefix", { year })} (
          <span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
        </>
      ),
    });
  }, [setHeader, year, t, currencyLabel]);

  const [data, setData] = useState<AnnualResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [drafts, setDrafts] = useState<DraftMap>({});

  function setDraft(month: number, patch: { other?: string }) {
    setDrafts((prev) => ({ ...prev, [month]: { ...(prev[month] ?? {}), ...patch } }));
  }
  function clearDraft(month: number) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api<AnnualResp>(`/budgets/annual?year=${year}`);
      setData(r);
      setDrafts({});
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const months = useMemo(() => {
    const raw = data?.months ?? [];
    const byMonth = new Map(raw.map((m) => [m.month, m]));
    return months12.map((m) => {
      const x = byMonth.get(m);
      return (
        x ?? {
          month: m,
          isClosed: false,
          incomeUsd: 0,
          baseExpensesUsd: 0,
          otherExpensesUsd: 0,
          expensesUsd: 0,
          investmentEarningsUsd: 0,
          balanceUsd: 0,
          netWorthUsd: 0,
          source: "computed" as const,
        }
      );
    });
  }, [data]);

  const netWorthStartSeries = useMemo(() => {
    if (months.length === 0) return [];

    const out = months12.map(() => 0);
    out[0] = months[0]?.netWorthUsd ?? 0;

    for (let i = 1; i < 12; i++) {
      const curr = months[i];
      const prev = months[i - 1];

      if (curr?.isClosed) out[i] = curr.netWorthUsd ?? out[i - 1];
      else out[i] = (out[i - 1] ?? 0) + (prev?.balanceUsd ?? 0);
    }

    return out;
  }, [months]);

  const totals = useMemo(() => {
    const t = { income: 0, base: 0, other: 0, expenses: 0, earnings: 0, balance: 0 };
    for (const m of months) {
      t.income += m.incomeUsd ?? 0;
      t.base += m.baseExpensesUsd ?? 0;
      t.other += m.otherExpensesUsd ?? 0;
      t.expenses += m.expensesUsd ?? 0;
      t.earnings += m.investmentEarningsUsd ?? 0;
      t.balance += m.balanceUsd ?? 0;
    }
    return t;
  }, [months]);

  async function saveOtherExpenses(month: number, value: number) {
    if (!Number.isFinite(value)) return;
    const payload =
      otherExpensesCurrency === "UYU"
        ? { amount: value, currencyId: "UYU" as const, usdUyuRate: otherExpensesRate }
        : { otherExpensesUsd: value };
    await api(`/budgets/other-expenses/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    await load();
  }

  function exportBudgetCsv() {
    const headers = [
      t("budgets.exportConcept"),
      ...months12.map((m) => m2(m)),
      t("budgets.total"),
    ];
    const rows = [
      [t("budgets.income"), ...months.map((m) => m.incomeUsd ?? 0), totals.income],
      [t("budgets.baseExpenses"), ...months.map((m) => m.baseExpensesUsd ?? 0), totals.base],
      [t("budgets.otherExpenses"), ...months.map((m) => m.otherExpensesUsd ?? 0), totals.other],
      [t("budgets.expensesCol"), ...months.map((m) => m.expensesUsd ?? 0), totals.expenses],
      [t("budgets.investmentEarnings"), ...months.map((m) => m.investmentEarningsUsd ?? 0), totals.earnings],
      [t("budgets.balance"), ...months.map((m) => m.balanceUsd ?? 0), totals.balance],
      [t("budgets.netWorthCol"), ...months.map((m) => m.netWorthUsd ?? 0), ""],
      [t("budgets.exportClosed"), ...months.map((m) => (m.isClosed ? t("common.closed") : t("common.open"))), ""],
    ];
    downloadCsv(`presupuesto-${year}`, headers, rows);
  }

  return (
    <div className="grid">
      {/* ✅ Onboarding banner (Step 4) */}
      {onboardingActive && (
        <div className="card" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(15,23,42,0.02)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{t("budgets.step4Title")}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 780 }}>
                <Trans i18nKey="budgets.step4Desc" components={{ b: <b /> }} />
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {t("budgets.step4Tip")}
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="button" onClick={goTable} style={{ height: 40 }}>
                {t("budgets.goToTable")}
              </button>
              <button className="btn primary" type="button" onClick={markStepDone} style={{ height: 40 }}>
                {t("budgets.doneNextDashboard")}
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Resumen (como Gastos) */}
      <div className="card budgets-page budgets-summary-card-standalone">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 850, fontSize: 18 }}>
              {t("budgets.summaryPrefix")} (<span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t("budgets.closedMonthsLocked")}</div>
          </div>
          <div className="row" style={{ gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{t("budgets.summaryBalanceLabel")}</div>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2, color: (totals.balance ?? 0) >= 0 ? "var(--brand-green)" : "var(--danger)" }}>
                {formatAmountUsd(totals.balance ?? 0)}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{t("budgets.summaryIncomeLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{formatAmountUsd(totals.income)}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{t("budgets.summaryExpensesLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{formatAmountUsd(totals.expenses)}</div>
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Badge>{loading ? t("common.loading") : t("common.ready")}</Badge>
          <button className="btn" type="button" onClick={load}>
            {loading ? (
              <span className="loading-inline">
                <span className="loading-spinner" aria-hidden />
                {t("common.loading")}
              </span>
            ) : (
              t("common.refresh")
            )}
          </button>
          <button className="btn" type="button" onClick={exportBudgetCsv} aria-label={t("common.exportCsv")}>
            {t("common.exportCsv")}
          </button>
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </div>
      </div>

      {/* Card Presupuesto anual */}
      <div className="card budgets-page" ref={tableRef}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {t("budgets.annualBudgetPrefix")} (<span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{t("budgets.closedMonthsLocked")}</div>
          </div>
        </div>

        {totals.income === 0 && totals.base === 0 && !loading && (
          <div className="muted" style={{ marginTop: 12, padding: 12, background: "var(--bg)", borderRadius: "var(--radius-md)", fontSize: 12 }}>
            {t("budgets.emptyStateBudget")}
          </div>
        )}

        <div className="budgets-table-wrap" style={{ overflowX: "auto", marginTop: 12 }} role="region" aria-label="Annual budget by month">
          <table className="table compact budgets-table" aria-label="Budget grid: income, expenses, balance by month">
            <thead>
              <tr>
                <th className="budgets-th-label" style={{ width: 180 }}></th>
                {months.map((m) => (
                  <th
                    key={`h-${m.month}`}
                    className={`right ${m.month === currentMonth ? "budgets-th-current" : ""}`}
                    title={m.isClosed ? t("common.closed") : m.month === currentMonth ? t("investments.summaryCurrentMonth") : t("common.open")}
                    style={{ minWidth: 76 }}
                  >
                    {m2(m.month)}{m.month === currentMonth ? " ★" : ""}
                  </th>
                ))}
                <th className="right budgets-th-total" style={{ width: 110 }}>
                  {t("budgets.total")}
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Income (read-only; edited in Ingresos tab) */}
              <tr className="budgets-tr-income">
                <td className="budgets-td-label" style={{ fontWeight: 750 }}>
                  <span
                    className="budgets-label-with-hint"
                    title={t("budgets.editInIncomeHint")}
                  >
                    {t("budgets.income")}
                  </span>
                </td>
                {months.map((m) => (
                  <td
                    key={`inc-${m.month}`}
                    className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`}
                    title={m.source}
                  >
                    {formatAmountUsd(m.incomeUsd)}
                  </td>
                ))}
                <td className="right budgets-td-total" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.income)}
                </td>
              </tr>

              {/* Base expenses (actuals if any, else drafts planned) */}
              <tr className="budgets-tr-base">
                <td className="budgets-td-label" style={{ fontWeight: 750 }}>
                  <span
                    className="budgets-label-with-hint"
                    title={t("budgets.editInExpensesHint")}
                  >
                    {t("budgets.baseExpenses")}
                  </span>
                </td>
                {months.map((m) => (
                  <td
                    key={`base-${m.month}`}
                    className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`}
                    title={t("budgets.actualsOrDrafts")}
                  >
                    {formatAmountUsd(m.baseExpensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right budgets-td-total" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.base)}
                </td>
              </tr>

              {/* Other expenses (manual editable) */}
              <tr className="budgets-tr-other">
                <td className="budgets-td-label" style={{ fontWeight: 750 }} title={t("budgets.otherExpensesDesc")}>
                  <span className="row budgets-otros-row" style={{ gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
                    <span>{t("budgets.otherExpenses")}</span>
                    <select
                      className="select budgets-otros-select"
                      value={otherExpensesCurrency}
                      onChange={(e) => setOtherExpensesCurrency(e.target.value as "USD" | "UYU")}
                      aria-label={t("income.currencyLabel")}
                    >
                      <option value="USD">USD</option>
                      <option value="UYU">UYU</option>
                    </select>
                  </span>
                </td>
                {months.map((m) => {
                  const displayValue =
                    otherExpensesCurrency === "UYU"
                      ? Math.round((m.otherExpensesUsd ?? 0) * otherExpensesRate)
                      : Math.round(m.otherExpensesUsd ?? 0);
                    return (
                    <td key={`other-${m.month}`} className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`} title={m.source}>
                      {m.isClosed ? (
                        <span className="muted" title={t("common.closed")} style={{ whiteSpace: "nowrap" }}>
                          {formatAmountUsdWith(m.otherExpensesUsd ?? 0, otherExpensesCurrency, otherExpensesRateOrNull)}
                        </span>
                      ) : (
                        <input
                          className="input compact budgets-input-other"
                          value={drafts[m.month]?.other ?? String(displayValue)}
                          style={{ width: 72, minWidth: 72, textAlign: "right" }}
                          onChange={(e) => setDraft(m.month, { other: e.target.value })}
                          onBlur={async () => {
                            const raw = (drafts[m.month]?.other ?? "").trim();
                            if (raw === "") return;

                            const n = sanitizeNumber(raw);
                            if (n == null) return;

                            try {
                              await saveOtherExpenses(m.month, n);
                              clearDraft(m.month);
                            } catch (err: any) {
                              setError(err?.message ?? t("budgets.errorSavingOtherExpenses"));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="right budgets-td-total" style={{ fontWeight: 850, whiteSpace: "nowrap" }}>
                  {formatAmountUsdWith(totals.other, otherExpensesCurrency, otherExpensesRateOrNull)}
                </td>
              </tr>

              {/* Total expenses */}
              <tr className="budgets-tr-expenses">
                <td className="budgets-td-label" style={{ fontWeight: 800 }}>{t("budgets.expensesCol")}</td>
                {months.map((m) => (
                  <td key={`exp-${m.month}`} className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`} title={t("budgets.basePlusOther")} style={{ fontWeight: 800 }}>
                    {formatAmountUsd(m.expensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right budgets-td-total" style={{ fontWeight: 900 }}>
                  {formatAmountUsd(totals.expenses)}
                </td>
              </tr>

              {totals.earnings !== 0 && (
              <tr className="budgets-tr-earnings">
                <td className="budgets-td-label" style={{ fontWeight: 750 }}>{t("budgets.investmentEarnings")}</td>
                {months.map((m) => (
                  <td key={`earn-${m.month}`} className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`}
                    style={{ opacity: m.isClosed ? 1 : 0.85 }}
                    title={t("budgets.realReturnsPortfolio")}>
                    {formatAmountUsd(m.investmentEarningsUsd ?? 0)}
                  </td>
                ))}
                <td className="right budgets-td-total" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.earnings)}
                </td>
              </tr>
              )}

              {/* Balance — separador visual */}
              <tr className="budgets-tr-balance">
                <td className="budgets-td-label" style={{ fontWeight: 900 }}>{t("budgets.balance")}</td>
                {months.map((m) => (
                  <td
                    key={`bal-${m.month}`}
                    className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`}
                    style={{
                      fontWeight: 900,
                      opacity: m.isClosed ? 1 : 0.9,
                      color: (m.balanceUsd ?? 0) < 0 ? "var(--danger)" : undefined,
                    }}
                    title={t("budgets.incomeMinusExpensesEarnings")}
                  >
                    {formatAmountUsd(m.balanceUsd ?? 0)}
                  </td>
                ))}
                <td className="right budgets-td-total" style={{ fontWeight: 950, color: totals.balance < 0 ? "var(--danger)" : undefined }}>
                  {formatAmountUsd(totals.balance)}
                </td>
              </tr>

              {/* Net worth (start) */}
              <tr className="budgets-tr-networth">
                <td className="budgets-td-label" style={{ fontWeight: 750 }}>{t("budgets.netWorthStart")}</td>
                {months.map((m, idx) => (
                  <td key={`nw-${m.month}`} className={`right ${m.month === currentMonth ? "budgets-td-current" : ""}`} title={t("budgets.startOfMonth")}>
                    {formatAmountUsd(netWorthStartSeries[idx] ?? 0)}
                  </td>
                ))}
                <td className="right budgets-td-total muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="budgets-tip" style={{ marginTop: 16 }}>
          {t("budgets.tipBaseExpenses")}
        </div>

        <style>{`
          /* Table: compact, smaller fonts, no wrap */
          .budgets-page .budgets-table.compact th,
          .budgets-page .budgets-table.compact td {
            padding: 6px 8px;
            font-size: 12px;
          }
          .budgets-page .budgets-table.compact td.right,
          .budgets-page .budgets-table.compact th.right {
            white-space: nowrap;
          }
          .budgets-page .budgets-table-wrap {
            position: relative;
          }
          .budgets-page .budgets-th-label,
          .budgets-page .budgets-td-label {
            position: sticky;
            left: 0;
            z-index: 1;
            background: var(--card) !important;
          }
          .budgets-page .budgets-th-label {
            background: var(--bg) !important;
          }
          .budgets-page .budgets-table tbody tr:nth-child(even) .budgets-td-label {
            background: rgba(15,23,42,0.03) !important;
          }
          .budgets-page .budgets-table tbody tr.budgets-tr-balance .budgets-td-label,
          .budgets-page .budgets-table tbody tr.budgets-tr-networth .budgets-td-label {
            background: rgba(15,23,42,0.04) !important;
          }
          .budgets-page .budgets-table tbody tr:nth-child(even).budgets-tr-balance .budgets-td-label,
          .budgets-page .budgets-table tbody tr:nth-child(even).budgets-tr-networth .budgets-td-label {
            background: rgba(15,23,42,0.05) !important;
          }
          .budgets-page .budgets-table tbody tr:nth-child(even) td:not(.budgets-td-label) {
            background: rgba(15,23,42,0.03);
          }
          /* Mes actual: como Patrimonio (★ + var(--bg)) */
          .budgets-page .budgets-th-current {
            background: var(--bg) !important;
            font-weight: 700;
          }
          .budgets-page .budgets-td-current {
            background: var(--bg) !important;
          }
          .budgets-page .budgets-th-total {
            background: rgba(15,23,42,0.05) !important;
            font-weight: 700;
          }
          .budgets-page .budgets-td-total {
            background: rgba(15,23,42,0.05) !important;
          }
          .budgets-page .budgets-tr-balance {
            border-top: 1px solid rgba(15,23,42,0.12);
          }

          /* Label con tooltip */
          .budgets-page .budgets-label-with-hint {
            border-bottom: 1px dotted var(--muted);
          }

          /* Otros gastos: label + select en una línea */
          .budgets-page .budgets-otros-select {
            width: 56px;
            min-width: 56px;
            height: 26px;
            font-size: 11px;
            padding: 2px 6px;
            line-height: 1.3;
          }

          /* Input focus for other expenses */
          .budgets-page .budgets-input-other:focus {
            outline: 2px solid var(--brand-green);
            outline-offset: 1px;
          }
          .budgets-page .budgets-input-other {
            font-size: 11px;
            min-width: 56px;
          }

          /* Tip: fondo gris */
          .budgets-page .budgets-tip {
            padding: 10px 12px;
            background: rgba(15,23,42,0.04);
            border-left: 3px solid var(--muted);
            border-radius: 0 var(--radius-md) var(--radius-md) 0;
            font-size: 11px;
          }

          .input.compact { padding: 4px 6px; font-size: 11px; border-radius: var(--radius-md); }
        `}</style>
      </div>
    </div>
  );
}