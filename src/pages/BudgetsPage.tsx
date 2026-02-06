import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";

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

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const m2 = (m: number) => String(m).padStart(2, "0");
const months12 = Array.from({ length: 12 }, (_, i) => i + 1);

type DraftMap = Record<number, { other?: string }>;

function sanitizeNumber(raw: string) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(15,23,42,0.06)",
        color: "rgba(15,23,42,0.75)",
        fontWeight: 750,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </span>
  );
}

export default function BudgetsPage() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me } = useAppShell();
  const { year } = useAppYearMonth();

  const tableRef = useRef<HTMLDivElement>(null);
  const onboardingActive = meLoaded && !!me && onboardingStep === "budget";

  function goTable() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function skipOnboarding() {
    setOnboardingStep("done");
    nav("/", { replace: false });
  }
  function markStepDone() {
    setOnboardingStep("dashboard");
    nav("/", { replace: false });
  }

  useEffect(() => {
    setHeader({ title: t("budgets.title"), subtitle: t("budgets.subtitle", { year }) });
  }, [setHeader, year, t]);

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
    await api(`/budgets/other-expenses/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify({ otherExpensesUsd: value }),
    });
    await load();
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 850, fontSize: 16 }}>{t("budgets.annualBudget")}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t("budgets.closedMonthsLocked")}
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
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
                    {usd0.format(m.incomeUsd)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {usd0.format(totals.income)}
                </td>
              </tr>

              {/* Base expenses (actuals if any, else drafts planned) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.baseExpenses")}</td>
                {months.map((m) => (
                  <td key={`base-${m.month}`} className="right" title={t("budgets.actualsOrDrafts")}>
                    {usd0.format(m.baseExpensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {usd0.format(totals.base)}
                </td>
              </tr>

              {/* Other expenses (manual editable) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.otherExpenses")}</td>
                {months.map((m) => (
                  <td key={`other-${m.month}`} className="right" title={m.source}>
                    {m.isClosed ? (
                      usd0.format(m.otherExpensesUsd ?? 0)
                    ) : (
                      <input
                        className="input compact"
                        value={drafts[m.month]?.other ?? String(Math.round(m.otherExpensesUsd ?? 0))}
                        style={{ width: 70, textAlign: "right" }}
                        onChange={(e) => setDraft(m.month, { other: e.target.value })}
                        onBlur={async () => {
                          const raw = (drafts[m.month]?.other ?? "").trim();
                          if (raw === "") return; // allow leaving it empty without saving

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
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {usd0.format(totals.other)}
                </td>
              </tr>

              {/* Total expenses */}
              <tr>
                <td style={{ fontWeight: 800 }}>{t("budgets.expensesCol")}</td>
                {months.map((m) => (
                  <td key={`exp-${m.month}`} className="right" title={t("budgets.basePlusOther")} style={{ fontWeight: 800 }}>
                    {usd0.format(m.expensesUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 900 }}>
                  {usd0.format(totals.expenses)}
                </td>
              </tr>

              {/* Investment earnings */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.investmentEarnings")}</td>
                {months.map((m) => (
                  <td key={`earn-${m.month}`} className="right" style={{ opacity: m.isClosed ? 1 : 0.85 }} title={t("budgets.realReturnsPortfolio")}>
                    {usd0.format(m.investmentEarningsUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 850 }}>
                  {usd0.format(totals.earnings)}
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
                    {usd0.format(m.balanceUsd ?? 0)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 950 }}>
                  {usd0.format(totals.balance)}
                </td>
              </tr>

              {/* Net worth (start) */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("budgets.netWorthStart")}</td>
                {months.map((m, idx) => (
                  <td key={`nw-${m.month}`} className="right" title={t("budgets.startOfMonth")}>
                    {usd0.format(netWorthStartSeries[idx] ?? 0)}
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
          .input.compact { padding: 6px 8px; border-radius: 10px; }
        `}</style>
      </div>
    </div>
  );
}