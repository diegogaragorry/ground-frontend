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
  const { year } = useAppYearMonth();
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

      <div className="card" ref={tableRef}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 850, fontSize: 16 }}>
              {t("budgets.annualBudgetPrefix")} (
              <span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t("budgets.closedMonthsLocked")}
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
          </div>
        </div>

        {error && <div style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>}

        <div style={{ overflowX: "auto", marginTop: 12 }} role="region" aria-label="Annual budget by month">
          <table className="table compact" aria-label="Budget grid: income, expenses, balance by month">
            <thead>
              <tr>
                <th style={{ width: 150 }}></th>
                {months.map((m) => (
                  <th key={`h-${m.month}`} className="right" title={m.isClosed ? t("common.closed") : t("common.open")} style={{ minWidth: 60 }}>
                    {m2(m.month)}
                  </th>
                ))}
                <th className="right" style={{ width: 110 }}>
                  {t("budgets.total")}
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Income (read-only; edited in Ingresos tab) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.income")}</td>
                {months.map((m) => (
                  <td key={`inc-${m.month}`} className="right" title={m.source}>
                    {formatAmountUsd(m.incomeUsd)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.income)}
                </td>
              </tr>

              {/* Base expenses (actuals if any, else drafts planned) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.baseExpenses")}</td>
                {months.map((m) => (
                  <td key={`base-${m.month}`} className="right" title={t("budgets.actualsOrDrafts")}>
                    {formatAmountUsd(m.baseExpensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.base)}
                </td>
              </tr>

              {/* Other expenses (manual editable) */}
              <tr>
                <td style={{ fontWeight: 750 }}>
                  <span className="row" style={{ gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
                    {t("budgets.otherExpenses")}
                    <select
                      className="select"
                      value={otherExpensesCurrency}
                      onChange={(e) => setOtherExpensesCurrency(e.target.value as "USD" | "UYU")}
                      style={{ width: 72, minWidth: 72, height: 32, fontSize: 11, lineHeight: 1.5, padding: "4px 8px", boxSizing: "border-box" }}
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
                    <td key={`other-${m.month}`} className="right" title={m.source}>
                      {m.isClosed ? (
                        <span className="muted" title={t("common.closed")} style={{ whiteSpace: "nowrap" }}>
                          {formatAmountUsdWith(m.otherExpensesUsd ?? 0, otherExpensesCurrency, otherExpensesRateOrNull)}
                        </span>
                      ) : (
                        <input
                          className="input compact"
                          value={drafts[m.month]?.other ?? String(displayValue)}
                          style={{ width: 70, textAlign: "right" }}
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
                <td className="right" style={{ fontWeight: 850, whiteSpace: "nowrap" }}>
                  {formatAmountUsdWith(totals.other, otherExpensesCurrency, otherExpensesRateOrNull)}
                </td>
              </tr>

              {/* Total expenses */}
              <tr>
                <td style={{ fontWeight: 800 }}>{t("budgets.expensesCol")}</td>
                {months.map((m) => (
                  <td key={`exp-${m.month}`} className="right" title={t("budgets.basePlusOther")} style={{ fontWeight: 800 }}>
                    {formatAmountUsd(m.expensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 900 }}>
                  {formatAmountUsd(totals.expenses)}
                </td>
              </tr>

              {/* Investment earnings */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.investmentEarnings")}</td>
                {months.map((m) => (
                  <td key={`earn-${m.month}`} className="right" style={{ opacity: m.isClosed ? 1 : 0.85 }} title={t("budgets.realReturnsPortfolio")}>
                    {formatAmountUsd(m.investmentEarningsUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {formatAmountUsd(totals.earnings)}
                </td>
              </tr>

              {/* Balance */}
              <tr>
                <td style={{ fontWeight: 900 }}>{t("budgets.balance")}</td>
                {months.map((m) => (
                  <td
                    key={`bal-${m.month}`}
                    className="right"
                    style={{ fontWeight: 900, opacity: m.isClosed ? 1 : 0.9 }}
                    title={t("budgets.incomeMinusExpensesEarnings")}
                  >
                    {formatAmountUsd(m.balanceUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 950 }}>
                  {formatAmountUsd(totals.balance)}
                </td>
              </tr>

              {/* Net worth (start) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.netWorthStart")}</td>
                {months.map((m, idx) => (
                  <td key={`nw-${m.month}`} className="right" title={t("budgets.startOfMonth")}>
                    {formatAmountUsd(netWorthStartSeries[idx] ?? 0)}
                  </td>
                ))}
                <td className="right muted">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {t("budgets.tipBaseExpenses")}
        </div>

        <style>{`
          .table.compact th, .table.compact td { padding: 6px 8px; }
          .input.compact { padding: 6px 8px; border-radius: var(--radius-md); }
        `}</style>
      </div>
    </div>
  );
}