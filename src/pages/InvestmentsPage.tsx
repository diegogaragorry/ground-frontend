import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";
import { getFxDefault } from "../utils/fx";

type Investment = {
  id: string;
  name: string;
  type: "PORTFOLIO" | "ACCOUNT" | string;
  currencyId: "USD" | "UYU" | string;
  targetAnnualReturn: number; // 0.08
  yieldStartYear?: number | null;
  yieldStartMonth?: number | null;
};

type SnapshotMonth = {
  id: string | null;
  investmentId?: string;
  year?: number;
  month: number;
  closingCapital: number | null;
  closingCapitalUsd: number | null;
  isClosed: boolean;
};

type MovementApiRow = {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "yield" | string;
  investmentId: string;
  currencyId: string;
  amount: number;
  investment?: { id: string; name: string; type: string } | null;
  currency?: { id: string; name: string } | null;
};

type MovementRow = {
  id: string;
  date: string;
  month: number;
  investmentId: string;
  investmentName?: string;
  investmentType?: string;
  type: "deposit" | "withdrawal" | "yield" | string;
  currencyId: string;
  amount: number;
  note?: string | null;
};

type MonthCloseRow = { year: number; month: number };
type MonthClosesResp = { year: number; rows: MonthCloseRow[] };

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const monthLabel = (m: number) => String(m).padStart(2, "0");

function toMonthFromIso(iso: string) {
  const d = new Date(iso);
  return d.getUTCMonth() + 1;
}

function firstDayUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

function normalizeMovement(x: MovementApiRow): MovementRow {
  return {
    id: x.id,
    date: x.date,
    month: toMonthFromIso(x.date),
    investmentId: x.investmentId,
    investmentName: x.investment?.name ?? undefined,
    investmentType: x.investment?.type ?? undefined,
    type: x.type,
    currencyId: x.currencyId,
    amount: x.amount ?? 0,
  };
}

/** targetAnnualReturn helpers */
function displayReturnPct(inv: Investment) {
  const v = Number(inv.targetAnnualReturn ?? 0);
  if (!Number.isFinite(v)) return "0";
  const pct = v * 100;
  const rounded = Math.round(pct * 100) / 100;
  return String(rounded);
}

function parseReturnInputToDecimal(raw: string) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "").replace(/,/g, ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 1) return n / 100; // 8 => 0.08
  return n; // 0.08 => 0.08
}

export default function InvestmentsPage() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, showSuccess, serverFxRate } = useAppShell();
  const { year } = useAppYearMonth();
  const usdUyuRate = serverFxRate ?? getFxDefault();

  // scroll targets for onboarding
  const addFundRef = useRef<HTMLDivElement>(null);
  const accountsRef = useRef<HTMLDivElement>(null);

  const onboardingActive = meLoaded && !!me && onboardingStep === "investments";

  function goAddFund() {
    addFundRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goAccounts() {
    accountsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function skipOnboarding() {
    setOnboardingStep("done");
    nav("/", { replace: false });
  }
  function markStepDone() {
    setOnboardingStep("budget");
    nav("/budgets", { replace: false });
  }

  useEffect(() => {
    setHeader({ title: t("investments.title"), subtitle: t("investments.subtitle", { year }) });
  }, [setHeader, year, t]);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotMonth[]>>({});
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // closed months (only for snapshots/movements edits)
  const [closedMonths, setClosedMonths] = useState<Set<number>>(new Set());
  const isClosed = (m: number) => closedMonths.has(m);

  async function loadMonthCloses() {
    const r = await api<MonthClosesResp>(`/monthCloses?year=${year}`);
    const set = new Set<number>();
    for (const row of r.rows ?? []) {
      set.add(row.month);
    }
    setClosedMonths(set);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const invs = await api<Investment[]>("/investments");
      setInvestments(invs);

      const snaps: Record<string, SnapshotMonth[]> = {};
      for (const inv of invs) {
        const r = await api<{ months: SnapshotMonth[] }>(`/investments/${inv.id}/snapshots?year=${year}`);
        snaps[inv.id] = r.months;
      }
      setSnapshots(snaps);

      const mov = await api<{ year: number; rows: MovementApiRow[] }>(`/investments/movements?year=${year}`);
      setMovements((mov.rows ?? []).map(normalizeMovement));

      await loadMonthCloses();
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorLoadingInvestments"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  function snapsByMonth(snaps: SnapshotMonth[]) {
    const map: Record<number, SnapshotMonth | undefined> = {};
    for (const s of snaps) map[s.month] = s;
    return map;
  }

  function monthlyFactor(inv: Investment) {
    return 1 + (inv.targetAnnualReturn ?? 0) / 12;
  }

  function yieldStartMonthForYear(inv: Investment) {
    if (inv.yieldStartYear != null && inv.yieldStartYear > year) return 13;
    if (inv.yieldStartYear != null && inv.yieldStartYear === year) return inv.yieldStartMonth ?? 1;
    return 1;
  }

  function capitalUsdPortfolio(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const byM = snapsByMonth(snaps);
    const s = byM[m];
    if (s?.closingCapitalUsd != null) return s.closingCapitalUsd;

    let baseMonth: number | null = null;
    let baseValue: number | null = null;
    for (let i = m - 1; i >= 1; i--) {
      const prev = byM[i];
      if (prev?.closingCapitalUsd != null) {
        baseMonth = i;
        baseValue = prev.closingCapitalUsd;
        break;
      }
    }
    if (baseMonth == null || baseValue == null) return 0;

    const start = Math.max(yieldStartMonthForYear(inv), baseMonth);
    const diff = m - start;
    if (diff <= 0) return baseValue;

    return baseValue * Math.pow(monthlyFactor(inv), diff);
  }

  function capitalUsdAccountCarry(_inv: Investment, snaps: SnapshotMonth[], m: number) {
    const byM = snapsByMonth(snaps);
    const s = byM[m];
    if (s?.closingCapitalUsd != null) return s.closingCapitalUsd;

    for (let i = m - 1; i >= 1; i--) {
      const prev = byM[i];
      if (prev?.closingCapitalUsd != null) return prev.closingCapitalUsd;
    }
    return 0;
  }

  function capitalOrigPortfolio(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const byM = snapsByMonth(snaps);
    const s = byM[m];
    if (s?.closingCapital != null) return s.closingCapital;

    let baseMonth: number | null = null;
    let baseValue: number | null = null;
    for (let i = m - 1; i >= 1; i--) {
      const prev = byM[i];
      if (prev?.closingCapital != null) {
        baseMonth = i;
        baseValue = prev.closingCapital;
        break;
      }
    }
    if (baseMonth == null || baseValue == null) return null;

    const start = Math.max(yieldStartMonthForYear(inv), baseMonth);
    const diff = m - start;
    if (diff <= 0) return baseValue;

    return baseValue * Math.pow(monthlyFactor(inv), diff);
  }

  function capitalOrigAccountCarry(_inv: Investment, snaps: SnapshotMonth[], m: number) {
    const byM = snapsByMonth(snaps);
    const s = byM[m];
    if (s?.closingCapital != null) return s.closingCapital;

    for (let i = m - 1; i >= 1; i--) {
      const prev = byM[i];
      if (prev?.closingCapital != null) return prev.closingCapital;
    }
    return null;
  }

  async function saveCell(inv: Investment, m: number, value: number | null) {
    if (value === null || Number.isNaN(value)) return;
    if (isClosed(m)) {
      setError(t("investments.monthClosedEditSnapshots"));
      return;
    }
    setError("");
    const body: { closingCapital: number; usdUyuRate?: number } = { closingCapital: value };
    if (inv.currencyId === "UYU" && Number.isFinite(usdUyuRate) && usdUyuRate > 0) {
      body.usdUyuRate = usdUyuRate;
    }
    try {
      const snap = await api<SnapshotMonth>(`/investments/${inv.id}/snapshots/${year}/${m}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      setSnapshots((prev) => ({
        ...prev,
        [inv.id]: (prev[inv.id] ?? []).map((x) => (x.month === m ? snap : x)),
      }));
      showSuccess("Snapshot saved.");
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorSavingSnapshot"));
    }
  }

  async function saveTargetReturn(inv: Investment, raw: string) {
    const parsed = parseReturnInputToDecimal(raw);
    if (parsed == null) return;
    setError("");
    try {
      const updated = await api<Investment>(`/investments/${inv.id}`, {
        method: "PUT",
        body: JSON.stringify({ targetAnnualReturn: parsed }),
      });

      setInvestments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showSuccess("Target return saved.");
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorSavingTargetReturn"));
    }
  }

  async function saveCurrency(inv: Investment, currencyId: string) {
    const id = (currencyId ?? "").trim().toUpperCase();
    if (id !== "USD" && id !== "UYU") return;
    if (inv.currencyId === id) return;
    setError("");
    try {
      const updated = await api<Investment>(`/investments/${inv.id}`, {
        method: "PUT",
        body: JSON.stringify({ currencyId: id }),
      });
      setInvestments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      const r = await api<{ months: SnapshotMonth[] }>(`/investments/${inv.id}/snapshots?year=${year}`);
      setSnapshots((prev) => ({ ...prev, [inv.id]: r.months }));
      showSuccess(t("common.saved"));
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorSavingTargetReturn"));
    }
  }

  // Groups
  const portfolios = useMemo(() => investments.filter((i) => i.type === "PORTFOLIO"), [investments]);
  const accounts = useMemo(() => investments.filter((i) => i.type === "ACCOUNT"), [investments]);

  // NET WORTH
  const portfolioNetWorthByMonthUsd = useMemo(
    () => months.map((m) => portfolios.reduce((acc, inv) => acc + capitalUsdPortfolio(inv, snapshots[inv.id] ?? [], m), 0)),
    [portfolios, snapshots]
  );

  const accountsNetWorthByMonthUsd = useMemo(
    () => months.map((m) => accounts.reduce((acc, inv) => acc + capitalUsdAccountCarry(inv, snapshots[inv.id] ?? [], m), 0)),
    [accounts, snapshots]
  );

  const totalNetWorthByMonthUsd = useMemo(
    () => months.map((_, i) => (portfolioNetWorthByMonthUsd[i] ?? 0) + (accountsNetWorthByMonthUsd[i] ?? 0)),
    [portfolioNetWorthByMonthUsd, accountsNetWorthByMonthUsd]
  );

  // MONTHLY VARIATION
  const portfolioMonthlyVariation = useMemo(() => {
    const nw = portfolioNetWorthByMonthUsd;

    const projectedNextJan = portfolios.reduce((acc, inv) => {
      const decCap = capitalUsdPortfolio(inv, snapshots[inv.id] ?? [], 12);
      return acc + decCap * monthlyFactor(inv);
    }, 0);

    return months.map((m, i) => {
      if (m < 12) return (nw[i + 1] ?? 0) - (nw[i] ?? 0);
      return projectedNextJan - (nw[11] ?? 0);
    });
  }, [portfolioNetWorthByMonthUsd, portfolios, snapshots]);

  // MOVEMENTS FLOWS (PORTFOLIO, USD ONLY)
  const flows = useMemo(() => {
    const series = months.map(() => 0);
    const invById = new Map(investments.map((i) => [i.id, i]));

    for (const mv of movements) {
      const m = mv.month ?? toMonthFromIso(mv.date);
      if (m < 1 || m > 12) continue;

      const inv = invById.get(mv.investmentId);
      if (!inv || inv.type !== "PORTFOLIO") continue;

      if ((mv.currencyId ?? "") !== "USD") continue;

      const sign = mv.type === "deposit" ? 1 : mv.type === "withdrawal" ? -1 : 0;
      series[m - 1] += sign * (mv.amount ?? 0);
    }

    return { series };
  }, [movements, investments]);

  const portfolioRealReturns = useMemo(
    () => months.map((_, i) => (portfolioMonthlyVariation[i] ?? 0) - (flows.series[i] ?? 0)),
    [portfolioMonthlyVariation, flows.series]
  );

  // MOVEMENTS CRUD
  async function createMovement(draft: { investmentId: string; type: "deposit" | "withdrawal" | "yield"; month: number; amount: number; currencyId: string }) {
    if (isClosed(draft.month)) {
      setError(t("investments.monthClosedAddMovement"));
      return;
    }
    setError("");
    const date = firstDayUtc(year, draft.month).toISOString();
    try {
      const created = await api<MovementApiRow>("/investments/movements", {
        method: "POST",
        body: JSON.stringify({
          investmentId: draft.investmentId,
          date,
          type: draft.type,
          currencyId: (draft.currencyId ?? "USD").trim().toUpperCase(),
          amount: Number(draft.amount) || 0,
        }),
      });

      setMovements((prev) => [normalizeMovement(created), ...prev]);
      showSuccess("Movement added.");
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorAddingMovement"));
    }
  }

  async function updateMovementFull(updated: MovementRow) {
    const m = updated.month ?? toMonthFromIso(updated.date);
    if (isClosed(m)) {
      setError(t("investments.monthClosedEditMovements"));
      return;
    }
    setError("");
    try {
      const res = await api<MovementApiRow>(`/investments/movements/${updated.id}`, {
        method: "PUT",
        body: JSON.stringify({
          investmentId: updated.investmentId,
          date: updated.date,
          type: updated.type,
          currencyId: updated.currencyId,
          amount: updated.amount,
        }),
      });

      const normalized = normalizeMovement(res);
      setMovements((prev) => prev.map((x) => (x.id === normalized.id ? normalized : x)));
      showSuccess("Movement updated.");
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorUpdatingMovement"));
    }
  }

  async function deleteMovement(id: string, monthOfMovement: number) {
    if (isClosed(monthOfMovement)) {
      setError(t("investments.monthClosedDeleteMovements"));
      return;
    }
    if (!confirm(t("investments.deleteMovementConfirm"))) return;
    setError("");
    await api(`/investments/movements/${id}`, { method: "DELETE" });
    setMovements((prev) => prev.filter((x) => x.id !== id));
    showSuccess("Movement deleted.");
  }

  // MOVEMENT FORM
  const [mvInvId, setMvInvId] = useState<string>("");
  const [mvType, setMvType] = useState<"deposit" | "withdrawal">("withdrawal");
  const [mvMonth, setMvMonth] = useState<number>(1);
  const [mvAmount, setMvAmount] = useState<number>(0);
  const [mvCurrency, setMvCurrency] = useState<"USD" | "UYU">("USD");

  useEffect(() => {
    if (!mvInvId && portfolios.length > 0) setMvInvId(portfolios[0].id);
  }, [mvInvId, portfolios]);

  const mvIsClosed = isClosed(mvMonth);

  // ✅ ADD FUND FORM
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"PORTFOLIO" | "ACCOUNT">("PORTFOLIO");
  const [newCurrency, setNewCurrency] = useState<"USD" | "UYU">("USD");
  const [newTargetPct, setNewTargetPct] = useState<string>("8");
  const [newYieldFrom, setNewYieldFrom] = useState<number>(1);

  async function createFund() {
    const name = newName.trim();
    if (!name) return;

    const tar = parseReturnInputToDecimal(newTargetPct) ?? 0;

    await api<Investment>("/investments", {
      method: "POST",
      body: JSON.stringify({
        name,
        type: newType,
        currencyId: newCurrency,
        targetAnnualReturn: newType === "PORTFOLIO" ? tar : 0,
        yieldStartYear: year,
        yieldStartMonth: newYieldFrom,
      }),
    });

    setNewName("");
    setNewTargetPct("8");
    setNewYieldFrom(1);

    await load();
  }

  // STYLES
  const tdStyle: React.CSSProperties = { padding: "4px 6px", fontSize: 11, whiteSpace: "nowrap" };
  const thStyle: React.CSSProperties = { padding: "4px 6px", fontSize: 10, letterSpacing: 0.2, whiteSpace: "nowrap" };
  const inputStyle: React.CSSProperties = { width: 62, textAlign: "right", padding: "4px 6px", fontSize: 11, height: 28 };

  const stickyHead: React.CSSProperties = { position: "sticky", left: 0, background: "var(--card)", zIndex: 2 };
  const stickyCell: React.CSSProperties = { position: "sticky", left: 0, background: "var(--card)", zIndex: 1 };

  return (
    <div className="grid investments-page">
      {/* ✅ Onboarding banner (Step 3) */}
      {onboardingActive && (
        <div className="card" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(15,23,42,0.02)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{t("investments.step3Title")}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 780 }}>
                <Trans i18nKey="investments.step3Desc" components={{ 1: <b />, 2: <b /> }} />
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {t("investments.step3Tip")}
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="button" onClick={goAddFund} style={{ height: 40 }}>
                {t("investments.goToAddFund")}
              </button>
              <button className="btn" type="button" onClick={goAccounts} style={{ height: 40 }}>
                {t("investments.goToAccounts")}
              </button>
              <button className="btn primary" type="button" onClick={markStepDone} style={{ height: 40 }}>
                {t("investments.doneNextBudget")}
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-inline">
          <span className="loading-spinner" aria-hidden />
          {t("common.loading")}
        </div>
      )}
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}

      {/* SUMMARY */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("investments.summaryUsd")}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t("investments.year")}: {year}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t("investments.summaryIntro")}</div>
          </div>
          <button className="btn" type="button" onClick={load}>{t("common.refresh")}</button>
        </div>

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 10 }} role="region" aria-label="Net worth and returns by month">
          <table className="table" aria-label="Summary by month (USD)">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 190 }}></th>
                {months.map((m) => (
                  <th key={`sum-h-${m}`} className="right" style={thStyle}>{monthLabel(m)}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{t("investments.totalNetWorth")}</td>
                {months.map((m, i) => (
                  <td key={`sum-nw-${m}`} className="right" style={tdStyle}>{usd0.format(totalNetWorthByMonthUsd[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{t("investments.realReturnsPortfolioLabel")}</td>
                {months.map((m, i) => (
                  <td key={`sum-rr-${m}`} className="right" style={tdStyle}>{usd0.format(portfolioRealReturns[i] ?? 0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {t("investments.monthlyVariationNote")}
        </div>
      </div>

      {/* ✅ ADD FUND */}
      <div className="card" ref={addFundRef}>
        <div style={{ fontWeight: 900 }}>{t("investments.addFund")}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {t("investments.addFundDesc")}
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
          <div style={{ minWidth: 240 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.name")}</div>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("investments.namePlaceholder")}
              style={{ height: 32, fontSize: 12, padding: "6px 10px", width: "100%" }}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.type")}</div>
            <select
              className="select"
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              style={{ height: 32, fontSize: 12, padding: "6px 10px" }}
            >
              <option value="PORTFOLIO">{t("investments.typePortfolio")}</option>
              <option value="ACCOUNT">{t("investments.typeAccount")}</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.currency")}</div>
            <select
              className="select"
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value as any)}
              style={{ height: 32, fontSize: 12, padding: "6px 10px" }}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.targetReturnPct")}</div>
            <input
              className="input"
              value={newTargetPct}
              onChange={(e) => setNewTargetPct(e.target.value)}
              style={{ height: 32, fontSize: 12, padding: "6px 10px", width: 140, textAlign: "right" }}
              title={t("investments.targetReturnTitle")}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.yieldFrom")}</div>
            <select
              className="select"
              value={newYieldFrom}
              onChange={(e) => setNewYieldFrom(Number(e.target.value))}
              style={{ height: 32, fontSize: 12, padding: "6px 10px" }}
              disabled={newType !== "PORTFOLIO"}
              title={newType !== "PORTFOLIO" ? t("investments.accountsDontUseYield") : undefined}
            >
              {months.map((m) => (
                <option key={`new-ys-${m}`} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <button
            className="btn primary"
            type="button"
            onClick={createFund}
            style={{ height: 32, padding: "6px 12px" }}
            disabled={!newName.trim()}
          >
            {t("investments.add")}
          </button>
        </div>
      </div>

      {/* PORTFOLIO */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("investments.portfolios")}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t("investments.portfolioTableDesc")}</div>
          </div>
        </div>

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ ...thStyle, ...stickyHead, textAlign: "center" }}>{t("investments.fund")}</th>
                <th style={{ ...thStyle, textAlign: "center" }}>{t("investments.cur")}</th>
                <th style={{ ...thStyle, textAlign: "center" }} title={t("investments.annualReturnTitle")}>{t("investments.targetReturn")}</th>
                <th style={{ ...thStyle, textAlign: "center" }}>{t("investments.yieldFrom")}</th>
                {months.map((m) => (
                  <th key={`p-h-${m}`} style={{ ...thStyle, textAlign: "center" }} title={t("investments.valueAtStartOfMonth")}>{monthLabel(m)}</th>
                ))}
              </tr>
              <tr>
                <th colSpan={4 + months.length} className="muted" style={{ ...thStyle, fontSize: 10, borderTop: "none", paddingTop: 0, fontWeight: 500, textAlign: "center" }}>
                  {t("investments.valueAtStartOfMonth")}
                </th>
              </tr>
            </thead>

            <tbody>
              {portfolios.map((inv) => {
                const snaps = snapshots[inv.id] ?? [];
                const byM = snapsByMonth(snaps);

                return (
                  <tr key={inv.id}>
                    <td style={{ ...tdStyle, ...stickyCell, fontWeight: 700, textAlign: "center", verticalAlign: "middle" }}>{inv.name}</td>
                    <td style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
                      <select
                        className="select"
                        style={{ height: 28, fontSize: 11, padding: "4px 6px", margin: 0, minWidth: 56 }}
                        value={inv.currencyId ?? "USD"}
                        onChange={(e) => saveCurrency(inv, e.target.value)}
                      >
                        <option value="USD">USD</option>
                        <option value="UYU">UYU</option>
                      </select>
                    </td>

                    <td style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                        <input
                          className="input"
                          style={{ width: 52, height: 28, fontSize: 11, padding: "4px 6px", textAlign: "right" }}
                          title={t("investments.usePercentOrDecimal")}
                          defaultValue={displayReturnPct(inv)}
                          onBlur={(e) => {
                            const raw = (e.target as HTMLInputElement).value;
                            if (!raw.trim()) return;
                            saveTargetReturn(inv, raw);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>%</span>
                      </span>
                    </td>

                    <td style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
                      <select
                        className="select"
                        style={{ height: 28, fontSize: 11, padding: "4px 6px", margin: 0 }}
                        value={inv.yieldStartMonth ?? 1}
                        onChange={(e) =>
                          api(`/investments/${inv.id}`, {
                            method: "PUT",
                            body: JSON.stringify({ yieldStartMonth: Number(e.target.value) }),
                          }).then(load)
                        }
                      >
                        {months.map((m) => (
                          <option key={`ys-${inv.id}-${m}`} value={m}>{monthLabel(m)}</option>
                        ))}
                      </select>
                    </td>

                    {months.map((m) => {
                      const s = byM[m];
                      const hasReal = s?.closingCapital != null;
                      const display = capitalOrigPortfolio(inv, snaps, m);
                      const prevMonthClosed = m >= 2 && isClosed(m - 1);
                      const locked = isClosed(m) || prevMonthClosed;

                      return (
                        <td key={`p-${inv.id}-${m}`} style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            className="input"
                            style={{ ...inputStyle, opacity: locked ? 0.6 : hasReal ? 1 : 0.75 }}
                            disabled={locked}
                            title={locked ? t("investments.closedMonth") : undefined}
                            defaultValue={display == null ? "" : String(Math.round(display))}
                            onBlur={(e) => {
                              if (locked) return;
                              const raw = (e.target as HTMLInputElement).value.trim();
                              if (!raw) return;
                              saveCell(inv, m, Number(raw));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {portfolios.length === 0 && !loading && (
                <tr>
                  <td colSpan={4 + months.length} className="muted" style={{ ...tdStyle, textAlign: "center" }}>
                    {t("investments.noPortfolioYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 190 }}></th>
                {months.map((m) => (
                  <th key={`ps-h-${m}`} style={{ ...thStyle, textAlign: "center" }}>{monthLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdStyle, fontWeight: 800, textAlign: "left" }}>{t("investments.netWorthPortfolio")}</td>
                {months.map((m, i) => (
                  <td key={`ps-nw-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{usd0.format(portfolioNetWorthByMonthUsd[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 800, textAlign: "left" }}>{t("investments.monthlyVariation")}</td>
                {months.map((m, i) => (
                  <td key={`ps-var-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{usd0.format(portfolioMonthlyVariation[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 800, textAlign: "left" }}>{t("investments.netFlowsMovements")}</td>
                {months.map((m, i) => (
                  <td key={`ps-flow-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{usd0.format(flows.series[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 900, textAlign: "left" }}>{t("investments.realReturns")}</td>
                {months.map((m, i) => (
                  <td key={`ps-rr-${m}`} style={{ ...tdStyle, fontWeight: 900, textAlign: "center" }}>
                    {usd0.format(portfolioRealReturns[i] ?? 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MOVEMENTS */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("investments.movementsPortfolio")}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t("investments.movementsPortfolioDesc")}</div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!mvInvId) return;
            await createMovement({ investmentId: mvInvId, month: mvMonth, type: mvType, amount: Number(mvAmount) || 0, currencyId: mvCurrency });
            setMvAmount(0);
          }}
          className="row"
          style={{ gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}
        >
          <div style={{ minWidth: 220 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.investment")}</div>
            <select
              className="select"
              value={mvInvId}
              disabled={mvIsClosed}
              onChange={(e) => setMvInvId(e.target.value)}
              style={{ height: 32, fontSize: 11, padding: "4px 6px" }}
              title={mvIsClosed ? t("investments.closedMonth") : undefined}
            >
              {portfolios.map((p) => (
                <option key={`mv-opt-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.month")}</div>
            <select
              className="select"
              value={mvMonth}
              onChange={(e) => setMvMonth(Number(e.target.value))}
              style={{ height: 32, fontSize: 11, padding: "4px 6px" }}
            >
              {months.map((m) => (
                <option key={`mv-m-${m}`} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.type")}</div>
            <select
              className="select"
              value={mvType}
              disabled={mvIsClosed}
              onChange={(e) => setMvType(e.target.value as any)}
              style={{ height: 32, fontSize: 11, padding: "4px 6px" }}
              title={mvIsClosed ? t("investments.closedMonth") : undefined}
            >
              <option value="withdrawal">{t("investments.withdrawalOut")}</option>
              <option value="deposit">{t("investments.depositIn")}</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.currency")}</div>
            <select
              className="select"
              value={mvCurrency}
              disabled={mvIsClosed}
              onChange={(e) => setMvCurrency(e.target.value as "USD" | "UYU")}
              style={{ height: 32, fontSize: 11, padding: "4px 6px", width: 64 }}
              title={mvIsClosed ? t("investments.closedMonth") : undefined}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("investments.amount")}</div>
            <input
              className="input"
              type="number"
              value={mvAmount}
              disabled={mvIsClosed}
              onChange={(e) => setMvAmount(Number(e.target.value))}
              style={{ width: 160, height: 32, fontSize: 11, padding: "4px 6px" }}
              title={mvIsClosed ? t("investments.closedMonth") : undefined}
            />
          </div>

          <button className="btn primary" type="submit" style={{ height: 32, padding: "6px 10px" }} disabled={mvIsClosed}>
            {t("investments.add")}
          </button>
        </form>

        {mvIsClosed && (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            {t("investments.monthClosedAddMovement")}
          </div>
        )}

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={thStyle}>{t("expenses.month")}</th>
                <th style={thStyle}>{t("investments.investment")}</th>
                <th style={thStyle}>{t("investments.type")}</th>
                <th style={thStyle}>{t("investments.currency")}</th>
                <th className="right" style={thStyle}>{t("investments.amount")}</th>
                <th style={{ ...thStyle, width: 110 }} className="right">{t("expenses.actions")}</th>
              </tr>
            </thead>

            <tbody>
              {movements
                .slice()
                .sort((a, b) => (b.month ?? toMonthFromIso(b.date)) - (a.month ?? toMonthFromIso(a.date)))
                .map((mv) => {
                  const m = mv.month ?? toMonthFromIso(mv.date);
                  const locked = isClosed(m);

                  return (
                    <tr key={mv.id} style={locked ? { opacity: 0.85 } : undefined}>
                      <td style={tdStyle}>{monthLabel(m)}</td>

                      <td style={tdStyle}>
                        <select
                          className="select"
                          style={{ height: 28, fontSize: 11, padding: "4px 6px" }}
                          value={mv.investmentId}
                          disabled={locked}
                          title={locked ? t("investments.closedMonth") : undefined}
                          onChange={(e) => updateMovementFull({ ...mv, investmentId: e.target.value })}
                        >
                          {portfolios.map((p) => (
                            <option key={`mv-p-${mv.id}-${p.id}`} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>

                      <td style={tdStyle}>
                        <select
                          className="select"
                          style={{ height: 28, fontSize: 11, padding: "4px 6px" }}
                          value={mv.type}
                          disabled={locked}
                          title={locked ? t("investments.closedMonth") : undefined}
                          onChange={(e) => updateMovementFull({ ...mv, type: e.target.value as any })}
                        >
                          <option value="withdrawal">{t("investments.withdrawalOut")}</option>
                          <option value="deposit">{t("investments.depositIn")}</option>
                          <option value="yield">yield</option>
                        </select>
                      </td>

                      <td style={tdStyle}>
                        <select
                          className="select"
                          style={{ height: 28, fontSize: 11, padding: "4px 6px", minWidth: 56 }}
                          value={mv.currencyId ?? "USD"}
                          disabled={locked}
                          title={locked ? t("investments.closedMonth") : undefined}
                          onChange={(e) => updateMovementFull({ ...mv, currencyId: e.target.value })}
                        >
                          <option value="USD">USD</option>
                          <option value="UYU">UYU</option>
                        </select>
                      </td>

                      <td className="right" style={tdStyle}>
                        <input
                          className="input"
                          style={{ width: 120, height: 28, fontSize: 11, padding: "4px 6px", textAlign: "right", opacity: locked ? 0.7 : 1 }}
                          disabled={locked}
                          title={locked ? t("investments.closedMonth") : undefined}
                          defaultValue={String(mv.amount ?? 0)}
                          onBlur={(e) => {
                            if (locked) return;
                            const v = Number((e.target as HTMLInputElement).value);
                            if (!Number.isFinite(v)) return;
                            updateMovementFull({ ...mv, amount: v, currencyId: mv.currencyId ?? "USD" });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>

                      <td className="right" style={tdStyle}>
                        <button
                          className="btn danger"
                          type="button"
                          disabled={locked}
                          title={locked ? t("investments.closedMonth") : undefined}
                          onClick={() => deleteMovement(mv.id, m)}
                          style={{ height: 28, padding: "6px 10px" }}
                        >
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={tdStyle}>
                  {t("investments.noMovementsYet")}
                </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {t("investments.notesMovements")}
        </div>
      </div>

      {/* ACCOUNTS */}
      <div className="card" ref={accountsRef}>
        <div style={{ fontWeight: 900 }}>{t("investments.accounts")}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t("investments.accountsDesc")}</div>

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ ...thStyle, ...stickyHead }}>{t("investments.account")}</th>
                <th style={thStyle}>{t("investments.cur")}</th>
                {months.map((m) => (
                  <th key={`a-h-${m}`} className="right" style={thStyle} title={t("investments.valueAtStartOfMonth")}>{monthLabel(m)}</th>
                ))}
              </tr>
              <tr>
                <th colSpan={2 + months.length} className="muted" style={{ ...thStyle, fontSize: 10, borderTop: "none", paddingTop: 0, fontWeight: 500, textAlign: "left" }}>
                  {t("investments.valueAtStartOfMonth")}
                </th>
              </tr>
            </thead>

            <tbody>
              {accounts.map((inv) => {
                const snaps = snapshots[inv.id] ?? [];
                const byM = snapsByMonth(snaps);

                return (
                  <tr key={inv.id}>
                    <td style={{ ...tdStyle, ...stickyCell, fontWeight: 700 }}>{inv.name}</td>
                    <td style={tdStyle}>
                      <select
                        className="select"
                        style={{ height: 28, fontSize: 11, padding: "4px 6px", margin: 0, minWidth: 56 }}
                        value={inv.currencyId ?? "USD"}
                        onChange={(e) => saveCurrency(inv, e.target.value)}
                      >
                        <option value="USD">USD</option>
                        <option value="UYU">UYU</option>
                      </select>
                    </td>

                    {months.map((m) => {
                      const s = byM[m];
                      const hasReal = s?.closingCapital != null;
                      const display = capitalOrigAccountCarry(inv, snaps, m);
                      const prevMonthClosed = m >= 2 && isClosed(m - 1);
                      const locked = isClosed(m) || prevMonthClosed;

                      return (
                        <td key={`a-${inv.id}-${m}`} className="right" style={tdStyle}>
                          <input
                            className="input"
                            style={{ ...inputStyle, opacity: locked ? 0.6 : hasReal ? 1 : 0.75 }}
                            disabled={locked}
                            title={locked ? t("investments.closedMonth") : undefined}
                            defaultValue={display == null ? "" : String(Math.round(display))}
                            onBlur={(e) => {
                              if (locked) return;
                              const raw = (e.target as HTMLInputElement).value.trim();
                              if (!raw) return;
                              saveCell(inv, m, Number(raw));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {accounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={2 + months.length} className="muted" style={tdStyle}>{t("investments.noAccountsYet")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .investments-page { max-width: 100%; overflow-x: hidden; }
        .investments-page .card { max-width: 100%; overflow: hidden; }
        .investments-page .table th, 
        .investments-page .table td { padding: 6px 6px; }
        .investments-page .table th { font-size: 10px; letter-spacing: 0.4px; }
        .investments-page .input,
        .investments-page .select { border-radius: var(--radius-md); }
        .investments-page .row { flex-wrap: wrap; min-width: 0; }
      `}</style>
    </div>
  );
}