// @ts-nocheck — TEMP: heavy JSX disabled for render diagnostic; restores after test
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useEncryption, decryptCounter } from "../context/EncryptionContext";
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
    otherExpensesEncryptedPayload?: string;
    lockedEncryptedPayload?: string;

    expensesUsd: number;
    investmentEarningsUsd: number;
    balanceUsd: number;
    netWorthUsd: number;
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
  const [decryptedIncomeByMonth, setDecryptedIncomeByMonth] = useState<Record<number, number>>({});
  const [decryptedOtherByMonth, setDecryptedOtherByMonth] = useState<Record<number, number>>({});
  const [clientExpensesUsdByMonth, setClientExpensesUsdByMonth] = useState<Record<number, number>>({});
  const [plannedBaseByMonth, setPlannedBaseByMonth] = useState<Record<number, number>>({});
  const [investmentEarningsByMonth, setInvestmentEarningsByMonth] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { decryptPayload, encryptPayload, hasEncryptionSupport } = useEncryption();
  const usdUyuRate = serverFxRate ?? getFxDefault();

  type BudgetRow = {
    id: string;
    year: number;
    month: number;
    categoryId: string;
    currencyId: string;
    amount: number;
    encryptedPayload?: string | null;
    category?: { id: string; name: string };
    currency?: { id: string; name: string };
    _decryptFailed?: boolean;
  };
  const [budgetsByMonth, setBudgetsByMonth] = useState<Record<number, BudgetRow[]>>({});

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
    console.log("LOAD CALLED", { year, currentMonth });
    setLoading(true);
    setError("");
    try {
      console.time("budgets-load-total");
      type InvLite = { id: string; type: string; currencyId?: string | null; targetAnnualReturn?: number | null; yieldStartYear?: number | null; yieldStartMonth?: number | null };
      type SnapRow = { month: number; closingCapital?: number | null; closingCapitalUsd?: number | null; encryptedPayload?: string | null; _decryptedZero?: boolean };
      type SnapshotsResp = { months?: SnapRow[]; data?: { months?: SnapRow[] } };
      const prevYear = year - 1;

      type PageDataPayload = {
        annual: AnnualResp;
        income: { year: number; rows: Array<{ month: number; totalUsd: number; encryptedPayload?: string }> };
        planned: { year: number; rows: Array<{ month: number; amountUsd?: number | null; encryptedPayload?: string | null }> };
        expensesByMonth: { byMonth: Array<{ amountUsd?: number; encryptedPayload?: string | null }[]> };
        investments: InvLite[];
        snapshotsYear: SnapRow[][];
        snapshotsPrevYear: SnapRow[][];
        movements: { year: number; rows: Array<{ month?: number; date?: string; investmentId: string; type: string; amount?: number; currencyId?: string; encryptedPayload?: string | null }> };
      };
      console.time("api-ensure-year");
      const ensureYearPromise = api(`/plannedExpenses/ensure-year`, {
        method: "POST",
        body: JSON.stringify({ year }),
      }).catch(() => null);
      console.timeEnd("api-ensure-year");

      console.time("api-page-data");
      const pageDataPromise = api<PageDataPayload>(`/budgets/page-data?year=${year}`);
      const payload = await pageDataPromise;
      console.timeEnd("api-page-data");
      const sizeInKb = JSON.stringify(payload).length / 1024;
      console.log("page-data payload size (KB):", sizeInKb.toFixed(2));

      await ensureYearPromise;

      const r = payload.annual;
      const incomeResp = payload.income;
      const plannedResp = payload.planned;
      const invs = payload.investments ?? [];
      const expenseResp = payload.expensesByMonth ?? { byMonth: Array.from({ length: 12 }, () => []) };
      const snapshotsYear = payload.snapshotsYear ?? [];
      const snapshotsPrevYear = payload.snapshotsPrevYear ?? [];
      const movResp = payload.movements ?? { rows: [] };
      const portfolios = (invs ?? []).filter((i: InvLite) => i.type === "PORTFOLIO");
      type ExpenseRow = { amountUsd?: number; encryptedPayload?: string | null };
      const expenseListsRaw = expenseResp?.byMonth ?? Array.from({ length: 12 }, () => []);
      const expenseLists = expenseListsRaw.length >= 12 ? expenseListsRaw : [...expenseListsRaw, ...Array.from({ length: Math.max(0, 12 - expenseListsRaw.length) }, () => [])];
      const expenseItems: { monthNum: number; e: ExpenseRow }[] = [];
      for (let i = 0; i < 12; i++) {
        for (const e of expenseLists[i] ?? []) {
          expenseItems.push({ monthNum: i + 1, e });
        }
      }

      async function decryptAndFill(resp: SnapshotsResp): Promise<SnapRow[]> {
        const raw = (resp?.months ?? resp?.data?.months ?? []).slice();
        const decrypted = await Promise.all(
          raw.map(async (s: SnapRow) => {
            if (s.encryptedPayload) {
              const pl = await decryptPayload<{ closingCapital?: number; closingCapitalUsd?: number }>(s.encryptedPayload);
              if (pl != null) {
                const cap = pl.closingCapital ?? null;
                const capUsd = typeof pl.closingCapitalUsd === "number" ? pl.closingCapitalUsd : (typeof pl.closingCapital === "number" ? pl.closingCapital : null);
                const isZero = (cap === 0 || cap === null) && (capUsd === 0 || capUsd === null);
                return { ...s, closingCapital: cap, closingCapitalUsd: capUsd, _decryptedZero: isZero };
              }
              return { ...s, closingCapital: null, closingCapitalUsd: null };
            }
            return s;
          })
        );
        decrypted.sort((a: SnapRow, b: SnapRow) => (Number(a.month) ?? 99) - (Number(b.month) ?? 99));
        const filled: SnapRow[] = [];
        for (let i = 0; i < 12; i++) {
          const monthNum = i + 1;
          const existing = decrypted.find((x: SnapRow) => Number(x.month) === monthNum);
          filled.push(existing ?? { month: monthNum, closingCapital: null, closingCapitalUsd: null });
        }
        return filled;
      }

      const incomeRows = incomeResp.rows ?? [];
      const plannedRows = plannedResp?.rows ?? [];
      const movementRows = movResp?.rows ?? [];

      console.time("budgets-decrypt-phase");
      const [
        incomeDecrypted,
        decryptedPlanned,
        resolvedMonths,
        expenseAmounts,
        filledYear,
        filledPrevYear,
        movementsDecrypted,
      ] = await Promise.all([
        Promise.all(
          incomeRows.map(async (row) => {
            if (row.encryptedPayload) {
              const pl = await decryptPayload<{ nominalUsd?: number; extraordinaryUsd?: number; taxesUsd?: number }>(row.encryptedPayload);
              return { month: row.month, total: pl ? (pl.nominalUsd ?? 0) + (pl.extraordinaryUsd ?? 0) - (pl.taxesUsd ?? 0) : 0 };
            }
            return { month: row.month, total: row.totalUsd ?? 0 };
          })
        ),
        Promise.all(
          plannedRows.map(async (row) => {
            let amountUsd = row.amountUsd ?? 0;
            if (row.encryptedPayload) {
              const pl = await decryptPayload<{ amountUsd?: number; defaultAmountUsd?: number }>(row.encryptedPayload);
              if (pl != null) {
                const v = pl.amountUsd ?? pl.defaultAmountUsd;
                if (typeof v === "number") amountUsd = v;
              }
            }
            return { month: row.month ?? 0, amountUsd };
          })
        ),
        Promise.all(
          (r.months ?? []).map(async (m) => {
            const lockedEnc = (m as { lockedEncryptedPayload?: string }).lockedEncryptedPayload;
            if (lockedEnc) {
              const pl = await decryptPayload<{
                incomeUsd?: number;
                expensesUsd?: number;
                investmentEarningsUsd?: number;
                balanceUsd?: number;
                netWorthStartUsd?: number;
              }>(lockedEnc);
              if (pl != null) {
                let baseExpensesUsd = pl.expensesUsd ?? 0;
                let otherExpensesUsd = 0;
                const otherEnc = (m as { otherExpensesEncryptedPayload?: string }).otherExpensesEncryptedPayload;
                if (otherEnc) {
                  const otherPl = await decryptPayload<{ otherExpensesUsd?: number }>(otherEnc);
                  if (otherPl != null && typeof otherPl.otherExpensesUsd === "number") {
                    otherExpensesUsd = otherPl.otherExpensesUsd;
                    baseExpensesUsd = Math.max(0, (pl.expensesUsd ?? 0) - otherExpensesUsd);
                  }
                }
                return { m, otherExpensesUsd, resolved: { ...m, incomeUsd: pl.incomeUsd ?? 0, expensesUsd: pl.expensesUsd ?? 0, investmentEarningsUsd: pl.investmentEarningsUsd ?? 0, balanceUsd: pl.balanceUsd ?? 0, netWorthUsd: pl.netWorthStartUsd ?? 0, baseExpensesUsd, otherExpensesUsd } };
              }
            }
            const enc = (m as { otherExpensesEncryptedPayload?: string }).otherExpensesEncryptedPayload;
            if (enc) {
              const pl = await decryptPayload<{ otherExpensesUsd?: number }>(enc);
              const otherExpensesUsd = pl != null && typeof pl.otherExpensesUsd === "number" ? pl.otherExpensesUsd : 0;
              return { m, otherExpensesUsd, resolved: m };
            }
            return { m, otherExpensesUsd: 0, resolved: m };
          })
        ),
        Promise.all(
          expenseItems.map(async ({ monthNum, e }) => {
            if (e.encryptedPayload) {
              const pl = await decryptPayload<{ amountUsd?: number }>(e.encryptedPayload);
              return { monthNum, amountUsd: pl != null && typeof pl.amountUsd === "number" ? pl.amountUsd : 0 };
            }
            return { monthNum, amountUsd: e.amountUsd ?? 0 };
          })
        ),
        Promise.all(portfolios.map((_, idx) => decryptAndFill({ months: snapshotsYear[idx] ?? [] }))),
        Promise.all(portfolios.map((_, idx) => decryptAndFill({ months: snapshotsPrevYear[idx] ?? [] }))),
        Promise.all(
          movementRows.map(async (mv) => {
            let amount = mv.amount ?? 0;
            if (mv.encryptedPayload) {
              const pl = await decryptPayload<{ amount?: number }>(mv.encryptedPayload);
              if (pl != null && typeof pl.amount === "number") amount = pl.amount;
            }
            const month = mv.month ?? (mv.date ? new Date(mv.date).getUTCMonth() + 1 : 0);
            return { ...mv, amount, month };
          })
        ),
      ]);
      console.timeEnd("budgets-decrypt-phase");

      console.time("financial-calculation-phase");
      const byMonth: Record<number, number> = {};
      for (const { month, total } of incomeDecrypted) byMonth[month] = total;
      setDecryptedIncomeByMonth(byMonth);

      const plannedByMonth: Record<number, number> = {};
      for (const { month: mo, amountUsd } of decryptedPlanned) {
        if (mo >= 1 && mo <= 12) plannedByMonth[mo] = (plannedByMonth[mo] ?? 0) + amountUsd;
      }
      setPlannedBaseByMonth(plannedByMonth);

      const otherByMonth: Record<number, number> = {};
      const resolvedMonthsMapped = resolvedMonths.map(({ m, otherExpensesUsd, resolved }) => {
        otherByMonth[m.month] = otherExpensesUsd;
        return resolved;
      });
      setDecryptedOtherByMonth(otherByMonth);
      setData({ ...r, months: resolvedMonthsMapped });
      setLoading(false);

      const expensesByMonth: Record<number, number> = {};
      for (const { monthNum, amountUsd } of expenseAmounts) {
        expensesByMonth[monthNum] = (expensesByMonth[monthNum] ?? 0) + amountUsd;
      }
      for (let i = 0; i < 12; i++) {
        if ((expenseLists[i] ?? []).length > 0) expensesByMonth[i + 1] = expensesByMonth[i + 1] ?? 0;
      }
      setClientExpensesUsdByMonth(expensesByMonth);
      const snapsByInvId: Record<string, SnapRow[]> = {};
      for (let idx = 0; idx < portfolios.length; idx++) snapsByInvId[portfolios[idx].id] = filledYear[idx] ?? [];
      function valueUsdSnapPrev(snap: SnapRow | undefined, currencyId: string): number | null {
        if (!snap) return null;
        const hasEnc = !!snap.encryptedPayload;
        const bothZero = (snap.closingCapitalUsd === 0 && snap.closingCapital === 0) || (snap.closingCapitalUsd == null && snap.closingCapital == null);
        if (hasEnc && bothZero && !snap._decryptedZero) return null;
        if (snap.closingCapitalUsd != null && typeof snap.closingCapitalUsd === "number") return snap.closingCapitalUsd;
        if (currencyId === "USD" && snap.closingCapital != null && typeof snap.closingCapital === "number") return snap.closingCapital;
        return null;
      }
      function capitalUsdPortfolioPrevYear(inv: InvLite, snaps: SnapRow[], m: number, y: number): number {
        const idx = m - 1;
        const s = snaps[idx];
        const direct = valueUsdSnapPrev(s, inv.currencyId ?? "USD");
        if (direct != null) return direct;
        const monthlyFactor = 1 + (inv.targetAnnualReturn ?? 0) / 12;
        const yieldStart = inv.yieldStartYear != null && inv.yieldStartYear > y ? 13 : inv.yieldStartYear === y ? (inv.yieldStartMonth ?? 1) : 1;
        for (let i = m - 2; i >= 0; i--) {
          const prevVal = valueUsdSnapPrev(snaps[i], inv.currencyId ?? "USD");
          if (prevVal != null) {
            const start = Math.max(yieldStart, i + 1);
            const diff = m - start;
            if (diff <= 0) return prevVal;
            return prevVal * Math.pow(monthlyFactor, diff);
          }
        }
        return 0;
      }
      let prevYearDecNW = 0;
      for (let idx = 0; idx < portfolios.length; idx++) {
        prevYearDecNW += capitalUsdPortfolioPrevYear(portfolios[idx], filledPrevYear[idx] ?? [], 12, prevYear);
      }
      function valueUsdSnap(snap: SnapRow | undefined, currencyId: string): number | null {
        if (!snap) return null;
        const hasEnc = !!snap.encryptedPayload;
        const bothZero = (snap.closingCapitalUsd === 0 && snap.closingCapital === 0) || (snap.closingCapitalUsd == null && snap.closingCapital == null);
        if (hasEnc && bothZero && !snap._decryptedZero) return null;
        if (snap.closingCapitalUsd != null && typeof snap.closingCapitalUsd === "number") return snap.closingCapitalUsd;
        if (currencyId === "USD" && snap.closingCapital != null && typeof snap.closingCapital === "number") return snap.closingCapital;
        return null;
      }
      function capitalUsdPortfolioInv(inv: InvLite, snaps: SnapRow[], m: number): number {
        const idx = m - 1;
        const s = snaps[idx];
        const direct = valueUsdSnap(s, inv.currencyId ?? "USD");
        if (direct != null) return direct;
        const monthlyFactor = 1 + (inv.targetAnnualReturn ?? 0) / 12;
        const yieldStart = inv.yieldStartYear != null && inv.yieldStartYear > year ? 13 : inv.yieldStartYear === year ? (inv.yieldStartMonth ?? 1) : 1;
        for (let i = m - 2; i >= 0; i--) {
          const prevVal = valueUsdSnap(snaps[i], inv.currencyId ?? "USD");
          if (prevVal != null) {
            const start = Math.max(yieldStart, i + 1);
            const diff = m - start;
            if (diff <= 0) return prevVal;
            return prevVal * Math.pow(monthlyFactor, diff);
          }
        }
        return 0;
      }
      const portfolioNW = months12.map((m) => portfolios.reduce((acc, inv) => acc + capitalUsdPortfolioInv(inv, snapsByInvId[inv.id] ?? [], m), 0));
      const projectedNextJan = portfolios.reduce((acc, inv) => {
        const snaps = snapsByInvId[inv.id] ?? [];
        const decCap = capitalUsdPortfolioInv(inv, snaps, 12);
        return acc + decCap * (1 + (inv.targetAnnualReturn ?? 0) / 12);
      }, 0);
      const flows = months12.map(() => 0);
      const invById = new Map(portfolios.map((i) => [i.id, i]));
      const fx = Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? usdUyuRate : null;
      for (const mv of movementsDecrypted) {
        const m = mv.month ?? 0;
        if (m < 1 || m > 12) continue;
        const inv = invById.get(mv.investmentId);
        if (!inv || inv.type !== "PORTFOLIO") continue;
        const sign = mv.type === "deposit" ? 1 : mv.type === "withdrawal" ? -1 : 0;
        const amount = mv.amount ?? 0;
        const cur = (mv.currencyId ?? "USD").toUpperCase();
        if (cur === "USD") flows[m - 1] += sign * amount;
        else if (cur === "UYU" && fx) flows[m - 1] += sign * (amount / fx);
      }
      // Misma fórmula que Patrimonio: solo año actual; variación mes i = (NW[i+1]-NW[i]) - flujos[i]; dic = projectedNextJan - NW[11]
      const variation = months12.map((_, i) =>
        i < 11 ? (portfolioNW[i + 1] ?? 0) - (portfolioNW[i] ?? 0) : projectedNextJan - (portfolioNW[11] ?? 0)
      );
      const earningsByMonth: Record<number, number> = {};
      for (let i = 0; i < 12; i++) {
        earningsByMonth[i + 1] = (variation[i] ?? 0) - (flows[i] ?? 0);
      }
      console.timeEnd("financial-calculation-phase");
      setInvestmentEarningsByMonth(earningsByMonth);
      setDrafts({});

      console.time("api-budgets-list");
      const budgetList = await api<BudgetRow[]>(
        `/budgets?year=${year}&month=${currentMonth}`
      ).catch(() => []);
      console.timeEnd("api-budgets-list");
      const decryptedBudgets = await Promise.all(
        (budgetList ?? []).map(async (b) => {
          if (b.encryptedPayload) {
            const pl = await decryptPayload<{ amount?: number }>(b.encryptedPayload);
            if (pl != null && typeof pl.amount === "number") return { ...b, amount: pl.amount };
            return { ...b, amount: 0, _decryptFailed: true };
          }
          return b;
        })
      );
      setBudgetsByMonth((prev) => ({ ...prev, [currentMonth]: decryptedBudgets }));
      console.log("Final decrypt count for this load:", decryptCounter);
      console.timeEnd("budgets-load-total");
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function saveBudgetAmount(b: BudgetRow, newAmount: number) {
    const enc = await encryptPayload({ amount: newAmount });
    await api("/budgets", {
      method: "PUT",
      body: JSON.stringify({
        year: b.year,
        month: b.month,
        categoryId: b.categoryId,
        currencyId: b.currencyId,
        amount: enc ? 0 : newAmount,
        ...(enc ? { encryptedPayload: enc } : {}),
      }),
    });
    setBudgetsByMonth((prev) => ({
      ...prev,
      [b.month]: (prev[b.month] ?? []).map((x) => (x.id === b.id ? { ...x, amount: newAmount } : x)),
    }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, currentMonth]);

  const months = useMemo(() => {
    const raw = data?.months ?? [];
    const byMonth = new Map(raw.map((m) => [m.month, m]));
    return months12.map((m) => {
      const x = byMonth.get(m);
      const base = x ?? {
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
      };
      const incomeUsd = decryptedIncomeByMonth[m] ?? base.incomeUsd ?? 0;
      const clientBase = clientExpensesUsdByMonth[m];
      const serverBase = base.baseExpensesUsd ?? 0;
      const plannedBase = plannedBaseByMonth[m] ?? 0;
      // Mes cerrado: usar snapshot. Mes abierto: gastos reales si hay; si no, proyección desde borradores (plannedBase) para que E2EE muestre la suma descifrada en el cliente, no serverBase que puede ser parcial/0
      const baseExpensesUsd = base.isClosed
        ? serverBase
        : (clientBase ?? (plannedBase > 0 ? plannedBase : serverBase));
      const otherExpensesUsd = decryptedOtherByMonth[m] ?? base.otherExpensesUsd ?? 0;
      const expensesUsd = base.isClosed ? (base.expensesUsd ?? 0) : baseExpensesUsd + otherExpensesUsd;
      const investmentEarningsUsd = base.isClosed
        ? (base.investmentEarningsUsd ?? 0)
        : (investmentEarningsByMonth[m] ?? base.investmentEarningsUsd ?? 0);
      const balanceUsd = base.isClosed ? (base.balanceUsd ?? 0) : incomeUsd - expensesUsd + investmentEarningsUsd;
      return {
        ...base,
        incomeUsd,
        baseExpensesUsd,
        otherExpensesUsd,
        expensesUsd,
        investmentEarningsUsd,
        balanceUsd,
      };
    });
  }, [data, decryptedIncomeByMonth, decryptedOtherByMonth, clientExpensesUsdByMonth, plannedBaseByMonth, investmentEarningsByMonth]);

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
    const valueUsd =
      otherExpensesCurrency === "UYU" && Number.isFinite(otherExpensesRate) && otherExpensesRate > 0
        ? value / otherExpensesRate
        : value;
    let payload: Record<string, unknown>;
    if (hasEncryptionSupport) {
      const enc = await encryptPayload({ otherExpensesUsd: valueUsd });
      if (enc) payload = { encryptedPayload: enc };
      else payload = otherExpensesCurrency === "UYU" ? { amount: value, currencyId: "UYU", usdUyuRate: otherExpensesRate } : { otherExpensesUsd: valueUsd };
    } else {
      payload =
        otherExpensesCurrency === "UYU"
          ? { amount: value, currencyId: "UYU" as const, usdUyuRate: otherExpensesRate }
          : { otherExpensesUsd: valueUsd };
    }
    await api(`/budgets/other-expenses/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setDecryptedOtherByMonth((prev) => ({ ...prev, [month]: valueUsd }));
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
    <div style={{ padding: 40 }}>
      <h1>Budgets Render Test</h1>
      <p>If this loads fast, the issue is React rendering, not data loading.</p>
    </div>
  );
}