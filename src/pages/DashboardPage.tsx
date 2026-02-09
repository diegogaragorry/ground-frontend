import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";
import { getCategoryDisplayName, getTemplateDescriptionDisplay } from "../utils/categoryI18n";

type Expense = {
  id: string;
  description: string;
  amount: number;
  amountUsd: number;
  currencyId: string;
  date: string;
  expenseType?: string;
  category: { id: string; name: string; nameKey?: string | null; expenseType?: string };
};

type SummaryRow = {
  categoryId: string;
  categoryName: string;
  nameKey?: string | null;
  expenseType?: string | null;
  total: number;
};

type ExpensesSummary = {
  year: number;
  month: number;
  totalsByCategoryAndCurrency: SummaryRow[];
};

type Investment = {
  id: string;
  targetAnnualReturn: number;
  yieldStartMonth: number;
};

type SnapshotMonth = {
  month: number;
  closingCapitalUsd: number | null;
};

type AnnualBudgetResp = {
  year: number;
  months: Array<{
    month: number;
    incomeUsd: number;
    expensesUsd: number;
    baseExpensesUsd?: number;
    otherExpensesUsd?: number;
    investmentEarningsUsd: number;
    balanceUsd: number;
    netWorthUsd: number;
    isClosed: boolean;
    source: "locked" | "computed" | string;
  }>;
};

const usd0 = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const months = Array.from({ length: 12 }, (_, i) => i + 1);

function month2(n: number) {
  return String(n).padStart(2, "0");
}

/* ---------------- Net worth helpers ---------------- */

function snapsByMonth(snaps: SnapshotMonth[]) {
  const map: Record<number, SnapshotMonth | undefined> = {};
  for (const s of snaps) map[s.month] = s;
  return map;
}

function monthlyFactor(inv: Investment) {
  return 1 + (inv.targetAnnualReturn ?? 0) / 12;
}

function capitalUsd(inv: Investment, snaps: SnapshotMonth[], m: number) {
  const byM = snapsByMonth(snaps);
  const s = byM[m];
  if (s?.closingCapitalUsd != null) return s.closingCapitalUsd;

  for (let i = m - 1; i >= 1; i--) {
    const prev = byM[i];
    if (prev?.closingCapitalUsd != null) {
      const diff = m - Math.max(inv.yieldStartMonth ?? 1, i);
      return diff <= 0 ? prev.closingCapitalUsd : prev.closingCapitalUsd * Math.pow(monthlyFactor(inv), diff);
    }
  }
  return 0;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const CATEGORY_CHART_PALETTE = [
  "hsl(220, 70%, 50%)",
  "hsl(160, 60%, 42%)",
  "hsl(35, 90%, 48%)",
  "hsl(340, 75%, 52%)",
  "hsl(260, 60%, 55%)",
  "hsl(190, 70%, 42%)",
  "hsl(20, 85%, 52%)",
  "hsl(280, 55%, 50%)",
  "hsl(145, 50%, 40%)",
  "hsl(200, 65%, 45%)",
  "hsl(0, 60%, 50%)",
  "hsl(50, 80%, 48%)",
];

function DonutChart({
  items,
}: {
  items: Array<{ categoryId: string; label: string; percentage: number }>;
}) {
  const cx = 70;
  const cy = 70;
  const r = 50;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = items.map((item, i) => {
    const len = (item.percentage / 100) * circumference;
    const seg = {
      key: item.categoryId,
      color: CATEGORY_CHART_PALETTE[i % CATEGORY_CHART_PALETTE.length],
      label: item.label.length > 10 ? item.label.slice(0, 9) + "…" : item.label,
      pct: item.percentage.toFixed(0),
      dashArray: `${len} ${circumference}`,
      dashOffset: -offset,
    };
    offset += len;
    return seg;
  });

  return (
    <div className="donutChartWrap">
      <svg
        className="donutChartSvg"
        viewBox="4 4 132 132"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>
      <div className="donutLegend">
        {segments.map((s) => (
          <div key={s.key} className="donutLegendItem">
            <span className="donutLegendDot" style={{ background: s.color }} />
            <span className="donutLegendLabel">{s.label}</span>
            <span className="donutLegendPct">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { setHeader, reopenOnboarding, onboardingStep, setOnboardingStep, meLoaded, me } = useAppShell();
  const { year, month } = useAppYearMonth();

  const onboardingActive = meLoaded && !!me && onboardingStep === "dashboard";

  function finishOnboarding() {
    setOnboardingStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function skipOnboarding() {
    setOnboardingStep("done");
  }

  const { t } = useTranslation();
  useEffect(() => {
    setHeader({
      title: t("dashboard.title"),
      subtitle: t("dashboard.subtitle"),
    });
  }, [setHeader, t]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotMonth[]>>({});

  const [annual, setAnnual] = useState<AnnualBudgetResp | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [sum, list, invs, annualResp] = await Promise.all([
        api<ExpensesSummary>(`/expenses/summary?year=${year}&month=${month}`),
        api<Expense[]>(`/expenses?year=${year}&month=${month}`),
        api<Investment[]>("/investments"),
        api<AnnualBudgetResp>(`/budgets/annual?year=${year}`),
      ]);

      setSummary(sum);
      setExpenses(list);
      setInvestments(invs);
      setAnnual(annualResp);

      const snaps: Record<string, SnapshotMonth[]> = {};
      for (const inv of invs) {
        const r = await api<{ months: SnapshotMonth[] }>(`/investments/${inv.id}/snapshots?year=${year}`);
        snaps[inv.id] = r.months;
      }
      setSnapshots(snaps);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  /* ---------------- Monthly ---------------- */

  const monthlyExpenses = useMemo(() => expenses.reduce((a, e) => a + (e.amountUsd ?? 0), 0), [expenses]);

  const topCategories = useMemo(
    () =>
      [...(summary?.totalsByCategoryAndCurrency ?? [])]
        .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
        .slice(0, 4),
    [summary]
  );

  const topExpenses = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))
        .slice(0, 3),
    [expenses]
  );

  const maxTopCat = useMemo(() => Math.max(0, ...topCategories.map((x) => x.total ?? 0)), [topCategories]);
  const maxTopExp = useMemo(() => Math.max(0, ...topExpenses.map((x) => x.amountUsd ?? 0)), [topExpenses]);

  // Todas las categorías del mes con porcentaje para la torta (máx. 7: top 6 + "Otras")
  const categoriesForPie = useMemo(() => {
    const rows = summary?.totalsByCategoryAndCurrency ?? [];
    const totalSum = rows.reduce((a, c) => a + (c.total ?? 0), 0);
    const sorted = [...rows]
      .map((c) => ({
        ...c,
        percentage: totalSum > 0 ? ((c.total ?? 0) / totalSum) * 100 : 0,
      }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .filter((c) => c.percentage > 0);
    if (sorted.length <= 7) return sorted;
    const top6 = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const othersTotal = rest.reduce((a, c) => a + (c.total ?? 0), 0);
    const othersPct = rest.reduce((a, c) => a + c.percentage, 0);
    return [
      ...top6,
      {
        categoryId: "__others",
        categoryName: "Others",
        nameKey: "others",
        total: othersTotal,
        percentage: othersPct,
        expenseType: undefined as string | undefined,
      },
    ];
  }, [summary]);

  /* ---------------- Net worth ---------------- */

  const netWorthByMonth = useMemo(
    () =>
      months.map((m) =>
        investments.reduce((acc, inv) => acc + capitalUsd(inv, snapshots[inv.id] ?? [], m), 0)
      ),
    [investments, snapshots]
  );

  const netWorthStartMonth = useMemo(() => {
    if (month === 1) return netWorthByMonth[0] ?? 0;
    return netWorthByMonth[month - 2] ?? 0;
  }, [month, netWorthByMonth]);

  const netWorthCurrentMonth = useMemo(() => netWorthByMonth[month - 1] ?? 0, [month, netWorthByMonth]);

  /* ---------------- Annual ---------------- */

  const annualMonth = useMemo(() => (annual?.months ?? []).find((m) => m.month === month) ?? null, [annual, month]);

  const annualTotals = useMemo(() => {
    const ms = annual?.months ?? [];
    let income = 0;
    let expensesUsd = 0;
    let earnings = 0;
    let balance = 0;

    for (const m of ms) {
      income += m.incomeUsd ?? 0;
      expensesUsd += m.expensesUsd ?? 0;
      earnings += m.investmentEarningsUsd ?? 0;
      balance += m.balanceUsd ?? 0;
    }

    const dec = ms.find((x) => x.month === 12);
    const netWorthEndYear = (dec?.netWorthUsd ?? 0) + (dec?.balanceUsd ?? 0);

    return { income, expenses: expensesUsd, earnings, balance, netWorthEndYear };
  }, [annual]);

  const monthIncome = annualMonth?.incomeUsd ?? 0;
  const monthBalance = annualMonth?.balanceUsd ?? 0;

  const sourceBadge = annualMonth?.source ?? "computed";
  const isLocked = annualMonth?.isClosed ?? false;

  return (
    <div className="dash">
      {/* Toolbar: status chip + actions (title is in Topbar) */}
      <div className="dashTop">
        <div className="dashTopLeft">
          <span className={`chip ${isLocked ? "chipLocked" : ""}`} title={isLocked ? t("dashboard.monthClosed") : t("common.computed")}>
            {isLocked ? t("common.locked") : t("common.open")} • {sourceBadge === "locked" ? t("common.locked") : t("common.computed")}
          </span>
        </div>

        <div className="dashActions">
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
          <button className="btn" type="button" onClick={reopenOnboarding} title={t("dashboard.reopenOnboarding")}>
            {t("dashboard.setupGuide")}
          </button>
        </div>
      </div>

      {onboardingActive && (
        <div className="card onb" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{t("dashboard.step5Title")}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 780 }}>
                {t("dashboard.step5Desc")}
              </div>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <button className="btn primary" type="button" onClick={finishOnboarding} style={{ height: 40 }}>
                {t("dashboard.finishOnboarding")}
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="card" style={{ color: "var(--danger)", marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* KPI GRID */}
      <div className="kpiGrid">
        <div className="card kpi kpiHighlight">
          <div className="kpiLabel">{t("dashboard.monthlyExpenses")}</div>
          <div className="kpiValue">{usd0.format(monthlyExpenses)}</div>
          <div className="kpiFoot muted">
            {year}-{month2(month)} • USD
          </div>
        </div>

        <div className="card kpi">
          <div className="kpiLabel">{t("dashboard.monthlyIncome")}</div>
          <div className="kpiValue">{usd0.format(monthIncome)}</div>
          <div className="kpiFoot muted">{t("dashboard.fromBudgets")}</div>
        </div>

        <div className="card kpi kpiHighlight">
          <div className="kpiLabel">{t("dashboard.monthlySavings")}</div>
          <div className="kpiValue">{usd0.format(monthBalance)}</div>
          <div className="kpiFoot muted">{t("dashboard.incomeMinusExpenses")}</div>
        </div>

        <div className="card kpi">
          <div className="kpiLabel">{t("dashboard.netWorth")}</div>
          <div className="kpiValue">{usd0.format(netWorthCurrentMonth)}</div>
          <div className="kpiFoot muted">{t("dashboard.start")}: {usd0.format(netWorthStartMonth)}</div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="dashGrid">
        {/* LEFT */}
        <div className="col">
          <div className="sectionHead">
            <div className="sectionTitle">{t("dashboard.thisMonth")}</div>
            <div className="muted">{year}-{month2(month)}</div>
          </div>

          <div className="card list cardCategoriesSplit">
            <div className="cardHead">
              <div className="cardTitle">{t("dashboard.topCategories")}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.bySpend")}
              </div>
            </div>

            <div className="categoriesSplitInner">
              <div className="categoriesSplitList">
                {topCategories.map((c) => {
                  const pct = clamp01((c.total ?? 0) / (maxTopCat || 1));
                  const categoryDisplayName = getCategoryDisplayName(
                    { name: c.categoryName, nameKey: c.nameKey ?? undefined, expenseType: c.expenseType ?? undefined },
                    t
                  );
                  return (
                    <div key={c.categoryId} className="rowLine">
                      <div className="rowLeft">
                        <div className="rowTitle">{categoryDisplayName}</div>
                        <div className="bar">
                          <div className="barFill" style={{ width: `${pct * 100}%` }} />
                        </div>
                      </div>
                      <div className="rowRight">{usd0.format(c.total ?? 0)}</div>
                    </div>
                  );
                })}

                {topCategories.length === 0 && (
                  <div className="muted">
                    <Trans i18nKey="dashboard.noCategories" components={{ 1: <Link to="/expenses" /> }} />
                  </div>
                )}
              </div>

              <div className="categoriesSplitChart">
                {categoriesForPie.length > 0 ? (
                  <DonutChart
                    items={categoriesForPie.map((c) => ({
                      ...c,
                      label:
                        c.categoryId === "__others"
                          ? t("categories.other")
                          : getCategoryDisplayName(
                              { name: c.categoryName, nameKey: c.nameKey ?? undefined, expenseType: c.expenseType ?? undefined },
                              t
                            ),
                    }))}
                  />
                ) : (
                  <div className="muted chartEmpty">{t("dashboard.pieNoData")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="card list cardTopExpenses">
            <div className="cardHead cardHeadCompact">
              <div className="cardTitle">{t("dashboard.topExpenses")}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.largestItems")}
              </div>
            </div>

            {topExpenses.map((e) => {
              const pct = clamp01((e.amountUsd ?? 0) / (maxTopExp || 1));
              const categoryForDisplay = e.category
                ? { ...e.category, expenseType: e.category.expenseType ?? e.expenseType }
                : null;
              const descriptionDisplay = getTemplateDescriptionDisplay(
                { description: e.description, expenseType: e.expenseType },
                t
              );
              return (
                <div key={e.id} className="rowLine rowLineCompact">
                  <div className="rowLeft">
                    <div className="rowLineSingle">
                      <span className="rowDescCat">{descriptionDisplay}</span>
                      <span className="rowDescCatSep"> · </span>
                      <span className="rowDescCat">{categoryForDisplay ? getCategoryDisplayName(categoryForDisplay, t) : "—"}</span>
                      <span className="rowDateCompact muted">{e.date?.slice(0, 10)}</span>
                    </div>
                    <div className="bar">
                      <div className="barFill" style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                  <div className="rowRight">{usd0.format(e.amountUsd ?? 0)}</div>
                </div>
              );
            })}

            {topExpenses.length === 0 && (
              <div className="muted">
                <Trans i18nKey="dashboard.noExpensesThisMonth" components={{ 1: <Link to="/expenses" /> }} />
              </div>
            )}
          </div>
        </div>

        <div className="col">
          <div className="sectionHead">
            <div className="sectionTitle">{t("dashboard.thisYear")}</div>
            <div className="muted">{year} {t("dashboard.projection")}</div>
          </div>

          <div className="yearStack">
            <div className="card yearKpi">
              <div className="kpiLabel">{t("dashboard.totalIncome")}</div>
              <div className="kpiValueSm">{usd0.format(annualTotals.income)}</div>
            </div>

            <div className="card yearKpi">
              <div className="kpiLabel">{t("dashboard.totalExpenses")}</div>
              <div className="kpiValueSm">{usd0.format(annualTotals.expenses)}</div>
            </div>

            <div className="card yearKpi">
              <div className="kpiLabel">{t("dashboard.investmentEarnings")}</div>
              <div className="kpiValueSm">{usd0.format(annualTotals.earnings)}</div>
            </div>

            <div className="card yearKpi yearHighlight">
              <div className="kpiLabel">{t("dashboard.annualSavings")}</div>
              <div className="kpiValue">{usd0.format(annualTotals.balance)}</div>
              <div className="kpiFoot muted">{t("dashboard.sumMonthlyBalances")}</div>
            </div>

            <div className="card yearKpi">
              <div className="kpiLabel">{t("dashboard.netWorthEndYear")}</div>
              <div className="kpiValueSm">{usd0.format(annualTotals.netWorthEndYear)}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dash{
          display:block;
        }

        .dashTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }

        .dashTopLeft{
          display:flex;
          align-items:center;
          gap:10px;
        }

        .dashActions{
          display:flex;
          gap:10px;
          align-items:center;
          margin-top:2px;
        }

        .hTitle{
          font-size:22px;
          font-weight:950;
          line-height:1.1;
          letter-spacing:-0.02em;
        }
        .hSub{
          margin-top:4px;
          font-size:13px;
          color: var(--muted);
          display:flex;
          gap:10px;
          align-items:center;
          flex-wrap:wrap;
        }

        .chip{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          color: rgba(15,23,42,0.75);
          font-size:12px;
          font-weight:700;
        }
        .chipLocked{
          border-color: rgba(15,23,42,0.16);
          background: rgba(15,23,42,0.05);
        }

        .onb{
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.02);
        }

        .kpiGrid{
          margin-top: 12px;
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px){
          .kpiGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 650px){
          .kpiGrid{ grid-template-columns: 1fr; }
        }

        .kpi{
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.10);
          background: #fff;
          box-shadow:
            0 1px 1px rgba(15,23,42,0.02),
            0 10px 26px rgba(15,23,42,0.05);
        }
        .kpiHighlight{
          background: #fff;
          border: 1px solid rgba(15,23,42,0.22);
          box-shadow:
            0 2px 4px rgba(15,23,42,0.06),
            0 14px 32px rgba(15,23,42,0.10);
        }
        .kpiLabel{
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 6px;
          font-weight: 700;
        }
        .kpiValue{
          font-size: 30px;
          font-weight: 950;
          letter-spacing: -0.02em;
          line-height: 1.05;
        }
        .kpiValueSm{
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.1;
        }
        .kpiFoot{
          margin-top: 8px;
          font-size: 12px;
        }

        .dashGrid{
          margin-top: 12px;
          display:grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 12px;
          align-items: stretch;
        }
        @media (max-width: 1100px){
          .dashGrid{
            grid-template-columns: 1fr;
          }
        }

        .col{
          display:grid;
          gap: 12px;
        }
        .dashGrid > .col:first-child{
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dashGrid > .col:first-child .sectionHead{
          flex-shrink: 0;
        }
        .dashGrid > .col:first-child .card.list{
          flex: 1;
          min-height: 200px;
          display: flex;
          flex-direction: column;
        }
        .dashGrid > .col:first-child .card.list.cardTopExpenses{
          flex: 0 1 auto;
          min-height: 0;
        }
        .dashGrid > .col:first-child .card.list .cardHead{
          flex-shrink: 0;
        }
        .dashGrid > .col:first-child .card.list > .muted{
          flex: 1;
        }

        .sectionHead{
          display:flex;
          justify-content:space-between;
          align-items:baseline;
          padding: 2px 2px 0 2px;
        }
        .sectionTitle{
          font-size: 15px;
          font-weight: 900;
        }

        .card.list{
          padding: 14px 14px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.10);
          background: #fff;
          box-shadow:
            0 1px 1px rgba(15,23,42,0.02),
            0 10px 26px rgba(15,23,42,0.05);
        }
        .cardCategoriesSplit.card.list{
          padding: 10px 12px;
        }

        .cardHead{
          display:flex;
          justify-content:space-between;
          align-items:baseline;
          margin-bottom: 8px;
        }
        .cardTitle{
          font-size: 14px;
          font-weight: 900;
        }

        .rowLine{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid rgba(15,23,42,0.06);
        }
        .rowLine:first-of-type{
          border-top: 0;
          padding-top: 6px;
        }

        .rowLeft{ min-width:0; flex: 1; }
        .rowRight{
          font-weight: 900;
          font-size: 13px;
          color: rgba(15,23,42,0.9);
          margin-top: 2px;
          white-space: nowrap;
        }

        .rowTitle{
          font-weight: 850;
          font-size: 13px;
          line-height: 1.2;
        }
        .rowTitleEllipsis{
          font-weight: 850;
          font-size: 13px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rowSub{
          margin-top: 4px;
          font-size: 12px;
          display:flex;
          gap: 8px;
          align-items:center;
          flex-wrap:wrap;
        }
        .rowLineCompact{
          padding: 5px 0;
        }
        .rowLineCompact .bar{
          margin-top: 4px;
        }
        .cardTopExpenses.card.list{
          padding: 8px 12px;
        }
        .cardTopExpenses .cardHeadCompact{
          margin-bottom: 4px;
        }
        .cardTopExpenses .rowLineCompact{
          padding: 3px 0;
        }
        .cardTopExpenses .rowLineCompact .bar{
          margin-top: 3px;
          height: 5px;
        }
        .rowLineSingle{
          display: flex;
          align-items: center;
          gap: 2px;
          flex-wrap: wrap;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
          min-width: 0;
        }
        .rowLineSingle .rowDescCat{
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rowLineSingle .rowDescCatSep{
          flex-shrink: 0;
          color: rgba(15,23,42,0.5);
        }
        .rowLineSingle .rowDateCompact{
          flex-shrink: 0;
          font-size: 11px;
          margin-left: 6px;
        }
        .badge{
          display:inline-flex;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          font-weight: 800;
          font-size: 12px;
          color: rgba(15,23,42,0.82);
        }

        .bar{
          margin-top: 8px;
          height: 6px;
          border-radius: 999px;
          background: rgba(15,23,42,0.06);
          overflow:hidden;
        }
        .barFill{
          height: 100%;
          border-radius: 999px;
          background: rgba(15,23,42,0.32);
        }

        .cardCategoriesSplit .categoriesSplitInner{
          display: flex;
          gap: 24px;
          margin-top: 2px;
          min-height: 0;
          overflow: visible;
        }
        .cardCategoriesSplit .categoriesSplitList{
          flex: 0 1 42%;
          min-width: 0;
        }
        .cardCategoriesSplit .categoriesSplitChart{
          flex: 1 1 58%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          overflow: hidden;
        }
        .cardCategoriesSplit .donutChartWrap{
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: auto;
          min-height: 0;
          padding: 2px 0;
          overflow: hidden;
        }
        .cardCategoriesSplit .donutChartSvg{
          width: 200px;
          height: auto;
          aspect-ratio: 1;
          overflow: hidden;
          flex: 0 0 200px;
        }
        .cardCategoriesSplit .donutLegend{
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          flex: 0.5 1 auto;
        }
        .cardCategoriesSplit .donutLegendItem{
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(15,23,42,0.9);
        }
        .cardCategoriesSplit .donutLegendDot{
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cardCategoriesSplit .donutLegendLabel{
          flex: 0 1 auto;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cardCategoriesSplit .donutLegendPct{
          font-weight: 700;
          flex-shrink: 0;
        }
        .cardCategoriesSplit .chartEmpty{
          font-size: 12px;
          text-align: center;
          padding: 16px;
        }
        @media (max-width: 700px){
          .cardCategoriesSplit .categoriesSplitInner{
            flex-direction: column;
          }
          .cardCategoriesSplit .donutChartWrap{
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
          }
        }

        .yearStack{
          display:grid;
          gap: 10px;
        }
        .yearKpi{
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.10);
          background: #fff;
          box-shadow:
            0 1px 1px rgba(15,23,42,0.02),
            0 10px 26px rgba(15,23,42,0.05);
        }
        .yearHighlight{
          background: #fff;
          border: 1px solid rgba(15,23,42,0.22);
          box-shadow:
            0 2px 4px rgba(15,23,42,0.06),
            0 14px 32px rgba(15,23,42,0.10);
        }
      `}</style>
    </div>
  );
}