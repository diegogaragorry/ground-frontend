import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";
import { getCategoryDisplayName, getExpenseTypeLabel } from "../utils/categoryI18n";

type ExpenseType = "FIXED" | "VARIABLE";
type ReminderChannel = "NONE" | "EMAIL" | "SMS";
type ReminderSendMode = "ONCE" | "DAILY_UNTIL_PAID";

type Category = { id: string; name: string; expenseType: ExpenseType; nameKey?: string | null };
type MonthCloseRow = { year: number; month: number; isClosed?: boolean };
type MonthClosesResp = { year: number; rows: MonthCloseRow[] };

type PlannedExpense = {
  id: string;
  year: number;
  month: number;
  expenseType: ExpenseType;
  categoryId: string;
  description: string;
  isConfirmed?: boolean;
  reminderChannel?: ReminderChannel;
  reminderLabel?: string | null;
  dueDate?: string | null;
  remindAt?: string | null;
  remindDaysBefore?: number | null;
  reminderResolvedAt?: string | null;
  encryptedPayload?: string | null;
  category?: { id: string; name: string; nameKey?: string | null; expenseType?: ExpenseType | null };
};

type ExpensesPageData = {
  year: number;
  month: number;
  categories: Category[];
  planned: { rows: PlannedExpense[] };
  monthCloses: MonthClosesResp;
};

type ReminderDraft = {
  dueDate?: string;
  remindAt?: string;
};

function isEncryptedPlaceholder(value: unknown) {
  return typeof value === "string" && /^\(encrypted(?:-[a-z0-9]+)?\)$/i.test(value.trim());
}

function reminderDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function reminderChannelLabel(channel: ReminderChannel | null | undefined, t: (key: string, options?: any) => string) {
  if (channel === "EMAIL") return t("expenseReminders.channelEmail");
  if (channel === "SMS") return t("expenseReminders.channelSms");
  return t("expenseReminders.channelNone");
}

function formatShortDate(value: string | Date | null | undefined, language: string) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(language.startsWith("es") ? "es-UY" : "en-US", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function buildDateInput(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function defaultReminderDateInput(year: number, month: number) {
  const now = new Date();
  const sameMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const fallbackDay = sameMonth ? now.getDate() : 1;
  return buildDateInput(year, month, Math.min(fallbackDay, daysInMonth(year, month)));
}

export default function ExpenseRemindersPage() {
  const { t, i18n } = useTranslation();
  const { decryptPayload } = useEncryption();
  const { setHeader, showSuccess, me } = useAppShell();
  const { year, month } = useAppYearMonth();

  const [loading, setLoading] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [creatingReminder, setCreatingReminder] = useState(false);
  const [error, setError] = useState("");
  const [planned, setPlanned] = useState<PlannedExpense[]>([]);
  const [closedMonths, setClosedMonths] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, ReminderDraft>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reminderSendMode, setReminderSendMode] = useState<ReminderSendMode>(
    me?.expenseReminderSendMode === "DAILY_UNTIL_PAID" ? "DAILY_UNTIL_PAID" : "ONCE"
  );
  const [createPlannedId, setCreatePlannedId] = useState("");
  const [createReminderChannel, setCreateReminderChannel] = useState<ReminderChannel>("EMAIL");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createRemindAt, setCreateRemindAt] = useState("");

  useEffect(() => {
    setReminderSendMode(me?.expenseReminderSendMode === "DAILY_UNTIL_PAID" ? "DAILY_UNTIL_PAID" : "ONCE");
  }, [me?.expenseReminderSendMode]);

  useEffect(() => {
    setHeader({
      title: t("expenseReminders.title"),
      subtitle: t("expenseReminders.subtitle"),
    });
  }, [setHeader, t]);

  function isClosed(m: number) {
    return closedMonths.has(m);
  }

  function setDraft(id: string, patch: ReminderDraft) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  }

  function clearDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function resolvePlanned(rows: PlannedExpense[]) {
    return Promise.all(
      rows.map(async (row) => {
        if (!row.encryptedPayload) return row;
        const decrypted = await decryptPayload<{
          description?: string;
          reminderLabel?: string | null;
        }>(row.encryptedPayload);
        return {
          ...row,
          description:
            typeof decrypted?.description === "string" && decrypted.description.trim()
              ? decrypted.description
              : isEncryptedPlaceholder(row.description)
                ? "—"
                : row.description,
          reminderLabel:
            typeof decrypted?.reminderLabel === "string" && decrypted.reminderLabel.trim()
              ? decrypted.reminderLabel
              : row.reminderLabel ?? null,
        };
      })
    );
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const payload = await api<ExpensesPageData>(`/expenses/page-data?year=${year}&month=${month}`);
      const resolved = await resolvePlanned(payload.planned?.rows ?? []);
      setPlanned(resolved);
      setClosedMonths(new Set((payload.monthCloses?.rows ?? []).filter((row) => row.isClosed !== false).map((row) => row.month)));
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const activeReminderRows = useMemo(
    () =>
      planned.filter(
        (row) =>
          !row.isConfirmed &&
          row.reminderChannel &&
          row.reminderChannel !== "NONE" &&
          !!row.dueDate &&
          !row.reminderResolvedAt
      ),
    [planned]
  );

  const availableReminderDrafts = useMemo(
    () =>
      planned.filter(
        (row) =>
          !row.isConfirmed &&
          (!row.reminderChannel || row.reminderChannel === "NONE" || !row.dueDate || !!row.reminderResolvedAt)
      ),
    [planned]
  );

  useEffect(() => {
    const defaultDate = defaultReminderDateInput(year, month);
    const selectedStillAvailable = availableReminderDrafts.some((row) => row.id === createPlannedId);
    if (!selectedStillAvailable) {
      setCreatePlannedId(availableReminderDrafts[0]?.id ?? "");
      setCreateDueDate(defaultDate);
      setCreateRemindAt(defaultDate);
      return;
    }
    if (!createDueDate) setCreateDueDate(defaultDate);
    if (!createRemindAt) setCreateRemindAt(defaultDate);
  }, [availableReminderDrafts, createPlannedId, createDueDate, createRemindAt, year, month]);

  async function saveReminder(id: string, patch: Record<string, unknown>, successMessage?: string) {
    if (isClosed(month)) {
      setError(t("expenses.monthClosedEditDrafts"));
      return;
    }
    const row = planned.find((item) => item.id === id);
    if (!row) return;

    const reminderLabel =
      typeof row.description === "string" && row.description.trim() && row.description !== "—"
        ? row.description.trim()
        : String(row.reminderLabel ?? "").trim();

    setUpdatingId(id);
    setError("");
    try {
      await api(`/plannedExpenses/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...patch,
          ...(reminderLabel ? { reminderLabel } : {}),
        }),
      });
      clearDraft(id);
      await load();
      if (successMessage) showSuccess(successMessage);
    } catch (e: any) {
      setError(e?.message ?? t("common.error"));
    } finally {
      setUpdatingId((current) => (current === id ? null : current));
    }
  }

  async function createMonthlyReminder() {
    if (isClosed(month)) {
      setError(t("expenses.monthClosedEditDrafts"));
      return;
    }
    if (!createPlannedId) {
      setError(t("expenseReminders.selectDraftRequired"));
      return;
    }
    if (createReminderChannel === "NONE") {
      setError(t("expenseReminders.channelRequired"));
      return;
    }
    if (!createDueDate) {
      setError(t("expenseReminders.dueDateRequired"));
      return;
    }
    if (!createRemindAt) {
      setError(t("expenseReminders.notificationDateRequired"));
      return;
    }

    setCreatingReminder(true);
    setError("");
    try {
      await saveReminder(
        createPlannedId,
        {
          reminderChannel: createReminderChannel,
          dueDate: createDueDate,
          remindAt: createRemindAt,
        },
        t("expenseReminders.created")
      );
    } finally {
      setCreatingReminder(false);
    }
  }

  async function clearReminderForMonth(id: string) {
    await saveReminder(id, { clearReminder: true }, t("expenses.reminderRemoved"));
  }

  async function updateReminderMode(nextMode: ReminderSendMode) {
    setSavingMode(true);
    setError("");
    try {
      await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ expenseReminderSendMode: nextMode }),
      });
      setReminderSendMode(nextMode);
      showSuccess(t("expenseReminders.settingsSaved"));
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
    } finally {
      setSavingMode(false);
    }
  }

  const groupedByDueDate = useMemo(() => {
    const map = new Map<string, { dueDate: string; rows: PlannedExpense[] }>();
    for (const row of activeReminderRows) {
      const key = reminderDateInputValue(row.dueDate);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      map.set(key, { dueDate: key, rows: [row] });
    }
    return [...map.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [activeReminderRows]);

  const locked = isClosed(month);

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 850, marginBottom: 6, fontSize: 18 }}>{t("expenseReminders.addTitle")}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {t("expenseReminders.addSubtitle")}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t("expenseReminders.addNote", { month: `${year}-${String(month).padStart(2, "0")}` })}
            </div>
          </div>
          {locked && <span className="badge">{t("common.closed")}</span>}
        </div>

        {error && (
          <div style={{ color: "var(--danger)", marginTop: 12 }}>
            {error}
          </div>
        )}

        <div
          className="grid"
          style={{
            marginTop: 12,
            gridTemplateColumns: "minmax(240px, 1.7fr) minmax(120px, 0.8fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr) auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenseReminders.draft")}</div>
            <select
              className="select"
              value={createPlannedId}
              disabled={locked || creatingReminder || availableReminderDrafts.length === 0}
              onChange={(e) => setCreatePlannedId(e.target.value)}
            >
              {availableReminderDrafts.length === 0 ? (
                <option value="">{t("expenseReminders.noDraftsAvailable")}</option>
              ) : (
                availableReminderDrafts.map((row) => {
                  const categoryDisplay = row.category
                    ? getCategoryDisplayName(
                        {
                          name: row.category.name,
                          nameKey: row.category.nameKey ?? null,
                          expenseType: row.expenseType,
                        },
                        t
                      )
                    : "—";
                  const description = row.description?.trim() ? row.description : "—";
                  return (
                    <option key={row.id} value={row.id}>
                      {`${categoryDisplay} · ${description}`}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenses.reminder")}</div>
            <select
              className="select"
              value={createReminderChannel}
              disabled={locked || creatingReminder || availableReminderDrafts.length === 0}
              onChange={(e) => setCreateReminderChannel(e.target.value as ReminderChannel)}
            >
              <option value="EMAIL">{t("expenseReminders.channelEmail")}</option>
              <option value="SMS">{t("expenseReminders.channelSms")}</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenseReminders.dueDate")}</div>
            <input
              className="input"
              type="date"
              value={createDueDate}
              disabled={locked || creatingReminder || availableReminderDrafts.length === 0}
              onChange={(e) => {
                setCreateDueDate(e.target.value);
                if (!createRemindAt) setCreateRemindAt(e.target.value);
              }}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("expenseReminders.notificationDate")}</div>
            <input
              className="input"
              type="date"
              value={createRemindAt}
              disabled={locked || creatingReminder || availableReminderDrafts.length === 0}
              onChange={(e) => setCreateRemindAt(e.target.value)}
            />
          </div>

          <button
            className="btn primary"
            type="button"
            disabled={locked || creatingReminder || availableReminderDrafts.length === 0}
            onClick={createMonthlyReminder}
          >
            {creatingReminder ? t("expenseReminders.adding") : t("expenseReminders.addButton")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 850, fontSize: 18 }}>{t("expenseReminders.monthTitle")}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {t("expenseReminders.monthSubtitle", { month: `${year}-${String(month).padStart(2, "0")}` })}
            </div>
          </div>
          {locked && <span className="badge">{t("common.closed")}</span>}
        </div>

        {loading ? (
          <div className="muted" style={{ marginTop: 16 }}>{t("common.loading")}</div>
        ) : groupedByDueDate.length === 0 ? (
          <div className="muted" style={{ marginTop: 16 }}>{t("expenseReminders.empty")}</div>
        ) : (
          <div style={{ display: "grid", gap: 18, marginTop: 16 }}>
            {groupedByDueDate.map((group) => (
              <div key={group.dueDate} style={{ display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {t("expenseReminders.groupTitle", {
                    date: formatShortDate(group.dueDate, i18n.language),
                    count: group.rows.length,
                  })}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {group.rows.map((row) => {
                    const draft = drafts[row.id] ?? {};
                    const categoryDisplay = row.category
                      ? getCategoryDisplayName(
                          {
                            name: row.category.name,
                            nameKey: row.category.nameKey ?? null,
                            expenseType: row.expenseType,
                          },
                          t
                        )
                      : "—";
                    const description = row.description?.trim() ? row.description : "—";
                    const isBusy = updatingId === row.id;

                    return (
                      <div
                        key={row.id}
                        style={{
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 16,
                          padding: 14,
                          display: "grid",
                          gap: 12,
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ minWidth: 220 }}>
                            <div style={{ fontWeight: 700 }}>{description}</div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                              {categoryDisplay} · {getExpenseTypeLabel(row.expenseType, t)} · {reminderChannelLabel(row.reminderChannel, t)}
                            </div>
                          </div>
                          <label
                            className="row"
                            title={t("expenseReminders.clearThisMonthTooltip")}
                            style={{ gap: 8, alignItems: "center", opacity: locked ? 0.6 : 1 }}
                          >
                            <input
                              type="checkbox"
                              disabled={locked || isBusy}
                              checked={false}
                              onChange={(e) => {
                                if (e.target.checked) clearReminderForMonth(row.id);
                              }}
                            />
                            <span>{t("expenseReminders.markPaid")}</span>
                          </label>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          }}
                        >
                          <div>
                            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                              {t("expenseReminders.dueDate")}
                            </div>
                            <input
                              className="input"
                              type="date"
                              value={draft.dueDate ?? reminderDateInputValue(row.dueDate)}
                              disabled={locked || isBusy}
                              onChange={(e) => setDraft(row.id, { dueDate: e.target.value })}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (!value || value === reminderDateInputValue(row.dueDate) || locked || isBusy) return;
                                saveReminder(row.id, { dueDate: value });
                              }}
                            />
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                              {t("expenseReminders.notificationDate")}
                            </div>
                            <input
                              className="input"
                              type="date"
                              value={draft.remindAt ?? reminderDateInputValue(row.remindAt)}
                              disabled={locked || isBusy}
                              onChange={(e) => setDraft(row.id, { remindAt: e.target.value })}
                              onBlur={(e) => {
                                const value = e.target.value.trim();
                                if (!value || value === reminderDateInputValue(row.remindAt) || locked || isBusy) return;
                                saveReminder(row.id, { remindAt: value });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 850, fontSize: 18 }}>{t("expenseReminders.settingsTitle")}</div>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {t("expenseReminders.settingsSubtitle")}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <label className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
            <input
              type="radio"
              name="expenseReminderSendMode"
              checked={reminderSendMode === "ONCE"}
              disabled={savingMode}
              onChange={() => updateReminderMode("ONCE")}
            />
            <span>
              <strong>{t("expenseReminders.sendModeOnceTitle")}</strong>
              <span className="muted" style={{ display: "block", marginTop: 2, fontSize: 13 }}>
                {t("expenseReminders.sendModeOnceBody")}
              </span>
            </span>
          </label>
          <label className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
            <input
              type="radio"
              name="expenseReminderSendMode"
              checked={reminderSendMode === "DAILY_UNTIL_PAID"}
              disabled={savingMode}
              onChange={() => updateReminderMode("DAILY_UNTIL_PAID")}
            />
            <span>
              <strong>{t("expenseReminders.sendModeDailyTitle")}</strong>
              <span className="muted" style={{ display: "block", marginTop: 2, fontSize: 13 }}>
                {t("expenseReminders.sendModeDailyBody")}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
