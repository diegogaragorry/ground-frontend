import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useDisplayCurrency } from "../layout/AppShell";

type SnapshotMonth = {
  month: number;
  closingCapital: number | null;
  closingCapitalUsd: number | null;
  usdUyuRate?: number | null;
  isClosed: boolean;
};

type Investment = {
  id: string;
  name: string;
  currencyId: "USD" | "UYU";
};

type SnapshotsResponse = {
  investment: Investment;
  year: number;
  months: SnapshotMonth[];
};

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function InvestmentSnapshotsPanel({ investment }: { investment: Investment }) {
  const { t } = useTranslation();
  const { formatAmountUsd } = useDisplayCurrency();
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [data, setData] = useState<SnapshotsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api<SnapshotsResponse>(
        `/investments/${investment.id}/snapshots?year=${year}`
      );
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [investment.id, year]);

  async function saveMonth(
    month: number,
    closingCapital: number,
    usdUyuRate?: number
  ) {
    await api(`/investments/${investment.id}/snapshots/${year}/${month}`, {
      method: "PUT",
      body: JSON.stringify({ closingCapital, usdUyuRate }),
    });
    load();
  }

  async function closeMonth(month: number) {
    await api(
      `/investments/${investment.id}/snapshots/${year}/${month}/close`,
      { method: "POST" }
    );
    load();
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{t("investments.monthlySnapshots")}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {t("investments.capitalPerMonthLocked")}
          </div>
        </div>

        <input
          className="input"
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: 110 }}
        />
      </div>

      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      {loading && <div className="muted">{t("common.loading")}</div>}

      {data && (
        <table className="table">
          <thead>
            <tr>
              <th>{t("investments.monthLabel")}</th>
              <th className="right">
                {t("investments.capitalWithCurrency", { currency: investment.currencyId })}
              </th>
              {investment.currencyId === "UYU" && (
                <th className="right">USD/UYU</th>
              )}
              <th className="right">{t("expenses.usd")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <SnapshotRow
                key={m.month}
                month={m}
                currencyId={investment.currencyId}
                onSave={saveMonth}
                onClose={closeMonth}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Row ---------------- */

function SnapshotRow({
  month,
  currencyId,
  onSave,
  onClose,
}: {
  month: SnapshotMonth;
  currencyId: "USD" | "UYU";
  onSave: (m: number, c: number, r?: number) => void;
  onClose: (m: number) => void;
}) {
  const { t } = useTranslation();
  const [capital, setCapital] = useState<number | "">(month.closingCapital ?? "");
  const [rate, setRate] = useState<number | "">(month.usdUyuRate ?? "");

  const disabled = month.isClosed;

  return (
    <tr style={{ opacity: disabled ? 0.6 : 1 }}>
      <td>{String(month.month).padStart(2, "0")}</td>

      <td className="right">
        <input
          className="input"
          type="number"
          disabled={disabled}
          value={capital}
          onChange={(e) => setCapital(Number(e.target.value))}
          style={{ textAlign: "right" }}
        />
      </td>

      {currencyId === "UYU" && (
        <td className="right">
          <input
            className="input"
            type="number"
            disabled={disabled}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{ textAlign: "right" }}
          />
        </td>
      )}

      <td className="right">
        {month.closingCapitalUsd == null
          ? "—"
          : formatAmountUsd(month.closingCapitalUsd)}
      </td>

      <td className="right">
        {!disabled ? (
          <>
            <button
              className="btn"
              onClick={() =>
                onSave(
                  month.month,
                  Number(capital),
                  currencyId === "UYU" ? Number(rate) : undefined
                )
              }
            >
              {t("common.save")}
            </button>
            <button
              className="btn primary"
              onClick={() => onClose(month.month)}
            >
              {t("admin.close")}
            </button>
          </>
        ) : (
          <span className="muted">{t("common.closed")}</span>
        )}
      </td>
    </tr>
  );
}