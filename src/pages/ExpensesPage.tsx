// src/pages/ExpensesPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell, useAppYearMonth, useDisplayCurrency } from "../layout/AppShell";
import { getCategoryDisplayName, getExpenseTypeLabel, getTemplateDescriptionDisplay } from "../utils/categoryI18n";
import { downloadCsv } from "../utils/exportCsv";
import { getFxDefault, setFxDefault } from "../utils/fx";

type ExpenseType = "FIXED" | "VARIABLE";

type Category = { id: string; name: string; expenseType: ExpenseType; nameKey?: string | null };

type Expense = {
  id: string;
  description: string;
  amount: number;
  amountUsd: number;
  usdUyuRate?: number | null;
  date: string; // ISO (guardado como 1er día del mes)
  currencyId: "UYU" | "USD" | string;
  categoryId: string;
  expenseType: ExpenseType;
  category: { id: string; name: string };
  encryptedPayload?: string | null;
  _decryptFailed?: boolean;
};

type MonthCloseRow = { year: number; month: number; isClosed?: boolean };
type MonthClosesResp = { year: number; rows: MonthCloseRow[] };
type ExpensesPageData = {
  year: number;
  month: number;
  categories: Category[];
  expenses: Expense[];
  planned: { rows: PlannedExpense[] };
  monthCloses: MonthClosesResp;
};

type PlannedExpense = {
  id: string;
  year: number;
  month: number;
  templateId?: string | null;

  expenseType: ExpenseType;
  categoryId: string;
  description: string;

  amountUsd?: number | null;
  amount?: number | null;
  usdUyuRate?: number | null;
  isConfirmed: boolean;

  expenseId?: string | null;
  encryptedPayload?: string | null;

  category?: { id: string; name: string };
  template?: { defaultCurrencyId?: string | null } | null;
};

function ymToInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`; // YYYY-MM
}
function inputValueToYm(v: string) {
  const [y, m] = v.split("-").map((x) => Number(x));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}
function isoToYm(iso: string) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  if (!Number.isInteger(y) || !Number.isInteger(m)) return null;
  return { year: y, month: m };
}

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

type Draft = {
  ym?: string; // YYYY-MM
  description?: string;
  amount?: number;
  currencyId?: "UYU" | "USD";
  usdUyuRate?: number;
  categoryId?: string;
  expenseType?: ExpenseType;
};
type DraftMap = Record<string, Draft>;

type PlannedDraft = {
  description?: string;
  amountUsd?: number;
  categoryId?: string;
  expenseType?: ExpenseType;
};
type PlannedDraftMap = Record<string, PlannedDraft>;

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function ExpensesPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { encryptPayload, decryptPayload, hasEncryptionSupport } = useEncryption();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, showSuccess, isMobile, serverFxRate } = useAppShell();
  const { formatAmountUsd, currencyLabel } = useDisplayCurrency();

  const { year, month } = useAppYearMonth();

  useEffect(() => {
    setHeader({
      title: t("expenses.title"),
      subtitle: (
        <>
          {t("expenses.subtitlePrefix")} (
          <span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
        </>
      ),
    });
  }, [setHeader, t, currencyLabel]);

  // ✅ Step 2 activo = expenses
  const onboardingActive = meLoaded && !!me && onboardingStep === "expenses";

  const draftsRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [planned, setPlanned] = useState<PlannedExpense[]>([]);

  // ✅ closed months (por año)
  const [closedMonths, setClosedMonths] = useState<Set<number>>(new Set());
  const isClosed = (m: number) => closedMonths.has(m);

  // Create EXPENSE (real) form
  const [expenseTypeCreate, setExpenseTypeCreate] = useState<ExpenseType>("VARIABLE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [currencyId, setCurrencyId] = useState<"UYU" | "USD">("UYU");
  const [usdUyuRate, setUsdUyuRate] = useState<number>(getFxDefault());
  useEffect(() => {
    if (serverFxRate != null) setUsdUyuRate(serverFxRate);
  }, [serverFxRate]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [ymCreate, setYmCreate] = useState<string>(ymToInputValue(year, month));

  // inline drafts (Expenses real)
  const [drafts, setDrafts] = useState<DraftMap>({});
  function getDraft(id: string): Draft {
    return drafts[id] ?? {};
  }
  function setDraft(id: string, patch: Draft) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }
  function clearDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // inline drafts (PlannedExpense)
  const [plannedDrafts, setPlannedDrafts] = useState<PlannedDraftMap>({});
  function getPlannedDraft(id: string): PlannedDraft {
    return plannedDrafts[id] ?? {};
  }
  function setPlannedDraft(id: string, patch: PlannedDraft) {
    setPlannedDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }
  function clearPlannedDraft(id: string) {
    setPlannedDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function getPlannedAmountUsdValue(p: PlannedExpense, d: PlannedDraft) {
    const raw = d.amountUsd !== undefined ? Number(d.amountUsd) : Number(p.amountUsd ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  }

  function getPlannedDisplayState(p: PlannedExpense, d: PlannedDraft) {
    const isUyu = p.template?.defaultCurrencyId === "UYU";
    const hasLockedUyu = isUyu && p.amount != null && p.usdUyuRate != null && Number.isFinite(p.amount) && p.usdUyuRate > 0;
    const rate = hasLockedUyu ? p.usdUyuRate! : isUyu && Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? usdUyuRate : 1;
    const amountUsd = getPlannedAmountUsdValue(p, d);
    const hasDraftAmount = d.amountUsd !== undefined && Number.isFinite(Number(d.amountUsd));
    const displayValue = isUyu
      ? hasDraftAmount
        ? Math.round(amountUsd * rate)
        : hasLockedUyu
          ? Math.round(p.amount!)
          : Math.round(amountUsd * rate)
      : Math.round(amountUsd);

    return { isUyu, hasLockedUyu, rate, amountUsd, displayValue };
  }

  const categoriesByType = useMemo(() => {
    const out: Record<ExpenseType, Category[]> = { FIXED: [], VARIABLE: [] };
    for (const c of categories) out[c.expenseType]?.push(c);
    out.FIXED.sort((a, b) => a.name.localeCompare(b.name));
    out.VARIABLE.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [categories]);

  function categoryTypeOf(categoryId?: string | null): ExpenseType | null {
    if (!categoryId) return null;
    const c = categories.find((x) => x.id === categoryId);
    return c?.expenseType ?? null;
  }

  function applyCategories(cats: Category[]) {
    setCategories(cats);
    const list = cats.filter((c) => c.expenseType === expenseTypeCreate);
    if (list.length > 0) {
      const stillValid = list.some((c) => c.id === categoryId);
      if (!stillValid) setCategoryId(list[0].id);
    } else {
      setCategoryId("");
    }
  }

  async function resolveExpenses(list: Expense[]) {
    return Promise.all(
      list.map(async (e) => {
        if (e.encryptedPayload) {
          const pl = await decryptPayload<{ description?: string; amount?: number | string; amountUsd?: number | string; defaultAmountUsd?: number | string }>(e.encryptedPayload);
          if (pl) {
            const resolvedAmountUsd = toFiniteNumber(pl.amountUsd ?? pl.defaultAmountUsd ?? e.amountUsd, toFiniteNumber(e.amountUsd));
            const decryptedAmount = pl.amount == null ? null : toFiniteNumber(pl.amount, NaN);
            const resolvedAmount =
              decryptedAmount != null && Number.isFinite(decryptedAmount)
                ? decryptedAmount
                :
              (e.currencyId === "USD"
                ? resolvedAmountUsd
                : e.currencyId === "UYU" && Number(e.usdUyuRate) > 0
                  ? Math.round(resolvedAmountUsd * Number(e.usdUyuRate))
                  : toFiniteNumber(e.amount));
            return {
              ...e,
              description: pl.description ?? e.description,
              amount: resolvedAmount,
              amountUsd: resolvedAmountUsd,
            };
          }
          return { ...e, _decryptFailed: true, description: "—", amount: 0, amountUsd: 0 };
        }
        return e;
      })
    );
  }

  async function resolvePlanned(rows: PlannedExpense[]) {
    const raw = rows.filter((p) => !p.isConfirmed);
    return Promise.all(
      raw.map(async (p) => {
        if (p.encryptedPayload) {
          const pl = await decryptPayload<{ description?: string; amountUsd?: number | string | null; amount?: number | string | null; defaultAmountUsd?: number | string | null }>(p.encryptedPayload);
          if (pl != null) {
            const resolvedAmountUsd = pl.amountUsd ?? pl.defaultAmountUsd ?? p.amountUsd;
            const amountUsd = resolvedAmountUsd == null ? null : toFiniteNumber(resolvedAmountUsd, 0);
            return {
              ...p,
              description: typeof pl.description === "string" ? pl.description : p.description,
              amountUsd,
              amount: pl.amount == null ? (p.amount ?? null) : toFiniteNumber(pl.amount, 0),
            };
          }
          return { ...p, description: "—", amountUsd: null, amount: null };
        }
        return p;
      })
    );
  }

  function applyMonthCloses(r: MonthClosesResp) {
    setClosedMonths(new Set((r.rows ?? []).filter((x) => x.isClosed !== false).map((x) => x.month)));
  }

  async function loadPageData() {
    const payload = await api<ExpensesPageData>(`/expenses/page-data?year=${year}&month=${month}`);
    const [resolvedExpenses, resolvedPlanned] = await Promise.all([
      resolveExpenses(payload.expenses ?? []),
      resolvePlanned(payload.planned?.rows ?? []),
    ]);
    applyCategories(payload.categories ?? []);
    setExpenses(resolvedExpenses);
    setPlanned(resolvedPlanned);
    applyMonthCloses(payload.monthCloses ?? { year, rows: [] });
  }

  async function loadAll() {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await loadPageData();
      setYmCreate(ymToInputValue(year, month));
    } catch (err: any) {
      setError(err?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const createYm = inputValueToYm(ymCreate);
  const createMonthClosed = createYm ? isClosed(createYm.month) : false;

  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  const totalUsdMonth = useMemo(
    () => expenses.filter((e) => !e._decryptFailed).reduce((acc, e) => acc + toFiniteNumber(e.amountUsd), 0),
    [expenses]
  );

  const plannedSorted = useMemo(() => {
    const typeRank = (type: ExpenseType) => (type === "FIXED" ? 0 : 1);
    return [...planned].sort((a, b) => {
      const typeCmp = typeRank(a.expenseType) - typeRank(b.expenseType);
      if (typeCmp !== 0) return typeCmp;

      const aCategory = getCategoryDisplayName(
        { name: a.category?.name ?? "", expenseType: a.expenseType },
        t
      );
      const bCategory = getCategoryDisplayName(
        { name: b.category?.name ?? "", expenseType: b.expenseType },
        t
      );
      const categoryCmp = aCategory.localeCompare(bCategory);
      if (categoryCmp !== 0) return categoryCmp;

      return (a.description ?? "").localeCompare(b.description ?? "");
    });
  }, [planned, t]);

  function exportExpensesCsv() {
    const headers = [
      t("expenses.date"),
      t("expenses.description"),
      t("expenses.category"),
      t("expenses.type"),
      t("expenses.curr"),
      t("expenses.amount"),
      t("expenses.amountUsd"),
      t("expenses.fx"),
    ];
    const rows = expenses.map((e) => {
      const categoryDisplay = e.category
        ? getCategoryDisplayName(
            { name: e.category.name, expenseType: e.expenseType },
            t
          )
        : "";
      return [
        (e.date ?? "").toString().slice(0, 10),
        e._decryptFailed ? "—" : (e.description ?? ""),
        categoryDisplay,
        getExpenseTypeLabel(e.expenseType, t),
        e.currencyId ?? "",
        e._decryptFailed ? "—" : (e.amount ?? 0),
        e._decryptFailed ? "—" : (e.amountUsd ?? 0),
        e.currencyId === "UYU" && e.usdUyuRate != null ? e.usdUyuRate : "",
      ];
    });
    downloadCsv(`gastos-${year}-${String(month).padStart(2, "0")}`, headers, rows);
  }

  // Client-side summary from confirmed expenses only.
  const summaryByCategory = useMemo(() => {
    const byCat = new Map<string, { categoryName: string; total: number }>();
    for (const e of expenses) {
      if (e._decryptFailed) continue;
      const id = e.categoryId;
      const name = e.category?.name ?? "(unknown)";
      const prev = byCat.get(id);
      byCat.set(id, { categoryName: name, total: (prev?.total ?? 0) + toFiniteNumber(e.amountUsd) });
    }
    return [...byCat.entries()]
      .map(([categoryId, v]) => ({ categoryId, categoryName: v.categoryName, currencyId: "USD" as const, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  const expensesSorted = useMemo(() => {
    const typeRank = (type: ExpenseType) => (type === "FIXED" ? 0 : 1);
    return [...expenses].sort((a, b) => {
      const typeCmp = typeRank(a.expenseType) - typeRank(b.expenseType);
      if (typeCmp !== 0) return typeCmp;

      const aCategory = getCategoryDisplayName(
        { name: a.category?.name ?? "", expenseType: a.expenseType },
        t
      );
      const bCategory = getCategoryDisplayName(
        { name: b.category?.name ?? "", expenseType: b.expenseType },
        t
      );
      const categoryCmp = aCategory.localeCompare(bCategory);
      if (categoryCmp !== 0) return categoryCmp;

      return (a.description ?? "").localeCompare(b.description ?? "");
    });
  }, [expenses, t]);

  const expensesFixed = useMemo(() => expensesSorted.filter((e) => e.expenseType === "FIXED"), [expensesSorted]);
  const expensesVariable = useMemo(() => expensesSorted.filter((e) => e.expenseType === "VARIABLE"), [expensesSorted]);

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const ym = inputValueToYm(ymCreate);
    if (!ym) return setError(t("expenses.invalidMonth"));
    if (isClosed(ym.month)) return setError(t("expenses.monthClosedEdit"));

    if (!categoryId) return setError(t("expenses.pickCategory"));
    if (!description.trim()) return setError(t("expenses.descriptionRequired"));

    const ct = categoryTypeOf(categoryId);
    const finalType: ExpenseType = ct ?? expenseTypeCreate;

    if (currencyId === "UYU") setFxDefault(usdUyuRate);

    const amountNum = Number(amount);
    const amountUsdNum =
      currencyId === "UYU" && Number(usdUyuRate) > 0 ? amountNum / Number(usdUyuRate) : amountNum;
    try {
      const body: Record<string, unknown> = {
        description: description.trim(),
        amount: amountNum,
        currencyId,
        usdUyuRate: currencyId === "UYU" ? Number(usdUyuRate) : undefined,
        categoryId,
        date: ymCreate,
        expenseType: finalType,
      };
      const enc = await encryptPayload({
        description: description.trim(),
        amount: amountNum,
        amountUsd: amountUsdNum,
      });
      if (enc) {
        body.encryptedPayload = enc;
        body.description = "(encrypted)";
        body.amount = 0;
      }
      await api("/expenses", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await loadPageData();
      setInfo(t("expenses.expenseCreated"));
      showSuccess(t("expenses.expenseCreated"));
    } catch (err: any) {
      setError(err?.message ?? t("common.error"));
    }
  }

  async function removeExpense(expenseId: string, expenseMonth: number) {
    setError("");
    setInfo("");
    if (isClosed(expenseMonth)) return setError(t("expenses.monthClosedDelete"));
    if (!confirm(t("expenses.deleteExpenseConfirm"))) return;

    try {
      await api(`/expenses/${expenseId}`, { method: "DELETE" });
      await loadPageData();
      setInfo(t("expenses.expenseDeleted"));
      showSuccess(t("expenses.expenseDeleted"));
    } catch (err: any) {
      setError(err?.message ?? t("common.error"));
    }
  }

  async function patchExpense(expenseId: string, expenseMonth: number, patch: Record<string, unknown>) {
    if (isClosed(expenseMonth)) {
      setError(t("expenses.monthClosedEdit"));
      return;
    }
    const expense = expenses.find((e) => e.id === expenseId);
    let body = { ...patch };
    const needEncrypt =
      (patch.description !== undefined || patch.amount !== undefined) && expense;
    if (needEncrypt) {
      const desc =
        patch.description !== undefined ? (patch.description as string) : (expense.description ?? "");
      const amt =
        patch.amount !== undefined ? Number(patch.amount) : (expense.amount ?? 0);
      const amtUsd =
        expense.currencyId === "UYU" && Number(expense.usdUyuRate) > 0
          ? amt / Number(expense.usdUyuRate)
          : amt;
      const enc = await encryptPayload({
        description: desc,
        amount: amt,
        amountUsd: amtUsd,
      });
      if (enc) {
        body = {
          ...body,
          description: "(encrypted)",
          encryptedPayload: enc,
          amount: 0,
        };
      }
    }
    await api(`/expenses/${expenseId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    await loadPageData();
  }

  async function patchPlanned(plannedId: string, patch: any) {
    if (isClosed(month)) {
      setError(t("expenses.monthClosedEditDrafts"));
      return;
    }
    const body = await buildPlannedPatchBody(plannedId, patch);
    await api(`/plannedExpenses/${plannedId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    await loadPageData();
  }

  async function buildPlannedPatchBody(plannedId: string, patch: any) {
    let body = patch;
    if (hasEncryptionSupport && (patch.description !== undefined || patch.amountUsd !== undefined || patch.amount !== undefined)) {
      const p = planned.find((x) => x.id === plannedId);
      if (p) {
        const derivedAmountUsd =
          patch.amountUsd !== undefined
            ? Number(patch.amountUsd)
            : patch.amount !== undefined && Number.isFinite(Number(patch.usdUyuRate)) && Number(patch.usdUyuRate) > 0
              ? Math.round((Number(patch.amount) / Number(patch.usdUyuRate)) * 100) / 100
              : p.amountUsd ?? 0;
        const merged = {
          description: patch.description ?? p.description,
          amountUsd: derivedAmountUsd,
          amount: patch.amount ?? p.amount ?? 0,
        };
        const enc = await encryptPayload(merged);
        if (enc) {
          body = {
            encryptedPayload: enc,
            ...(patch.categoryId !== undefined && { categoryId: patch.categoryId }),
            ...(patch.expenseType !== undefined && { expenseType: patch.expenseType }),
          };
        }
      }
    }
    return body;
  }

  /** Build patch from draft so backend has latest values before confirm (e.g. if user edited amount without blur). */
  function buildPlannedDraftPatch(p: PlannedExpense, d: PlannedDraft): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    if (d.categoryId !== undefined) patch.categoryId = d.categoryId;
    if (d.expenseType !== undefined) patch.expenseType = d.expenseType;
    if (d.description !== undefined && d.description.trim()) patch.description = d.description.trim();

    const hasAmountDraft = d.amountUsd !== undefined;
    if (hasAmountDraft) {
      const v = Number(d.amountUsd ?? 0);
      if (!Number.isFinite(v) || v <= 0) {
        if (Object.keys(patch).length === 0) return null;
        return patch;
      }
      const isUyu = p.template?.defaultCurrencyId === "UYU";
      const hasLockedUyu =
        isUyu &&
        p.amount != null &&
        p.usdUyuRate != null &&
        Number.isFinite(p.amount) &&
        Number.isFinite(p.usdUyuRate) &&
        p.usdUyuRate > 0;
      const rate = hasLockedUyu
        ? p.usdUyuRate!
        : isUyu && Number.isFinite(usdUyuRate) && usdUyuRate > 0
          ? usdUyuRate
          : 1;
      if (isUyu && Number.isFinite(rate) && rate > 0) {
        patch.amountUsd = Math.round(v * 100) / 100;
        patch.amount = Math.round(v * rate);
        patch.usdUyuRate = rate;
      } else {
        patch.amountUsd = Math.round(v * 100) / 100;
      }
    }
    return Object.keys(patch).length === 0 ? null : patch;
  }

  async function confirmPlanned(p: PlannedExpense) {
    setError("");
    setInfo("");
    if (isClosed(month)) return setError(t("expenses.monthClosedConfirmDrafts"));

    try {
      const d = getPlannedDraft(p.id);
      const patch = buildPlannedDraftPatch(p, d);
      if (patch && Object.keys(patch).length > 0) {
        await patchPlanned(p.id, patch);
        clearPlannedDraft(p.id);
      }

      const body =
        p.template?.defaultCurrencyId === "UYU" && Number.isFinite(usdUyuRate) && usdUyuRate > 0
          ? JSON.stringify({ usdUyuRate: usdUyuRate })
          : undefined;

      await api(`/plannedExpenses/${p.id}/confirm`, { method: "POST", ...(body ? { body } : {}) });
      await loadPageData();
      setInfo(t("expenses.draftConfirmed"));
      showSuccess(t("expenses.draftConfirmed"));
    } catch (err: any) {
      setError(err?.message ?? t("expenses.errorConfirmingDraft"));
    }
  }

  async function confirmAllPlanned() {
    setError("");
    setInfo("");
    if (isClosed(month)) return setError(t("expenses.monthClosedConfirmDrafts"));
    if (planned.length === 0) return;

    setLoading(true);
    try {
      const items = await Promise.all(
        planned.map(async (p) => {
          const d = getPlannedDraft(p.id);
          const patch = buildPlannedDraftPatch(p, d);
          const patchBody =
            patch && Object.keys(patch).length > 0
              ? await buildPlannedPatchBody(p.id, patch)
              : undefined;
          return {
            id: p.id,
            ...(patchBody ? { patch: patchBody } : {}),
            ...(p.template?.defaultCurrencyId === "UYU" && Number.isFinite(usdUyuRate) && usdUyuRate > 0
              ? { usdUyuRate }
              : {}),
          };
        })
      );

      const result = await api<{
        count: number;
        failedCount?: number;
        rows: Array<{ id: string; expenseId: string; alreadyConfirmed?: boolean }>;
        failed?: Array<{ id: string; error: string }>;
      }>("/plannedExpenses/confirm-batch", {
        method: "POST",
        body: JSON.stringify({ items }),
      });

      const confirmedIds = new Set((result.rows ?? []).map((row) => row.id));
      for (const item of items) {
        if (confirmedIds.has(item.id) && (item as any).patch) clearPlannedDraft(item.id);
      }
      await loadPageData();

      if ((result.failedCount ?? 0) > 0) {
        if ((result.count ?? 0) > 0) {
          const msg = t("expenses.someDraftsConfirmed", {
            confirmed: result.count,
            failed: result.failedCount ?? 0,
          });
          setInfo(msg);
          showSuccess(msg);
        } else {
          setError(t("expenses.noDraftsConfirmed"));
        }
      } else {
        setInfo(t("expenses.allDraftsConfirmed"));
        showSuccess(t("expenses.allDraftsConfirmed"));
      }
    } catch (err: any) {
      setError(err?.message ?? t("expenses.errorConfirmingDrafts"));
    } finally {
      setLoading(false);
    }
  }

  // Keep create form category list aligned to type selection
  useEffect(() => {
    const list = categoriesByType[expenseTypeCreate] ?? [];
    if (list.length === 0) return;
    const ok = list.some((c) => c.id === categoryId);
    if (!ok) setCategoryId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseTypeCreate, categories.length]);

  const canEditThisMonth = !isClosed(month);

  // onboarding actions
  function goDrafts() {
    draftsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function skipOnboarding() {
    setOnboardingStep("done");
    nav(APP_BASE, { replace: false });
  }

  function markStep2Done() {
    setOnboardingStep("investments");
    nav(`${APP_BASE}/investments`, { replace: false });
  }

  return (
    <div className="grid">
      {/* ✅ Onboarding banner (Step 2) */}
      {onboardingActive && (
        <div className="card" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(15,23,42,0.02)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{t("expenses.step2Title")}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 780 }}>
                <Trans i18nKey="expenses.step2Desc" values={{ month: monthLabel }} components={{ b: <b /> }} />
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                {t("expenses.step2Tip")}
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="button" onClick={goDrafts} style={{ height: 40 }}>
                {t("expenses.goToDrafts")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={confirmAllPlanned}
                disabled={!canEditThisMonth || planned.length === 0 || loading}
                title={!canEditThisMonth ? t("expenses.monthClosed") : planned.length === 0 ? t("expenses.noDraftsToConfirm") : t("expenses.confirmAllDrafts")}
                style={{ height: 40 }}
              >
                {loading ? t("expenses.confirming") : `${t("expenses.confirmAll")} (${planned.length})`}
              </button>
              <button className="btn primary" type="button" onClick={markStep2Done} style={{ height: 40 }}>
                {t("expenses.imDoneStep2")}
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card expenses-summary-card" style={{ minWidth: 0 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "baseline", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 850, fontSize: isMobile ? 16 : 18 }}>
              {t("expenses.monthlySummaryPrefix")} (
              <span style={{ color: "var(--brand-green)" }}>{currencyLabel}</span>)
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t("expenses.viewing")}: {monthLabel} • {t("expenses.status")}:{" "}
              <span style={{ fontWeight: 850, color: isClosed(month) ? "var(--text)" : "var(--muted)" }}>
                {isClosed(month) ? t("common.closed") : t("common.open")}
              </span>
            </div>
          </div>

          <div className={isMobile ? "" : "right"}>
            <div className="muted" style={{ fontSize: 12 }}>{t("expenses.totalMonth")}</div>
            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, lineHeight: 1 }}>{formatAmountUsd(totalUsdMonth)}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={loadAll} disabled={loading}>
            {loading ? (
            <span className="loading-inline">
              <span className="loading-spinner" aria-hidden />
              {t("common.loading")}
            </span>
          ) : (
            t("common.refresh")
          )}
          </button>
          <button className="btn" type="button" onClick={exportExpensesCsv} aria-label={t("common.exportCsv")}>
            {t("common.exportCsv")}
          </button>
          {info && <div style={{ color: "rgba(15,23,42,0.75)", fontWeight: 650, fontSize: isMobile ? 13 : undefined }}>{info}</div>}
        </div>

        {error && <div style={{ marginTop: 10, color: "var(--danger)" }}>{error}</div>}

        <div style={{ marginTop: 12 }}>
          {summaryByCategory.length === 0 ? (
            <div className="muted">
              {t("expenses.noExpensesYet")}
            </div>
          ) : isMobile ? (
            <div className="expenses-summary-mobile-list">
              {summaryByCategory.map((c) => (
                <div key={c.categoryId} className="expenses-summary-mobile-item">
                  <span className="muted" style={{ fontSize: 12 }}>
                    {getCategoryDisplayName(
                      categories.find((cat) => cat.id === c.categoryId) ?? { name: c.categoryName, expenseType: "VARIABLE" },
                      t
                    )}
                  </span>
                  <strong>{formatAmountUsd(c.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
              <table className="table">
                <thead>
                  <tr>
                    {summaryByCategory.map((c) => (
                      <th key={c.categoryId} className="right" style={{ minWidth: 120 }}>
                        {getCategoryDisplayName(
                          categories.find((cat) => cat.id === c.categoryId) ?? { name: c.categoryName, expenseType: "VARIABLE" },
                          t
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {summaryByCategory.map((c) => (
                      <td key={c.categoryId} className="right">
                        {formatAmountUsd(c.total)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add real expense */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 850, marginBottom: 6 }}>{t("expenses.addExpenseReal")}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t("expenses.addExpenseDesc")}
            </div>
          </div>
          <Badge>{createMonthClosed ? t("expenses.monthClosed") : t("expenses.monthOpen")}</Badge>
        </div>

        <form
          onSubmit={createExpense}
          className={isMobile ? "expenses-form-mobile" : "grid"}
          style={{
            marginTop: 12,
            ...(isMobile
              ? { display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }
              : {
                  gridTemplateColumns:
                    currencyId === "UYU"
                      ? "0.8fr 1.6fr 1.6fr 0.8fr 0.8fr 1.4fr 1fr auto"
                      : "0.8fr 1.6fr 1.6fr 0.8fr 0.8fr 1fr auto",
                  alignItems: "end",
                  gap: 10,
                }),
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.type")}</div>
            <select
              className="select"
              value={expenseTypeCreate}
              disabled={createMonthClosed}
              onChange={(e) => setExpenseTypeCreate(e.target.value as ExpenseType)}
            >
              <option value="FIXED">{t("expenses.typeFixed")}</option>
              <option value="VARIABLE">{t("expenses.typeVariable")}</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.category")}</div>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={createMonthClosed}>
              {(categoriesByType[expenseTypeCreate] ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {getCategoryDisplayName(c, t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.description")}</div>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("expenses.descriptionPlaceholder")} disabled={createMonthClosed} />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.curr")}</div>
            <select
              className="select"
              value={currencyId}
              disabled={createMonthClosed}
              onChange={(e) => {
                const v = e.target.value as "UYU" | "USD";
                setCurrencyId(v);
                if (v === "UYU") setUsdUyuRate(getFxDefault());
              }}
              style={{ fontSize: 11 }}
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.amount")}</div>
            <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} disabled={createMonthClosed} />
          </div>

          {currencyId === "UYU" && (
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.fx")}</div>
              <div className="row" style={{ gap: 6, alignItems: "center" }}>
                <input
                  className="input"
                  type="number"
                  step="0.001"
                  value={Number.isFinite(usdUyuRate) ? usdUyuRate.toFixed(2) : ""}
                  onChange={(e) => setUsdUyuRate(Number(e.target.value))}
                  style={{ width: 120 }}
                  disabled={createMonthClosed}
                />
                <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  ≈ {usd0.format(amount / (usdUyuRate || 1))} USD
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.month")}</div>
            <input className="input" type="month" value={ymCreate} onChange={(e) => setYmCreate(e.target.value)} />
          </div>

          <button className="btn primary" type="submit" disabled={createMonthClosed}>
            {t("expenses.add")}
          </button>
        </form>

        {createMonthClosed && (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            {t("expenses.monthClosedAdd")}
          </div>
        )}
      </div>

      {/* Fixed Expenses (real) */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 850 }}>{t("expenses.fixedExpensesReal")}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t("expenses.inlineEditAutosave")}</div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t("expenses.itemsCount", { count: expensesFixed.length })}</div>
        </div>

        <RealExpensesTable
          expenses={expensesFixed}
          categories={categories}
          isMobile={isMobile}
          isMonthClosed={isClosed}
          getDraft={getDraft}
          setDraft={setDraft}
          clearDraft={clearDraft}
          patchExpense={patchExpense}
          removeExpense={removeExpense}
          fallbackMonth={month}
        />
      </div>

      {/* Variable Expenses (real) */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 850 }}>{t("expenses.variableExpensesReal")}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t("expenses.inlineEditAutosave")}</div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{t("expenses.itemsCount", { count: expensesVariable.length })}</div>
        </div>

        <RealExpensesTable
          expenses={expensesVariable}
          categories={categories}
          isMobile={isMobile}
          isMonthClosed={isClosed}
          getDraft={getDraft}
          setDraft={setDraft}
          clearDraft={clearDraft}
          patchExpense={patchExpense}
          removeExpense={removeExpense}
          fallbackMonth={month}
        />
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {t("expenses.monthStoredNote")}
        </div>
      </div>

      <div className="card" ref={draftsRef}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("expenses.draftsSectionTitle")}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {t("expenses.draftsSectionSubtitle")}
            </div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <Badge>{canEditThisMonth ? t("expenses.editable") : t("expenses.lockedMonthClosed")}</Badge>
            <button
              className="btn"
              type="button"
              onClick={confirmAllPlanned}
              disabled={!canEditThisMonth || planned.length === 0 || loading}
              style={{ height: 34 }}
              title={!canEditThisMonth ? t("expenses.monthClosed") : planned.length === 0 ? t("expenses.noDraftsToConfirm") : t("expenses.confirmAllDrafts")}
            >
              {loading ? t("expenses.confirming") : `${t("expenses.confirmAll")} (${planned.length})`}
            </button>
          </div>
        </div>

        {onboardingActive && (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "rgba(15,23,42,0.03)",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 4 }}>{t("expenses.onboardingTip")}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              <Trans i18nKey="expenses.reviewDraftsTip" components={{ 1: <b /> }} />
            </div>
          </div>
        )}

        {isMobile ? (
          <div className="expenses-drafts-mobile-list" style={{ marginTop: 12 }}>
            {plannedSorted.map((p) => {
              const d = getPlannedDraft(p.id);
              const currentCategoryId = d.categoryId ?? p.categoryId;
              const enforcedType = categoryTypeOf(currentCategoryId) ?? (d.expenseType ?? p.expenseType);
              const { isUyu, rate, amountUsd, displayValue } = getPlannedDisplayState(p, d);
              const locked = isClosed(month);
              const ymDisplay = `${p.year}-${String(p.month).padStart(2, "0")}`;

              return (
                <div key={p.id} className="expenses-draft-mobile-card" style={locked ? { opacity: 0.85 } : undefined}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{getTemplateDescriptionDisplay({ description: d.description ?? p.description, expenseType: enforcedType }, t)}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{ymDisplay}</div>
                    </div>
                    <Badge>{getExpenseTypeLabel(enforcedType, t)}</Badge>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.category")}</div>
                      <select
                        className="select"
                        value={currentCategoryId}
                        disabled={locked}
                        onChange={(e) => {
                          if (locked) return;
                          const newCat = e.target.value;
                          const newType = categoryTypeOf(newCat) ?? enforcedType;
                          setPlannedDraft(p.id, { categoryId: newCat, expenseType: newType });
                          patchPlanned(p.id, { categoryId: newCat, expenseType: newType }).then(() => clearPlannedDraft(p.id));
                        }}
                      >
                        {categories
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {getCategoryDisplayName(c, t)} ({getExpenseTypeLabel(c.expenseType, t)})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.description")}</div>
                      <input
                        className="input"
                        value={getTemplateDescriptionDisplay(
                          { description: d.description ?? p.description, expenseType: enforcedType },
                          t
                        )}
                        disabled={locked}
                        onChange={(e) => setPlannedDraft(p.id, { description: e.target.value })}
                        onBlur={(e) => {
                          if (locked) return;
                          const v = e.target.value.trim();
                          if (!v) return;
                          const canonical = p.description;
                          const translatedCanonical = getTemplateDescriptionDisplay(
                            { description: canonical, expenseType: enforcedType },
                            t
                          );
                          const toSend = v === translatedCanonical ? canonical : v;
                          patchPlanned(p.id, { description: toSend }).then(() => clearPlannedDraft(p.id));
                        }}
                      />
                    </div>

                    <div className="row" style={{ alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.amount")}</div>
                        <input
                          className="input"
                          type="number"
                          value={displayValue}
                          disabled={locked}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            const usd = isUyu ? (Number.isFinite(rate) && rate > 0 ? raw / rate : raw) : raw;
                            setPlannedDraft(p.id, { amountUsd: usd });
                          }}
                        onBlur={(e) => {
                          if (locked) return;
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          const nextAmountUsd = isUyu && Number.isFinite(rate) && rate > 0 ? raw / rate : raw;
                          if (!Number.isFinite(nextAmountUsd)) return;
                          const payload = isUyu && Number.isFinite(rate) && rate > 0
                            ? {
                                amount: Math.round(nextAmountUsd * rate),
                                amountUsd: Math.round(nextAmountUsd * 100) / 100,
                                usdUyuRate: rate,
                              }
                            : { amountUsd: Math.round(nextAmountUsd * 100) / 100 };
                          patchPlanned(p.id, payload).then(() => clearPlannedDraft(p.id));
                        }}
                      />
                      </div>
                      <div style={{ minWidth: 88 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.curr")}</div>
                        <div style={{ fontWeight: 700, minHeight: 44, display: "flex", alignItems: "center" }}>{isUyu ? "UYU" : "USD"}</div>
                      </div>
                    </div>

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {isUyu ? `${t("expenses.fx")}: ${Number(rate).toFixed(2)}` : "USD"}
                      </span>
                      <strong>{usd0.format(amountUsd)} USD</strong>
                    </div>

                    <button
                      className="btn primary"
                      type="button"
                      disabled={locked}
                      onClick={() => confirmPlanned(p)}
                      title={locked ? t("expenses.monthClosed") : t("expenses.confirmAndCreateReal")}
                    >
                      {t("expenses.confirmDraft")}
                    </button>
                  </div>
                </div>
              );
            })}

            {planned.length === 0 && (
              <div className="muted" style={{ padding: "8px 0" }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{t("expenses.noDrafts")}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {t("expenses.draftsFromTemplates")}
                </div>
              </div>
            )}
          </div>
        ) : (
        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>{t("expenses.month")}</th>
                <th style={{ width: 110 }}>{t("expenses.type")}</th>
                <th style={{ width: 220 }}>{t("expenses.category")}</th>
                <th>{t("expenses.description")}</th>
                <th style={{ width: 90 }}>{t("expenses.curr")}</th>
                <th className="right" style={{ width: 110 }}>{t("expenses.amount")}</th>
                <th style={{ width: 100 }}>{t("expenses.fx")}</th>
                <th className="right" style={{ width: 100 }}>{t("expenses.usd")}</th>
                <th style={{ width: 220 }}>{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {plannedSorted.map((p) => {
                const d = getPlannedDraft(p.id);
                const currentCategoryId = d.categoryId ?? p.categoryId;
                const enforcedType = categoryTypeOf(currentCategoryId) ?? (d.expenseType ?? p.expenseType);
                const { isUyu, rate, amountUsd, displayValue } = getPlannedDisplayState(p, d);
                const locked = isClosed(month);
                const ymDisplay = `${p.year}-${String(p.month).padStart(2, "0")}`;

                return (
                  <tr key={p.id} style={locked ? { opacity: 0.85 } : undefined}>
                    <td>
                      <span className="muted" style={{ fontSize: 13 }}>{ymDisplay}</span>
                    </td>

                    <td>
                      <Badge>{getExpenseTypeLabel(enforcedType, t)}</Badge>
                    </td>

                    <td>
                      <select
                        className="select"
                        value={currentCategoryId}
                        disabled={locked}
                        onChange={(e) => {
                          if (locked) return;
                          const newCat = e.target.value;
                          const newType = categoryTypeOf(newCat) ?? enforcedType;

                          setPlannedDraft(p.id, { categoryId: newCat, expenseType: newType });

                          patchPlanned(p.id, { categoryId: newCat, expenseType: newType }).then(() => clearPlannedDraft(p.id));
                        }}
                      >
                        {categories
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {getCategoryDisplayName(c, t)} ({getExpenseTypeLabel(c.expenseType, t)})
                            </option>
                          ))}
                      </select>
                    </td>

                    <td>
                      <input
                        className="input"
                        value={getTemplateDescriptionDisplay(
                          { description: d.description ?? p.description, expenseType: enforcedType },
                          t
                        )}
                        disabled={locked}
                        onChange={(e) => setPlannedDraft(p.id, { description: e.target.value })}
                        onBlur={(e) => {
                          if (locked) return;
                          const v = e.target.value.trim();
                          if (!v) return;
                          const canonical = p.description;
                          const translatedCanonical = getTemplateDescriptionDisplay(
                            { description: canonical, expenseType: enforcedType },
                            t
                          );
                          const toSend = v === translatedCanonical ? canonical : v;
                          patchPlanned(p.id, { description: toSend }).then(() => clearPlannedDraft(p.id));
                        }}
                      />
                    </td>

                    <td>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{isUyu ? "UYU" : "USD"}</span>
                    </td>

                    <td className="right">
                      <input
                        className="input"
                        type="number"
                        value={displayValue}
                        disabled={locked}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const usd = isUyu ? (Number.isFinite(rate) && rate > 0 ? raw / rate : raw) : raw;
                          setPlannedDraft(p.id, { amountUsd: usd });
                        }}
                        onBlur={(e) => {
                          if (locked) return;
                          const raw = Number(e.target.value);
                          if (!Number.isFinite(raw)) return;
                          const nextAmountUsd = isUyu && Number.isFinite(rate) && rate > 0 ? raw / rate : raw;
                          if (!Number.isFinite(nextAmountUsd)) return;
                          const payload = isUyu && Number.isFinite(rate) && rate > 0
                            ? {
                                amount: Math.round(nextAmountUsd * rate),
                                amountUsd: Math.round(nextAmountUsd * 100) / 100,
                                usdUyuRate: rate,
                              }
                            : { amountUsd: Math.round(nextAmountUsd * 100) / 100 };
                          patchPlanned(p.id, payload).then(() => clearPlannedDraft(p.id));
                        }}
                        style={{ width: 100, textAlign: "right" }}
                      />
                    </td>

                    <td>
                      {isUyu ? (
                        <span className="muted" style={{ fontSize: 12 }}>{Number(rate).toFixed(2)}</span>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>

                    <td className="right">
                      <span className="muted" style={{ whiteSpace: "nowrap" }}>{usd0.format(amountUsd)} USD</span>
                    </td>

                    <td className="right">
                      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                        <button
                          className="btn primary"
                          type="button"
                          disabled={locked}
                          onClick={() => confirmPlanned(p)}
                          title={locked ? t("expenses.monthClosed") : t("expenses.confirmAndCreateReal")}
                          style={{ height: 34 }}
                        >
                          {t("expenses.confirmDraft")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {planned.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">
                    <div style={{ padding: "8px 0" }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{t("expenses.noDrafts")}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {t("expenses.draftsFromTemplates")}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {t("expenses.confirmCreatesRealNote")}
        </div>

        {onboardingActive && (
          <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={confirmAllPlanned} disabled={!canEditThisMonth || planned.length === 0 || loading}>
              {loading ? t("expenses.confirming") : t("expenses.confirmAllDrafts")}
            </button>
            <button className="btn primary" type="button" onClick={markStep2Done}>
              {t("expenses.doneNextInvestments")}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .table th, .table td { vertical-align: middle; }
        .expenses-summary-mobile-list,
        .expenses-drafts-mobile-list {
          display: grid;
          gap: 10px;
        }
        .expenses-summary-mobile-item,
        .expenses-draft-mobile-card,
        .expenses-real-mobile-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px;
          background: rgba(248, 250, 252, 0.78);
        }
        .expenses-summary-mobile-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        @media (max-width: 900px) {
          .expenses-form-mobile input,
          .expenses-form-mobile select { width: 100%; max-width: 100%; box-sizing: border-box; }
          .expenses-form-mobile .row { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

/* =========================================================
   Real expenses table (reused by Fixed + Variable cards)
========================================================= */

function RealExpensesTable(props: {
  expenses: Expense[];
  categories: Category[];
  isMobile: boolean;
  isMonthClosed: (m: number) => boolean;
  getDraft: (id: string) => Draft;
  setDraft: (id: string, patch: Draft) => void;
  clearDraft: (id: string) => void;
  patchExpense: (expenseId: string, expenseMonth: number, patch: any) => Promise<void>;
  removeExpense: (expenseId: string, expenseMonth: number) => Promise<void>;
  fallbackMonth: number;
}) {
  const { t } = useTranslation();
  const { expenses, categories, isMobile, isMonthClosed, getDraft, setDraft, clearDraft, patchExpense, removeExpense, fallbackMonth } =
    props;

  const categoriesSorted = useMemo(() => categories.slice().sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  if (isMobile) {
    return (
      <div className="expenses-real-mobile-list" style={{ display: "grid", gap: 10 }}>
        {expenses.map((e) => {
          const d = getDraft(e.id);
          const currentCurrency = (d.currencyId ?? (e.currencyId as any)) as "UYU" | "USD";
          const currentAmount = d.amount ?? e.amount;
          const currentRate =
            currentCurrency === "UYU"
              ? (d.usdUyuRate ?? (e.usdUyuRate ?? getFxDefault()))
              : (d.usdUyuRate ?? getFxDefault());
          const ymValue = d.ym ?? e.date.slice(0, 7);
          const usdPreview = currentCurrency === "USD" ? currentAmount : currentAmount / (currentRate || 1);
          const parsed = isoToYm(e.date);
          const expMonth = parsed?.month ?? fallbackMonth;
          const locked = isMonthClosed(expMonth);

          return (
            <div key={e.id} className="expenses-real-mobile-card" style={locked ? { opacity: 0.85 } : undefined}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{getTemplateDescriptionDisplay({ description: d.description ?? e.description, expenseType: e.expenseType }, t)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{ymValue}</div>
                </div>
                <Badge>{getExpenseTypeLabel(e.expenseType, t)}</Badge>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.category")}</div>
                  <select
                    className="select"
                    value={d.categoryId ?? e.categoryId}
                    disabled={locked}
                    onChange={(ev) => {
                      if (locked) return;
                      const v = ev.target.value;
                      const cat = categories.find((c) => c.id === v);
                      const enforcedType = cat?.expenseType ?? e.expenseType;

                      setDraft(e.id, { categoryId: v });
                      patchExpense(e.id, expMonth, { categoryId: v, expenseType: enforcedType }).then(() => clearDraft(e.id));
                    }}
                  >
                    {categoriesSorted.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getCategoryDisplayName(c, t)} ({getExpenseTypeLabel(c.expenseType, t)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.description")}</div>
                  <input
                    className="input"
                    value={getTemplateDescriptionDisplay(
                      { description: d.description ?? e.description, expenseType: e.expenseType },
                      t
                    )}
                    disabled={locked}
                    onChange={(ev) => setDraft(e.id, { description: ev.target.value })}
                    onBlur={(ev) => {
                      if (locked) return;
                      const v = ev.target.value.trim();
                      if (!v) return;
                      const canonical = e.description;
                      const translatedCanonical = getTemplateDescriptionDisplay(
                        { description: canonical, expenseType: e.expenseType },
                        t
                      );
                      const toSend = v === translatedCanonical ? canonical : v;
                      patchExpense(e.id, expMonth, { description: toSend }).then(() => clearDraft(e.id));
                    }}
                  />
                </div>

                <div className="row" style={{ alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.amount")}</div>
                    <input
                      className="input"
                      type="number"
                      value={Number.isFinite(currentAmount) ? currentAmount : 0}
                      disabled={locked}
                      onChange={(ev) => setDraft(e.id, { amount: Number(ev.target.value) })}
                      onBlur={() => {
                        if (locked) return;
                        if (!Number.isFinite(currentAmount) || currentAmount === 0) return;
                        patchExpense(e.id, expMonth, { amount: Number(currentAmount) }).then(() => clearDraft(e.id));
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 88 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.curr")}</div>
                    <select
                      className="select"
                      value={currentCurrency}
                      disabled={locked}
                      onChange={(ev) => {
                        if (locked) return;
                        const v = ev.target.value as "UYU" | "USD";
                        setDraft(e.id, { currencyId: v });

                        if (v === "UYU") {
                          const rate = getFxDefault();
                          setDraft(e.id, { currencyId: v, usdUyuRate: rate });
                          patchExpense(e.id, expMonth, { currencyId: v, usdUyuRate: rate }).then(() => clearDraft(e.id));
                        } else {
                          patchExpense(e.id, expMonth, { currencyId: v, usdUyuRate: undefined }).then(() => clearDraft(e.id));
                        }
                      }}
                    >
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                {currentCurrency === "UYU" && (
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.fx")}</div>
                    <input
                      className="input"
                      type="number"
                      step="0.001"
                      value={Number.isFinite(currentRate) ? Number(currentRate).toFixed(2) : ""}
                      disabled={locked}
                      onChange={(ev) => setDraft(e.id, { usdUyuRate: Number(ev.target.value) })}
                      onBlur={() => {
                        if (locked) return;
                        if (!Number.isFinite(currentRate) || currentRate <= 0) return;
                        setFxDefault(Number(currentRate));
                        patchExpense(e.id, expMonth, { usdUyuRate: Number(currentRate) }).then(() => clearDraft(e.id));
                      }}
                    />
                  </div>
                )}

                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {currentCurrency === "UYU" ? `≈ ${usd0.format(usdPreview)} USD` : `${usd0.format(currentAmount)} USD`}
                  </span>
                  <button
                    className="btn danger"
                    type="button"
                    disabled={locked}
                    onClick={() => removeExpense(e.id, expMonth)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {expenses.length === 0 && (
          <div className="muted" style={{ padding: "12px 0" }}>
            {t("expenses.noExpensesInList")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>{t("expenses.month")}</th>
            <th style={{ width: 110 }}>{t("expenses.type")}</th>
            <th style={{ width: 220 }}>{t("expenses.category")}</th>
            <th>{t("expenses.description")}</th>
            <th style={{ width: 90 }}>{t("expenses.curr")}</th>
            <th className="right" style={{ width: 110 }}>{t("expenses.amount")}</th>
            <th style={{ width: 100 }}>{t("expenses.fx")}</th>
            <th className="right" style={{ width: 100 }}>{t("expenses.usd")}</th>
            <th style={{ width: 110 }} />
          </tr>
        </thead>

        <tbody>
          {expenses.map((e) => {
            const d = getDraft(e.id);
            const currentCurrency = (d.currencyId ?? (e.currencyId as any)) as "UYU" | "USD";
            const currentAmount = d.amount ?? e.amount;

            const currentRate =
              currentCurrency === "UYU"
                ? (d.usdUyuRate ?? (e.usdUyuRate ?? getFxDefault()))
                : (d.usdUyuRate ?? getFxDefault());

            const ymValue = d.ym ?? e.date.slice(0, 7);
            const usdPreview = currentCurrency === "USD" ? currentAmount : currentAmount / (currentRate || 1);

            const parsed = isoToYm(e.date);
            const expMonth = parsed?.month ?? fallbackMonth;
            const locked = isMonthClosed(expMonth);

            return (
              <tr key={e.id} style={locked ? { opacity: 0.85 } : undefined}>
                <td>
                  <input
                    className="input"
                    type="month"
                    value={ymValue}
                    disabled={locked}
                    onChange={(ev) => setDraft(e.id, { ym: ev.target.value })}
                    onBlur={() => {
                      if (locked) return;
                      const ok = inputValueToYm(ymValue);
                      if (!ok) return;
                      patchExpense(e.id, expMonth, { date: ymValue }).then(() => clearDraft(e.id));
                    }}
                    style={{ width: 130 }}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  />
                </td>

                <td>
                  <Badge>{getExpenseTypeLabel(e.expenseType, t)}</Badge>
                </td>

                <td>
                  <select
                    className="select"
                    value={d.categoryId ?? e.categoryId}
                    disabled={locked}
                    onChange={(ev) => {
                      if (locked) return;
                      const v = ev.target.value;
                      const cat = categories.find((c) => c.id === v);
                      const enforcedType = cat?.expenseType ?? e.expenseType;

                      setDraft(e.id, { categoryId: v });
                      patchExpense(e.id, expMonth, { categoryId: v, expenseType: enforcedType }).then(() => clearDraft(e.id));
                    }}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  >
                    {categoriesSorted.map((c) => (
                      <option key={c.id} value={c.id}>
                        {getCategoryDisplayName(c, t)} ({getExpenseTypeLabel(c.expenseType, t)})
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <input
                    className="input"
                    value={getTemplateDescriptionDisplay(
                      { description: d.description ?? e.description, expenseType: e.expenseType },
                      t
                    )}
                    disabled={locked}
                    onChange={(ev) => setDraft(e.id, { description: ev.target.value })}
                    onBlur={(ev) => {
                      if (locked) return;
                      const v = ev.target.value.trim();
                      if (!v) return;
                      const canonical = e.description;
                      const translatedCanonical = getTemplateDescriptionDisplay(
                        { description: canonical, expenseType: e.expenseType },
                        t
                      );
                      const toSend = v === translatedCanonical ? canonical : v;
                      patchExpense(e.id, expMonth, { description: toSend }).then(() => clearDraft(e.id));
                    }}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  />
                </td>

                <td>
                  <select
                    className="select"
                    value={currentCurrency}
                    disabled={locked}
                    onChange={(ev) => {
                      if (locked) return;
                      const v = ev.target.value as "UYU" | "USD";
                      setDraft(e.id, { currencyId: v });

                      if (v === "UYU") {
                        const rate = getFxDefault();
                        setDraft(e.id, { currencyId: v, usdUyuRate: rate });
                        patchExpense(e.id, expMonth, { currencyId: v, usdUyuRate: rate }).then(() => clearDraft(e.id));
                      } else {
                        patchExpense(e.id, expMonth, { currencyId: v, usdUyuRate: undefined }).then(() => clearDraft(e.id));
                      }
                    }}
                    style={{ width: 82, fontSize: 11 }}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  >
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                </td>

                <td className="right">
                  <input
                    className="input"
                    type="number"
                    value={Number.isFinite(currentAmount) ? currentAmount : 0}
                    disabled={locked}
                    onChange={(ev) => setDraft(e.id, { amount: Number(ev.target.value) })}
                    onBlur={() => {
                      if (locked) return;
                      if (!Number.isFinite(currentAmount) || currentAmount === 0) return;
                      patchExpense(e.id, expMonth, { amount: Number(currentAmount) }).then(() => clearDraft(e.id));
                    }}
                    style={{ width: 100, textAlign: "right" }}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  />
                </td>

                <td>
                  {currentCurrency === "UYU" ? (
                    <input
                      className="input"
                      type="number"
                      step="0.001"
                      value={Number.isFinite(currentRate) ? Number(currentRate).toFixed(2) : ""}
                      disabled={locked}
                      onChange={(ev) => setDraft(e.id, { usdUyuRate: Number(ev.target.value) })}
                      onBlur={() => {
                        if (locked) return;
                        if (!Number.isFinite(currentRate) || currentRate <= 0) return;
                        setFxDefault(Number(currentRate));
                        patchExpense(e.id, expMonth, { usdUyuRate: Number(currentRate) }).then(() => clearDraft(e.id));
                      }}
                      style={{ width: 90 }}
                      title={locked ? t("expenses.monthClosed") : t("expenses.fxUsdUyu")}
                    />
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </td>

                <td className="right">
                  <span className="muted" style={{ whiteSpace: "nowrap" }}>
                    {currentCurrency === "UYU" ? `≈ ${usd0.format(usdPreview)}` : usd0.format(currentAmount)} USD
                  </span>
                </td>

                <td className="right">
                  <button
                    className="btn danger"
                    type="button"
                    disabled={locked}
                    onClick={() => removeExpense(e.id, expMonth)}
                    title={locked ? t("expenses.monthClosed") : undefined}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            );
          })}

          {expenses.length === 0 && (
            <tr>
              <td colSpan={9} className="muted" style={{ padding: "12px 10px" }}>
                {t("expenses.noExpensesInList")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
