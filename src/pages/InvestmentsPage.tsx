import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell, useAppYearMonth, useDisplayCurrency } from "../layout/AppShell";
import { downloadCsv } from "../utils/exportCsv";
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
  encryptedPayload?: string;
  /** true cuando se descifró y el valor es realmente 0 (no “aún sin descifrar”) */
  _decryptedZero?: boolean;
};

type MovementApiRow = {
  id: string;
  date: string;
  type: "deposit" | "withdrawal" | "yield" | string;
  investmentId: string;
  currencyId: string;
  amount: number;
  encryptedPayload?: string;
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
  _decryptFailed?: boolean;
};

type MonthCloseRow = { year: number; month: number };
type MonthClosesResp = { year: number; rows: MonthCloseRow[] };


const months = Array.from({ length: 12 }, (_, i) => i + 1);
const monthLabel = (m: number) => String(m).padStart(2, "0");

function toMonthFromIso(iso: string) {
  const d = new Date(iso);
  return d.getUTCMonth() + 1;
}

function firstDayUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
}

function normalizeMovement(x: MovementApiRow & { _decryptFailed?: boolean }): MovementRow {
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
    _decryptFailed: x._decryptFailed,
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
  const location = useLocation();
  const { t } = useTranslation();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, showSuccess, serverFxRate } = useAppShell();
  const { year, month: currentMonth } = useAppYearMonth();
  const { formatAmountUsd, currencyLabel } = useDisplayCurrency();
  const { decryptPayload, encryptPayload } = useEncryption();
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
    nav(APP_BASE, { replace: false });
  }
  function markStepDone() {
    setOnboardingStep("budget");
    nav(`${APP_BASE}/budgets`, { replace: false });
  }

  useEffect(() => {
    setHeader({ title: t("investments.title"), subtitle: t("investments.subtitle", { year }) });
  }, [setHeader, year, t]);

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotMonth[]>>({});
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [editNameDraft, setEditNameDraft] = useState("");

  // which snapshot cell is being edited (controlled inputs so projected values always show)
  const [editingCell, setEditingCell] = useState<{ invId: string; month: number; value: string } | null>(null);

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
        const r = await api<{ months?: SnapshotMonth[]; data?: { months?: SnapshotMonth[] } }>(`/investments/${inv.id}/snapshots?year=${year}`);
        const raw = (r.months ?? r.data?.months ?? []).slice();
        const months = await Promise.all(
          raw.map(async (s) => {
            if (s.encryptedPayload) {
              const pl = await decryptPayload<{ closingCapital?: number; closingCapitalUsd?: number }>(s.encryptedPayload);
              if (pl != null) {
                const cap = pl.closingCapital ?? null;
                const capUsd = typeof pl.closingCapitalUsd === "number" ? pl.closingCapitalUsd : (typeof pl.closingCapital === "number" ? pl.closingCapital : null);
                const isZero = (cap === 0 || cap === null) && (capUsd === 0 || capUsd === null);
                return { ...s, closingCapital: cap, closingCapitalUsd: capUsd, _decryptedZero: isZero };
              }
              return { ...s, closingCapital: null, closingCapitalUsd: null, _decryptFailed: true };
            }
            return s;
          })
        );
        // Garantizar orden por mes (1..12) y siempre 12 elementos para que snaps[i] = mes i+1
        months.sort((a, b) => (Number(a.month) ?? 99) - (Number(b.month) ?? 99));
        const filled: SnapshotMonth[] = [];
        for (let i = 0; i < 12; i++) {
          const monthNum = i + 1;
          const existing = months.find((x) => Number(x.month) === monthNum);
          filled.push(
            existing ?? {
              id: null,
              investmentId: inv.id,
              year,
              month: monthNum,
              closingCapital: null,
              closingCapitalUsd: null,
              isClosed: false,
            }
          );
        }
        snaps[inv.id] = filled;
      }
      setSnapshots(snaps);

      const mov = await api<{ year: number; rows: MovementApiRow[] }>(`/investments/movements?year=${year}`);
      const rows = await Promise.all(
        (mov.rows ?? []).map(async (r) => {
          if (r.encryptedPayload) {
            const pl = await decryptPayload<{ amount?: number }>(r.encryptedPayload);
            if (pl != null && typeof pl.amount === "number") return { ...r, amount: pl.amount };
            return { ...r, amount: 0, _decryptFailed: true };
          }
          return r;
        })
      );
      setMovements(rows.map(normalizeMovement));

      await loadMonthCloses();
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorLoadingInvestments"));
    } finally {
      setLoading(false);
    }
  }

  // Recargar al montar, al cambiar año o al volver a esta pantalla (p. ej. tras reabrir un mes en Admin)
  useEffect(() => {
    const path = location.pathname;
    if (path === `${APP_BASE}/investments` || path.endsWith("/investments")) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, location.pathname]);

  /** Garantiza 12 elementos con snaps[i] = mes i+1 para que snapAt y la proyección sean por índice. */
  function getSnapsForInv(inv: Investment): SnapshotMonth[] {
    const r = snapshots[inv.id] ?? [];
    if (r.length === 12 && r.every((s, i) => Number(s.month) === i + 1)) return r;
    const out: SnapshotMonth[] = [];
    for (let i = 0; i < 12; i++) {
      const monthNum = i + 1;
      out.push(
        r.find((x) => Number(x.month) === monthNum) ?? {
          id: null,
          investmentId: inv.id,
          year,
          month: monthNum,
          closingCapital: null,
          closingCapitalUsd: null,
          isClosed: false,
        }
      );
    }
    return out;
  }

  /** Backend returns months in order: snaps[i] = month i+1. Use index as source of truth. */
  function snapAt(snaps: SnapshotMonth[], m: number): SnapshotMonth | undefined {
    const idx = m - 1;
    return idx >= 0 && idx < snaps.length ? snaps[idx] : undefined;
  }

  function monthlyFactor(inv: Investment) {
    return 1 + (inv.targetAnnualReturn ?? 0) / 12;
  }

  function yieldStartMonthForYear(inv: Investment) {
    if (inv.yieldStartYear != null && inv.yieldStartYear > year) return 13;
    if (inv.yieldStartYear != null && inv.yieldStartYear === year) return inv.yieldStartMonth ?? 1;
    return 1;
  }

  /** Valor en USD para proyección. Si tiene encryptedPayload + ambos 0 y NO es “decryptedZero”, es cifrado sin descifrar → null para arrastrar. */
  function valueUsd(snap: SnapshotMonth | undefined, currencyId: string): number | null {
    if (!snap) return null;
    const hasEncrypted = !!snap.encryptedPayload;
    const bothZero = snap.closingCapitalUsd === 0 && snap.closingCapital === 0;
    if (hasEncrypted && bothZero && !snap._decryptedZero) return null;
    if (snap.id === null && bothZero) return null;
    if (snap.closingCapitalUsd != null && typeof snap.closingCapitalUsd === "number") return snap.closingCapitalUsd;
    if (currencyId === "USD" && snap.closingCapital != null && typeof snap.closingCapital === "number") return snap.closingCapital;
    return null;
  }

  function capitalUsdPortfolio(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const s = snapAt(snaps, m);
    const direct = valueUsd(s, inv.currencyId ?? "USD");
    if (direct != null) return direct;

    for (let i = m - 2; i >= 0; i--) {
      const prevVal = valueUsd(snaps[i], inv.currencyId ?? "USD");
      if (prevVal != null) {
        const start = Math.max(yieldStartMonthForYear(inv), i + 1);
        const diff = m - start;
        if (diff <= 0) return prevVal;
        return prevVal * Math.pow(monthlyFactor(inv), diff);
      }
    }
    return 0;
  }

  function capitalUsdAccountCarry(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const s = snapAt(snaps, m);
    const direct = valueUsd(s, inv.currencyId ?? "USD");
    if (direct != null) return direct;

    for (let i = m - 2; i >= 0; i--) {
      const prevVal = valueUsd(snaps[i], inv.currencyId ?? "USD");
      if (prevVal != null) return prevVal;
    }
    return 0;
  }

  function capitalOrigPortfolio(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const s = snapAt(snaps, m);
    if (hasRealValue(s)) return (s!.closingCapital != null ? s!.closingCapital : s!.closingCapitalUsd) ?? null;

    const currencyId = inv.currencyId ?? "USD";
    for (let i = m - 2; i >= 0; i--) {
      const prevValUsd = valueUsd(snaps[i], currencyId);
      if (prevValUsd == null) continue;
      const prev = snaps[i]!;
      const val = prev.closingCapital ?? prev.closingCapitalUsd ?? null;
      if (val == null) continue;
      const start = Math.max(yieldStartMonthForYear(inv), i + 1);
      const diff = m - start;
      if (diff <= 0) return val;
      return val * Math.pow(monthlyFactor(inv), diff);
    }
    return null;
  }

  /** Si tiene encryptedPayload + ambos 0 y NO es _decryptedZero, es cifrado sin descifrar → no usar para arrastre. Si es _decryptedZero, el valor es realmente 0. Placeholder (id null + ambos 0) no es valor real. */
  function hasRealValue(snap: SnapshotMonth | undefined): boolean {
    if (!snap) return false;
    if (snap.encryptedPayload && snap.closingCapital === 0 && snap.closingCapitalUsd === 0 && !snap._decryptedZero) return false;
    if (snap.id === null && snap.closingCapital === 0 && snap.closingCapitalUsd === 0) return false;
    return snap.closingCapital != null || snap.closingCapitalUsd != null;
  }

  function capitalOrigAccountCarry(inv: Investment, snaps: SnapshotMonth[], m: number) {
    const s = snapAt(snaps, m);
    if (hasRealValue(s)) return (s!.closingCapital != null ? s!.closingCapital : s!.closingCapitalUsd) ?? null;

    const currencyId = inv.currencyId ?? "USD";
    for (let i = m - 2; i >= 0; i--) {
      const prevValUsd = valueUsd(snaps[i], currencyId);
      if (prevValUsd == null) continue;
      const prev = snaps[i]!;
      if (prev.closingCapital != null) return prev.closingCapital;
      if (prev.closingCapitalUsd != null) return prev.closingCapitalUsd;
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
    const capitalUsd = inv.currencyId === "UYU" && Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? value / usdUyuRate : value;
    const enc = await encryptPayload({ closingCapital: value, closingCapitalUsd: capitalUsd });
    const body: Record<string, unknown> = enc
      ? { encryptedPayload: enc, closingCapital: 0, usdUyuRate: inv.currencyId === "UYU" ? usdUyuRate : undefined }
      : { closingCapital: value, ...(inv.currencyId === "UYU" && Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? { usdUyuRate } : {}) };
    try {
      const snap = await api<SnapshotMonth>(`/investments/${inv.id}/snapshots/${year}/${m}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      // Al guardar, el API puede devolver 0/null por E2EE; marcar valor real 0 para que no se muestre proyección
      const merged: SnapshotMonth = {
        ...snap,
        closingCapital: value,
        closingCapitalUsd: capitalUsd,
        _decryptedZero: value === 0 && (capitalUsd === 0 || !Number.isFinite(capitalUsd)),
      };
      setSnapshots((prev) => ({
        ...prev,
        [inv.id]: (prev[inv.id] ?? []).map((x) => (x.month === m ? merged : x)),
      }));
      showSuccess("Snapshot saved.");
      await load();
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
      const r = await api<{ months?: SnapshotMonth[]; data?: { months?: SnapshotMonth[] } }>(`/investments/${inv.id}/snapshots?year=${year}`);
      const raw = (r.months ?? r.data?.months ?? []).slice();
      const decrypted = await Promise.all(
        raw.map(async (s) => {
          if (s.encryptedPayload) {
            const pl = await decryptPayload<{ closingCapital?: number; closingCapitalUsd?: number }>(s.encryptedPayload);
            if (pl != null) {
              const cap = pl.closingCapital ?? null;
              const capUsd = typeof pl.closingCapitalUsd === "number" ? pl.closingCapitalUsd : (typeof pl.closingCapital === "number" ? pl.closingCapital : null);
              const isZero = (cap === 0 || cap === null) && (capUsd === 0 || capUsd === null);
              return { ...s, closingCapital: cap, closingCapitalUsd: capUsd, _decryptedZero: isZero };
            }
            return { ...s, closingCapital: null, closingCapitalUsd: null, _decryptFailed: true };
          }
          return s;
        })
      );
      decrypted.sort((a, b) => (Number(a.month) ?? 99) - (Number(b.month) ?? 99));
      const filled: SnapshotMonth[] = [];
      for (let i = 0; i < 12; i++) {
        const monthNum = i + 1;
        const existing = decrypted.find((x) => Number(x.month) === monthNum);
        filled.push(
          existing ?? {
            id: null,
            investmentId: inv.id,
            year,
            month: monthNum,
            closingCapital: null,
            closingCapitalUsd: null,
            isClosed: false,
          }
        );
      }
      setSnapshots((prev) => ({ ...prev, [inv.id]: filled }));
      showSuccess(t("common.saved"));
    } catch (e: any) {
      setError(e?.message ?? t("investments.errorSavingTargetReturn"));
    }
  }

  function investmentHasClosedMonthsWithAmount(inv: Investment): boolean {
    const snaps = getSnapsForInv(inv);
    return snaps.some(
      (s) =>
        s.isClosed &&
        ((s.closingCapital != null && s.closingCapital !== 0) || (s.closingCapitalUsd != null && s.closingCapitalUsd !== 0))
    );
  }

  async function deleteInvestment(inv: Investment) {
    if (investmentHasClosedMonthsWithAmount(inv)) {
      setError(t("investments.deleteBlockedClosedMonths"));
      return;
    }
    if (!confirm(t("investments.deleteInvestmentConfirm", { name: inv.name }))) return;
    setError("");
    try {
      await api(`/investments/${inv.id}`, { method: "DELETE" });
      await load();
      showSuccess(inv.type === "PORTFOLIO" ? t("investments.portfolioDeleted") : t("investments.accountDeleted"));
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    }
  }

  async function saveInvestmentName(inv: Investment, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === inv.name) {
      setEditNameId(null);
      return;
    }
    setError("");
    try {
      const updated = await api<Investment>(`/investments/${inv.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmed }),
      });
      setInvestments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditNameId(null);
      setEditNameDraft("");
      showSuccess(t("investments.nameUpdated"));
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    }
  }

  // Groups
  const portfolios = useMemo(() => investments.filter((i) => i.type === "PORTFOLIO"), [investments]);
  const accounts = useMemo(() => investments.filter((i) => i.type === "ACCOUNT"), [investments]);

  // NET WORTH
  const portfolioNetWorthByMonthUsd = useMemo(
    () => months.map((m) => portfolios.reduce((acc, inv) => acc + capitalUsdPortfolio(inv, getSnapsForInv(inv), m), 0)),
    [portfolios, snapshots, year]
  );

  const accountsNetWorthByMonthUsd = useMemo(
    () => months.map((m) => accounts.reduce((acc, inv) => acc + capitalUsdAccountCarry(inv, getSnapsForInv(inv), m), 0)),
    [accounts, snapshots, year]
  );

  const totalNetWorthByMonthUsd = useMemo(
    () => months.map((_, i) => (portfolioNetWorthByMonthUsd[i] ?? 0) + (accountsNetWorthByMonthUsd[i] ?? 0)),
    [portfolioNetWorthByMonthUsd, accountsNetWorthByMonthUsd]
  );

  // MONTHLY VARIATION
  const portfolioMonthlyVariation = useMemo(() => {
    const nw = portfolioNetWorthByMonthUsd;

    const projectedNextJan = portfolios.reduce((acc, inv) => {
      const decCap = capitalUsdPortfolio(inv, getSnapsForInv(inv), 12);
      return acc + decCap * monthlyFactor(inv);
    }, 0);

    return months.map((m, i) => {
      if (m < 12) return (nw[i + 1] ?? 0) - (nw[i] ?? 0);
      return projectedNextJan - (nw[11] ?? 0);
    });
  }, [portfolioNetWorthByMonthUsd, portfolios, snapshots, year]);

  // MOVEMENTS FLOWS (PORTFOLIO) — USD + UYU converted to USD
  const flows = useMemo(() => {
    const series = months.map(() => 0);
    const invById = new Map(investments.map((i) => [i.id, i]));
    const fx = Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? usdUyuRate : null;

    for (const mv of movements) {
      const m = mv.month ?? toMonthFromIso(mv.date);
      if (m < 1 || m > 12) continue;

      const inv = invById.get(mv.investmentId);
      if (!inv || inv.type !== "PORTFOLIO") continue;

      const sign = mv.type === "deposit" ? 1 : mv.type === "withdrawal" ? -1 : 0;
      const amount = mv.amount ?? 0;
      const currency = (mv.currencyId ?? "USD").toUpperCase();

      if (currency === "USD") {
        series[m - 1] += sign * amount;
      } else if (currency === "UYU" && fx) {
        series[m - 1] += sign * (amount / fx);
      }
    }

    return { series };
  }, [movements, investments, usdUyuRate]);

  const portfolioRealReturns = useMemo(
    () => months.map((_, i) => (portfolioMonthlyVariation[i] ?? 0) - (flows.series[i] ?? 0)),
    [portfolioMonthlyVariation, flows.series]
  );

  function movementTypeLabel(type: string) {
    if (type === "deposit") return t("investments.deposit");
    if (type === "withdrawal") return t("investments.withdrawal");
    return t("investments.yield");
  }

  function exportMovementsCsv() {
    const headers = [
      t("expenses.date"),
      t("investments.investment"),
      t("investments.type"),
      t("investments.currency"),
      t("investments.amount"),
    ];
    const sorted = [...movements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const rows = sorted.map((mv) => [
      (mv.date ?? "").toString().slice(0, 10),
      mv.investmentName ?? mv.investmentId ?? "",
      movementTypeLabel(mv.type),
      mv.currencyId ?? "USD",
      mv._decryptFailed ? "—" : (mv.amount ?? 0),
    ]);
    downloadCsv(`movimientos-inversiones-${year}`, headers, rows);
  }

  // MOVEMENTS CRUD
  async function createMovement(draft: { investmentId: string; type: "deposit" | "withdrawal" | "yield"; month: number; amount: number; currencyId: string }) {
    if (isClosed(draft.month)) {
      setError(t("investments.monthClosedAddMovement"));
      return;
    }
    setError("");
    const date = firstDayUtc(year, draft.month).toISOString();
    const amount = Number(draft.amount) || 0;
    const enc = await encryptPayload({ amount });
    const body: Record<string, unknown> = {
      investmentId: draft.investmentId,
      date,
      type: draft.type,
      currencyId: (draft.currencyId ?? "USD").trim().toUpperCase(),
      amount: enc ? 0 : amount,
      ...(enc ? { encryptedPayload: enc } : {}),
    };
    try {
      const created = await api<MovementApiRow>("/investments/movements", {
        method: "POST",
        body: JSON.stringify(body),
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
    const enc = await encryptPayload({ amount: updated.amount });
    const body: Record<string, unknown> = {
      investmentId: updated.investmentId,
      date: updated.date,
      type: updated.type,
      currencyId: updated.currencyId,
      amount: enc ? 0 : updated.amount,
      ...(enc ? { encryptedPayload: enc } : {}),
    };
    try {
      const res = await api<MovementApiRow>(`/investments/movements/${updated.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
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
  const [newType, setNewType] = useState<"PORTFOLIO" | "ACCOUNT">("ACCOUNT");
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
            <div style={{ fontWeight: 900 }}>
              {t("investments.summaryPrefix")} (
              <span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{t("investments.year")}: {year}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{portfolios.length > 0 ? t("investments.summaryIntro") : t("investments.summaryIntroNoFunds")}</div>
          </div>
          <button className="btn" type="button" onClick={load}>{t("common.refresh")}</button>
        </div>

        <div style={{ overflowX: "auto", maxWidth: "100%", marginTop: 10 }} role="region" aria-label="Net worth and returns by month">
          <table className="table" aria-label={`Summary by month (${currencyLabel})`}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 190 }}></th>
                {months.map((m) => (
                  <th
                    key={`sum-h-${m}`}
                    className="right"
                    style={{
                      ...thStyle,
                      ...(m === currentMonth ? { background: "var(--bg)", fontWeight: 700 } : {}),
                    }}
                    title={m === currentMonth ? t("investments.summaryCurrentMonth") : undefined}
                  >
                    {monthLabel(m)}{m === currentMonth ? " ★" : ""}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr>
                <td style={{ ...tdStyle }}>{t("investments.netWorthAccounts")}</td>
                {months.map((m, i) => (
                  <td
                    key={`sum-ac-${m}`}
                    className="right"
                    style={{ ...tdStyle, ...(m === currentMonth ? { background: "var(--bg)", fontWeight: 600 } : {}) }}
                  >
                    {formatAmountUsd(accountsNetWorthByMonthUsd[i] ?? 0)}
                  </td>
                ))}
              </tr>
              {portfolios.length > 0 && (
              <tr>
                <td style={{ ...tdStyle }}>{t("investments.netWorthFunds")}</td>
                {months.map((m, i) => (
                  <td
                    key={`sum-pf-${m}`}
                    className="right"
                    style={{ ...tdStyle, ...(m === currentMonth ? { background: "var(--bg)", fontWeight: 600 } : {}) }}
                  >
                    {formatAmountUsd(portfolioNetWorthByMonthUsd[i] ?? 0)}
                  </td>
                ))}
              </tr>
              )}
              <tr>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{t("investments.totalNetWorth")}</td>
                {months.map((m, i) => (
                  <td
                    key={`sum-nw-${m}`}
                    className="right"
                    style={{ ...tdStyle, fontWeight: 800, ...(m === currentMonth ? { background: "var(--bg)" } : {}) }}
                  >
                    {formatAmountUsd(totalNetWorthByMonthUsd[i] ?? 0)}
                  </td>
                ))}
              </tr>

              {portfolios.length > 0 && (
                <tr>
                  <td style={{ ...tdStyle }}>{t("investments.realReturnsPortfolioLabel")}</td>
                  {months.map((m, i) => (
                    <td
                      key={`sum-rr-${m}`}
                      className="right"
                      style={{ ...tdStyle, ...(m === currentMonth ? { background: "var(--bg)" } : {}) }}
                    >
                      {formatAmountUsd(portfolioRealReturns[i] ?? 0)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>
          {t("investments.summaryIntroNote")}
        </div>
        <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
          {portfolios.length > 0 ? t("investments.monthlyVariationNote") : t("investments.monthlyVariationNoteNoFunds")}
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
                const snaps = getSnapsForInv(inv);
                const isEditingName = editNameId === inv.id;
                const hasClosedWithAmount = investmentHasClosedMonthsWithAmount(inv);

                return (
                  <tr key={inv.id}>
                    <td style={{ ...tdStyle, ...stickyCell, fontWeight: 700 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                        {isEditingName ? (
                          <input
                            className="input"
                            value={editNameDraft}
                            onChange={(e) => setEditNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveInvestmentName(inv, editNameDraft);
                              if (e.key === "Escape") { setEditNameId(null); setEditNameDraft(""); }
                            }}
                            onBlur={() => saveInvestmentName(inv, editNameDraft)}
                            style={{ flex: 1, minWidth: 0, height: 28, fontSize: 11 }}
                            autoFocus
                          />
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => { setEditNameId(inv.id); setEditNameDraft(inv.name); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditNameId(inv.id); setEditNameDraft(inv.name); } }}
                            style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                            title={t("investments.editName")}
                          >
                            {inv.name}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteInvestment(inv)}
                          title={hasClosedWithAmount ? t("investments.deleteBlockedClosedMonths") : t("investments.deleteLabel")}
                          disabled={hasClosedWithAmount}
                          style={{
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: hasClosedWithAmount ? "not-allowed" : "pointer",
                            color: hasClosedWithAmount ? "var(--muted)" : "#c53030",
                          }}
                          aria-label={t("investments.deleteLabel")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
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
                      const s = snapAt(snaps, m);
                      const hasReal = s?.closingCapital != null;
                      const display = capitalOrigAccountCarry(inv, snaps, m);
                      const prevMonthClosed = m >= 2 && isClosed(m - 1);
                      const locked = isClosed(m) || prevMonthClosed;
                      const isEditing = editingCell?.invId === inv.id && editingCell?.month === m;
                      const inputValue = isEditing ? editingCell!.value : (display == null ? "" : String(Math.round(display)));

                      return (
                        <td key={`a-${inv.id}-${m}`} className="right" style={tdStyle}>
                          <input
                            className="input"
                            style={{ ...inputStyle, opacity: locked ? 0.6 : hasReal ? 1 : 0.75 }}
                            disabled={locked}
                            title={locked ? t("investments.closedMonth") : undefined}
                            value={inputValue}
                            onFocus={() => setEditingCell({ invId: inv.id, month: m, value: display == null ? "" : String(Math.round(display)) })}
                            onChange={(e) => setEditingCell((prev) => (prev && prev.invId === inv.id && prev.month === m ? { ...prev, value: e.target.value } : prev))}
                            onBlur={() => {
                              if (locked) return;
                              const raw = inputValue.trim();
                              if (raw) saveCell(inv, m, Number(raw));
                              setEditingCell(null);
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
              style={{ height: 32, fontSize: 11, padding: "6px 10px" }}
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
            {newType === "ACCOUNT" ? t("investments.addAccount") : t("investments.addPortfolio")}
          </button>
        </div>
      </div>

      {portfolios.length > 0 && (
      <>
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
                const snaps = getSnapsForInv(inv);
                const isEditingName = editNameId === inv.id;
                const hasClosedWithAmount = investmentHasClosedMonthsWithAmount(inv);
                return (
                  <tr key={inv.id}>
                    <td style={{ ...tdStyle, ...stickyCell, fontWeight: 700, verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                        {isEditingName ? (
                          <input
                            className="input"
                            value={editNameDraft}
                            onChange={(e) => setEditNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveInvestmentName(inv, editNameDraft);
                              if (e.key === "Escape") { setEditNameId(null); setEditNameDraft(""); }
                            }}
                            onBlur={() => saveInvestmentName(inv, editNameDraft)}
                            style={{ flex: 1, minWidth: 0, height: 28, fontSize: 11 }}
                            autoFocus
                          />
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => { setEditNameId(inv.id); setEditNameDraft(inv.name); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditNameId(inv.id); setEditNameDraft(inv.name); } }}
                            style={{ cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
                            title={t("investments.editName")}
                          >
                            {inv.name}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteInvestment(inv)}
                          title={hasClosedWithAmount ? t("investments.deleteBlockedClosedMonths") : t("investments.deleteLabel")}
                          disabled={hasClosedWithAmount}
                          style={{
                            flexShrink: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 22,
                            height: 22,
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: hasClosedWithAmount ? "not-allowed" : "pointer",
                            color: hasClosedWithAmount ? "var(--muted)" : "#c53030",
                          }}
                          aria-label={t("investments.deleteLabel")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
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
                      const s = snapAt(snaps, m);
                      const hasReal = s?.closingCapital != null;
                      const display = capitalOrigPortfolio(inv, snaps, m);
                      const prevMonthClosed = m >= 2 && isClosed(m - 1);
                      const locked = isClosed(m) || prevMonthClosed;
                      const isEditing = editingCell?.invId === inv.id && editingCell?.month === m;
                      const inputValue = isEditing ? editingCell!.value : (display == null ? "" : String(Math.round(display)));

                      return (
                        <td key={`p-${inv.id}-${m}`} style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle" }}>
                          <input
                            className="input"
                            style={{ ...inputStyle, opacity: locked ? 0.6 : hasReal ? 1 : 0.75 }}
                            disabled={locked}
                            title={locked ? t("investments.closedMonth") : undefined}
                            value={inputValue}
                            onFocus={() => setEditingCell({ invId: inv.id, month: m, value: display == null ? "" : String(Math.round(display)) })}
                            onChange={(e) => setEditingCell((prev) => (prev && prev.invId === inv.id && prev.month === m ? { ...prev, value: e.target.value } : prev))}
                            onBlur={() => {
                              if (locked) return;
                              const raw = inputValue.trim();
                              if (raw) saveCell(inv, m, Number(raw));
                              setEditingCell(null);
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
                    {t("investments.noPortfolioYetHint")}
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
                  <td key={`ps-nw-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{formatAmountUsd(portfolioNetWorthByMonthUsd[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 800, textAlign: "left" }}>{t("investments.monthlyVariation")}</td>
                {months.map((m, i) => (
                  <td key={`ps-var-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{formatAmountUsd(portfolioMonthlyVariation[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 800, textAlign: "left" }}>{t("investments.netFlowsMovements")}</td>
                {months.map((m, i) => (
                  <td key={`ps-flow-${m}`} style={{ ...tdStyle, textAlign: "center" }}>{formatAmountUsd(flows.series[i] ?? 0)}</td>
                ))}
              </tr>

              <tr>
                <td style={{ ...tdStyle, fontWeight: 900, textAlign: "left" }}>{t("investments.realReturns")}</td>
                {months.map((m, i) => (
                  <td key={`ps-rr-${m}`} style={{ ...tdStyle, fontWeight: 900, textAlign: "center" }}>
                    {formatAmountUsd(portfolioRealReturns[i] ?? 0)}
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
          <button className="btn" type="button" onClick={exportMovementsCsv} aria-label={t("common.exportCsv")}>
            {t("common.exportCsv")}
          </button>
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
      </>
      )}

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