import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth, useDisplayCurrency } from "../layout/AppShell";
import { getFxDefault } from "../utils/fx";
import { formatAmountUsdWith } from "../utils/formatCurrency";

type IncomeRow = {
  month: number;
  nominalUsd: number;
  extraordinaryUsd: number;
  taxesUsd: number;
  totalUsd: number;
};

type IncomeResp = {
  year: number;
  rows: IncomeRow[];
  closedMonths?: number[];
};

const months12 = Array.from({ length: 12 }, (_, i) => i + 1);

function sanitizeNumber(raw: string) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type DraftKey = "nominal" | "extraordinary" | "taxes";
type DraftCell = Partial<Record<DraftKey, string>>;
type DraftMap = Record<number, DraftCell>;

const fieldToDraftKey: Record<"nominalUsd" | "extraordinaryUsd" | "taxesUsd", DraftKey> = {
  nominalUsd: "nominal",
  extraordinaryUsd: "extraordinary",
  taxesUsd: "taxes",
};

export default function IncomePage() {
  const { t } = useTranslation();
  const { setHeader, serverFxRate } = useAppShell();
  const { preferredDisplayCurrencyId } = useDisplayCurrency();
  const { year } = useAppYearMonth();

  const [data, setData] = useState<IncomeResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [incomeCurrency, setIncomeCurrency] = useState<"UYU" | "USD">(() => preferredDisplayCurrencyId);
  const [incomeRate, setIncomeRate] = useState<number>(() => getFxDefault());

  useEffect(() => {
    if (serverFxRate != null) setIncomeRate(serverFxRate);
  }, [serverFxRate]);

  const incomeRateOrNull = incomeCurrency === "UYU" && Number.isFinite(incomeRate) && incomeRate > 0 ? incomeRate : null;

  useEffect(() => {
    setHeader({
      title: t("income.title"),
      subtitle: (
        <>
          {t("income.subtitlePrefix")} (
          <span style={{ color: "var(--brand-green)" }}>{incomeCurrency}</span>)
        </>
      ),
    });
  }, [setHeader, t, incomeCurrency]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api<IncomeResp>(`/income?year=${year}`);
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
  }, [year]);

  const byMonth = useMemo(() => {
    const map = new Map<number, IncomeRow>();
    for (const m of months12) {
      map.set(m, {
        month: m,
        nominalUsd: 0,
        extraordinaryUsd: 0,
        taxesUsd: 0,
        totalUsd: 0,
      });
    }
    for (const r of data?.rows ?? []) {
      map.set(r.month, r);
    }
    return map;
  }, [data]);

  const closedSet = useMemo(() => new Set(data?.closedMonths ?? []), [data?.closedMonths]);

  const totals = useMemo(() => {
    let nominal = 0,
      extraordinary = 0,
      taxes = 0,
      total = 0;
    for (const m of months12) {
      const row = byMonth.get(m)!;
      nominal += row.nominalUsd;
      extraordinary += row.extraordinaryUsd;
      taxes += row.taxesUsd;
      total += row.totalUsd;
    }
    return { nominal, extraordinary, taxes, total };
  }, [byMonth]);

  function setDraft(month: number, patch: DraftCell) {
    setDrafts((prev) => ({ ...prev, [month]: { ...(prev[month] ?? {}), ...patch } }));
  }

  function toDisplay(usd: number): number {
    if (incomeCurrency === "USD") return usd;
    const r = incomeRate && Number.isFinite(incomeRate) ? incomeRate : 1;
    return usd * r;
  }
  function toUsd(displayed: number): number {
    if (incomeCurrency === "USD") return displayed;
    const r = incomeRate && Number.isFinite(incomeRate) && incomeRate > 0 ? incomeRate : 1;
    return displayed / r;
  }

  async function saveCell(month: number, field: "nominalUsd" | "extraordinaryUsd" | "taxesUsd", value: number) {
    const row = byMonth.get(month);
    if (!row) return;
    try {
      await api("/income", {
        method: "PATCH",
        body: JSON.stringify({
          year,
          month,
          [field]: value,
          ...(field !== "nominalUsd" ? { nominalUsd: row.nominalUsd } : {}),
          ...(field !== "extraordinaryUsd" ? { extraordinaryUsd: row.extraordinaryUsd } : {}),
          ...(field !== "taxesUsd" ? { taxesUsd: row.taxesUsd } : {}),
        }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    }
  }

  function renderCell(
    month: number,
    field: "nominalUsd" | "extraordinaryUsd" | "taxesUsd",
    valueUsd: number,
    allowNegative: boolean
  ) {
    const isClosed = closedSet.has(month);
    const displayVal = toDisplay(valueUsd);
    if (isClosed) {
      return (
        <span key={`${month}-${field}`} className="muted" title={t("common.closed")} style={{ display: "inline-block", minWidth: 96, textAlign: "right", whiteSpace: "nowrap" }}>
          {formatAmountUsdWith(valueUsd, incomeCurrency, incomeRateOrNull)}
        </span>
      );
    }
    const draftKey = fieldToDraftKey[field];
    const draft = drafts[month]?.[draftKey];
    const raw = draft ?? String(Math.round(displayVal));
    return (
      <input
        key={`${month}-${field}`}
        className="input compact"
        type="text"
        value={raw}
        style={{ minWidth: 96, width: 96, textAlign: "right" }}
        onChange={(e) => setDraft(month, { [draftKey]: e.target.value })}
        onBlur={async () => {
          const n = sanitizeNumber(raw);
          if (n === null) return;
          if (!allowNegative && n < 0) return;
          const usdToSave = toUsd(n);
          await saveCell(month, field, usdToSave);
          setDrafts((prev) => {
            const next = { ...prev };
            if (next[month]) {
              const c = { ...next[month] };
              delete c[draftKey];
              next[month] = c;
              if (Object.keys(c).length === 0) delete next[month];
            }
            return next;
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{t("income.title")}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("income.intro")}</div>
          </div>
          <div className="row" style={{ alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 12 }}>{t("income.currencyLabel")}</span>
            <select
              className="select"
              value={incomeCurrency}
              onChange={(e) => setIncomeCurrency(e.target.value as "UYU" | "USD")}
              style={{ width: 72, minWidth: 72, height: 36, fontSize: 11 }}
              aria-label={t("income.currencyLabel")}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
            {incomeCurrency === "UYU" && (
              <>
                <span className="muted" style={{ fontSize: 11 }}>{t("income.rateLabel")}</span>
                <input
                  type="number"
                  className="input"
                  value={Number.isFinite(incomeRate) ? incomeRate.toFixed(2) : ""}
                  onChange={(e) => setIncomeRate(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                  style={{ width: 80, height: 36, fontSize: 11 }}
                />
              </>
            )}
            <button type="button" className="btn" onClick={load} disabled={loading}>
              {loading ? t("common.loading") : t("common.refresh")}
            </button>
          </div>
        </div>

        {error && <div style={{ marginTop: 12, color: "var(--danger)" }}>{error}</div>}

        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className="table compact" aria-label="Ingresos por mes">
            <thead>
              <tr>
                <th style={{ width: 200 }}></th>
                {months12.map((m) => (
                  <th key={m} className="right" style={{ minWidth: 96 }}>
                    {String(m).padStart(2, "0")}
                  </th>
                ))}
                <th className="right" style={{ width: 100 }}>{t("budgets.total")}</th>
              </tr>
            </thead>
            <tbody>
              {/* Ingresos nominales */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("income.nominal")}</td>
                {months12.map((m) => (
                  <td key={`nom-${m}`} className="right" style={{ whiteSpace: "nowrap" }}>
                    {renderCell(m, "nominalUsd", byMonth.get(m)!.nominalUsd, false)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{formatAmountUsdWith(totals.nominal, incomeCurrency, incomeRateOrNull)}</td>
              </tr>
              {/* Ingresos extraordinarios */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("income.extraordinary")}</td>
                {months12.map((m) => (
                  <td key={`ext-${m}`} className="right" style={{ whiteSpace: "nowrap" }}>
                    {renderCell(m, "extraordinaryUsd", byMonth.get(m)!.extraordinaryUsd, true)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{formatAmountUsdWith(totals.extraordinary, incomeCurrency, incomeRateOrNull)}</td>
              </tr>
              {/* Taxes */}
              <tr>
                <td style={{ fontWeight: 750 }}>{t("income.taxes")}</td>
                {months12.map((m) => (
                  <td key={`tax-${m}`} className="right" style={{ whiteSpace: "nowrap" }}>
                    {renderCell(m, "taxesUsd", byMonth.get(m)!.taxesUsd, true)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{formatAmountUsdWith(totals.taxes, incomeCurrency, incomeRateOrNull)}</td>
              </tr>
              {/* Ingresos totales (read-only) */}
              <tr>
                <td style={{ fontWeight: 900 }}>{t("income.total")}</td>
                {months12.map((m) => (
                  <td key={`tot-${m}`} className="right" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                    {formatAmountUsdWith(byMonth.get(m)!.totalUsd, incomeCurrency, incomeRateOrNull)}
                  </td>
                ))}
                <td className="right" style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{formatAmountUsdWith(totals.total, incomeCurrency, incomeRateOrNull)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>{t("income.budgetNote")}</div>
      </div>
    </div>
  );
}
