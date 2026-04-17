import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell, useAppYearMonth, useDisplayCurrency } from "../layout/AppShell";
import { getCategoryDisplayName, getExpenseTypeLabel, getTemplateDescriptionDisplay } from "../utils/categoryI18n";
import { getFxDefault } from "../utils/fx";

type ExpenseType = "FIXED" | "VARIABLE";
type ReminderChannel = "NONE" | "EMAIL" | "SMS";
type Category = { id: string; name: string; expenseType: ExpenseType; nameKey?: string | null };

type MonthCloseRow = {
  id: string;
  year: number;
  month: number;
  incomeUsd: number;
  expensesUsd: number;
  investmentEarningsUsd: number;
  balanceUsd: number;
  netWorthStartUsd: number;
  netWorthEndUsd?: number | null;
  encryptedPayload?: string | null;
  isClosed?: boolean;
  closedAt: string;
};

type ClosePreviewResp = {
  realBalanceUsd: number;
  budgetBalanceUsd: number;
  otherExpensesCurrent: number;
  otherExpensesProposed: number;
  netWorthStartUsd: number;
  netWorthEndUsd: number;
  incomeUsd?: number;
  baseExpensesUsd?: number;
  expensesUsd?: number;
  investmentEarningsUsd?: number;
  message: string;
};

type MeResp = { id: string; email: string; role: "USER" | "SUPER_ADMIN" };
type UserRow = { id: string; email: string; role: "USER" | "SUPER_ADMIN"; specialGuest: boolean; createdAt: string };
type CampaignPreviewResp = {
  campaignId: string;
  language: "es" | "en";
  subject: string;
  text: string;
  html: string;
};
type CampaignSendResp = {
  campaignId: string;
  audienceType: "user" | "group";
  audienceLabel: string;
  requestedCount: number;
  sentCount: number;
  failedCount: number;
  failures: Array<{ email: string; error: string }>;
  sentLanguages: { es: number; en: number };
};

type ExpenseTemplateRow = {
  id: string;
  expenseType: ExpenseType;
  categoryId: string;
  description: string;
  legacyPlaceholder?: boolean;
  descriptionKey?: string | null;
  onboardingSourceKey?: string | null;
  defaultAmountUsd: number | null;
  defaultAmount?: number | null;
  defaultCurrencyId?: string | null;
  showInExpenses?: boolean;
  reminderChannel?: ReminderChannel;
  reminderLabel?: string | null;
  dueDayOfMonth?: number | null;
  remindDaysBefore?: number | null;
  createdAt: string;
  updatedAt: string;
  encryptedPayload?: string | null;
  category?: { id: string; name: string; expenseType?: ExpenseType; nameKey?: string | null };
};

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const m2 = (m: number) => String(m).padStart(2, "0");
const CLOSE_BALANCE_TOLERANCE_USD = 0.01;

/* ---------------------------------------------------------
   Shared helpers
--------------------------------------------------------- */

function editNumberOrNull(v: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function reminderChannelLabel(channel: ReminderChannel, t: (key: string, options?: any) => string) {
  if (channel === "EMAIL") return t("admin.reminderChannelEmail");
  if (channel === "SMS") return t("admin.reminderChannelSms");
  return t("admin.reminderChannelNone");
}

function reminderSummary(
  config: {
    reminderChannel?: ReminderChannel | null;
    dueDayOfMonth?: number | null;
    remindDaysBefore?: number | null;
  },
  t: (key: string, options?: any) => string
) {
  const channel = config.reminderChannel ?? "NONE";
  const dueDay = config.dueDayOfMonth ?? null;
  const remindDaysBefore = Number(config.remindDaysBefore ?? 0);
  if (channel === "NONE" || dueDay == null) return t("admin.reminderChannelNone");
  const timing =
    remindDaysBefore <= 0
      ? t("admin.reminderSameDay")
      : t("admin.reminderDaysBeforeValue", { count: remindDaysBefore });
  return `${reminderChannelLabel(channel, t)} · ${t("admin.reminderDueDayValue", { day: dueDay })} · ${timing}`;
}

function isEncryptedPlaceholder(value: unknown) {
  return typeof value === "string" && /^\(encrypted(?:-[a-f0-9]{8})?\)$/i.test(value.trim());
}

function buildReminderPayload(args: {
  reminderChannel: ReminderChannel;
  dueDayOfMonth: string;
  remindDaysBefore: string;
}) {
  const reminderChannel = args.reminderChannel;
  const dueDayRaw = String(args.dueDayOfMonth ?? "").trim();
  const remindBeforeRaw = String(args.remindDaysBefore ?? "").trim();

  if (reminderChannel === "NONE") {
    return { reminderChannel, dueDayOfMonth: null, remindDaysBefore: 0 };
  }

  const dueDayOfMonth = Number(dueDayRaw);
  if (!Number.isInteger(dueDayOfMonth) || dueDayOfMonth < 1 || dueDayOfMonth > 31) {
    throw new Error("dueDayOfMonth");
  }

  const remindDaysBefore = remindBeforeRaw === "" ? 0 : Number(remindBeforeRaw);
  if (!Number.isInteger(remindDaysBefore) || remindDaysBefore < 0 || remindDaysBefore > 31) {
    throw new Error("remindDaysBefore");
  }

  return { reminderChannel, dueDayOfMonth, remindDaysBefore };
}

/* ---------------------------------------------------------
   Users admin
--------------------------------------------------------- */

function UsersAdminCard() {
  const { t } = useTranslation();
  const { showSuccess } = useAppShell();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "SUPER_ADMIN">("USER");
  const [specialGuest, setSpecialGuest] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "SUPER_ADMIN">("USER");
  const [editSpecialGuest, setEditSpecialGuest] = useState(false);
  const [editPassword, setEditPassword] = useState("");

  async function loadUsers() {
    setErr("");
    setInfo("");
    const r = await api<{ rows: UserRow[] }>("/admin/users");
    setRows(r.rows ?? []);
  }

  useEffect(() => {
    loadUsers().catch((e: any) => setErr(e?.message ?? t("common.error")));
  }, [t]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");

    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role, specialGuest }),
      });
      setEmail("");
      setPassword("");
      setRole("USER");
      setSpecialGuest(false);
      await loadUsers();
      setInfo(t("admin.userCreated"));
      showSuccess(t("admin.userCreated"));
    } catch (e: any) {
      setErr(e?.message ?? t("admin.errorCreatingUser"));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setErr("");
    setInfo("");

    try {
      await api(`/admin/users/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          email: editEmail,
          role: editRole,
          specialGuest: editSpecialGuest,
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });

      setEditing(null);
      setEditPassword("");
      await loadUsers();
      setInfo(t("admin.userUpdated"));
      showSuccess(t("admin.userUpdated"));
    } catch (e: any) {
      setErr(e?.message ?? t("admin.errorUpdatingUser"));
    }
  }

  async function del(id: string) {
    setErr("");
    setInfo("");
    if (!confirm(t("admin.deleteUser"))) return;

    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      await loadUsers();
      setInfo(t("admin.userDeleted"));
      showSuccess(t("admin.userDeleted"));
    } catch (e: any) {
      setErr(e?.message ?? t("admin.errorDeletingUser"));
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 800 }}>{t("admin.users")}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t("admin.usersDesc")}</div>
        </div>
        <button className="btn" type="button" onClick={loadUsers}>
          {t("common.refresh")}
        </button>
      </div>

      <form onSubmit={create} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
        <div style={{ minWidth: 260 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.email")}</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" />
        </div>

        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.password")}</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div style={{ minWidth: 180 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.role")}</div>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as any)} style={{ height: 42 }}>
            <option value="USER">USER</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>

        <label
          style={{
            minWidth: 180,
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 42,
            paddingTop: 18,
            fontSize: 14,
          }}
        >
          <input type="checkbox" checked={specialGuest} onChange={(e) => setSpecialGuest(e.target.checked)} />
          <span>{t("admin.specialGuest")}</span>
        </label>

        <button className="btn primary" type="submit" style={{ height: 42 }}>
          {t("admin.create")}
        </button>
      </form>

      {err && <div style={{ marginTop: 12, color: "var(--danger)" }}>{err}</div>}
      {info && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{info}</div>}

      {editing && (
        <div className="card" style={{ marginTop: 12, padding: 12, background: "rgba(15,23,42,0.03)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("admin.editUser")}</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.email")}</div>
              <input className="input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>

            <div style={{ minWidth: 180 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.role")}</div>
              <select className="select" value={editRole} onChange={(e) => setEditRole(e.target.value as any)} style={{ height: 42 }}>
                <option value="USER">USER</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>

            <label
              style={{
                minWidth: 180,
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 42,
                paddingTop: 18,
                fontSize: 14,
              }}
            >
              <input type="checkbox" checked={editSpecialGuest} onChange={(e) => setEditSpecialGuest(e.target.checked)} />
              <span>{t("admin.specialGuest")}</span>
            </label>

            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.newPasswordOptional")}</div>
              <input className="input" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>

            <button className="btn primary" type="button" onClick={saveEdit} style={{ height: 42 }}>
              {t("common.save")}
            </button>

            <button className="btn" type="button" onClick={() => setEditing(null)} style={{ height: 42 }}>
              {t("common.cancel")}
            </button>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {t("admin.tipPasswordBlank")}
          </div>
        </div>
      )}

      <div className="users-admin-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: 286, marginTop: 12 }}>
        <table className="table compact">
          <thead>
            <tr>
              <th>{t("admin.email")}</th>
              <th style={{ width: 140 }}>{t("admin.role")}</th>
              <th style={{ width: 140 }}>{t("admin.specialGuest")}</th>
              <th style={{ width: 160 }}>{t("admin.created")}</th>
              <th className="right" style={{ width: 220 }}>{t("expenses.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  {u.specialGuest ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 999,
                        padding: "4px 10px",
                        background: "rgba(34,197,94,0.12)",
                        color: "rgb(21, 128, 61)",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t("admin.specialGuestBadge")}
                    </span>
                  ) : "—"}
                </td>
                <td className="muted">{new Date(u.createdAt).toISOString().slice(0, 10)}</td>
                <td className="right">
                  <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setEditing(u);
                        setEditEmail(u.email);
                        setEditRole(u.role);
                        setEditSpecialGuest(u.specialGuest);
                        setEditPassword("");
                      }}
                      style={{ height: 34 }}
                    >
                      {t("admin.edit")}
                    </button>
                    <button className="btn danger" type="button" onClick={() => del(u.id)} style={{ height: 34 }}>
                      {t("common.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t("admin.noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .table.compact th, .table.compact td { padding: 6px 8px; }
        .users-admin-scroll thead th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: var(--panel);
        }
      `}</style>
    </div>
  );
}

function CampaignsAdminCard() {
  const { t } = useTranslation();
  const { showSuccess } = useAppShell();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [preview, setPreview] = useState<CampaignPreviewResp | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState<"es" | "en">("es");
  const [audienceType, setAudienceType] = useState<"group" | "user">("group");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [result, setResult] = useState<CampaignSendResp | null>(null);

  const selectableUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users]
  );

  const specialGuestUsers = useMemo(
    () => users.filter((row) => row.role !== "SUPER_ADMIN" && row.specialGuest),
    [users]
  );

  const selectedUser = useMemo(
    () => selectableUsers.find((row) => row.id === selectedUserId) ?? null,
    [selectableUsers, selectedUserId]
  );

  async function loadData(language: "es" | "en") {
    setLoading(true);
    setErr("");
    try {
      const [usersResp, previewResp] = await Promise.all([
        api<{ rows: UserRow[] }>("/admin/users"),
        api<CampaignPreviewResp>(`/admin/campaigns/special-guest/preview?language=${language}`),
      ]);
      setUsers(usersResp.rows ?? []);
      setPreview(previewResp);
    } catch (e: any) {
      setErr(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(previewLanguage).catch(() => {});
  }, [previewLanguage]);

  async function sendCampaign() {
    setErr("");
    setInfo("");
    setResult(null);

    if (audienceType === "user" && !selectedUserId) {
      setErr(t("admin.campaignSelectUserError"));
      return;
    }

    const confirmed =
      audienceType === "group"
        ? confirm(t("admin.campaignConfirmGroupSend", { count: specialGuestUsers.length }))
        : confirm(t("admin.campaignConfirmUserSend", { email: selectedUser?.email ?? "" }));
    if (!confirmed) return;

    setSending(true);
    try {
      const resp = await api<CampaignSendResp>("/admin/campaigns/special-guest/send", {
        method: "POST",
        body: JSON.stringify(
          audienceType === "group"
            ? { audienceType: "group", groupId: "special_guest" }
            : { audienceType: "user", userId: selectedUserId }
        ),
      });
      setResult(resp);
      setInfo(
        t("admin.campaignSentSummary", {
          sent: resp.sentCount,
          requested: resp.requestedCount,
          failed: resp.failedCount,
        })
      );
      showSuccess(
        t("admin.campaignSentSummary", {
          sent: resp.sentCount,
          requested: resp.requestedCount,
          failed: resp.failedCount,
        })
      );
    } catch (e: any) {
      setErr(e?.message ?? t("admin.campaignSendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800 }}>{t("admin.campaigns")}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t("admin.campaignsDesc")}</div>
        </div>
        <button className="btn" type="button" onClick={() => loadData(previewLanguage)} disabled={loading || sending}>
          {t("common.refresh")}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
          gap: 16,
        }}
      >
        <div className="admin-inner-card">
          <div style={{ fontWeight: 800, fontSize: 14 }}>{t("admin.campaignAudience")}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t("admin.campaignAudienceDesc")}</div>

          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.campaignTemplate")}</div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 14px",
                background: "var(--panel)",
              }}
            >
              <div style={{ fontWeight: 800 }}>{t("admin.campaignSpecialGuestTitle")}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t("admin.campaignSpecialGuestDesc")}</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.campaignPreviewLanguage")}</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={"btn " + (previewLanguage === "es" ? "primary" : "")}
                onClick={() => setPreviewLanguage("es")}
                disabled={loading || sending}
              >
                Español
              </button>
              <button
                type="button"
                className={"btn " + (previewLanguage === "en" ? "primary" : "")}
                onClick={() => setPreviewLanguage("en")}
                disabled={loading || sending}
              >
                English
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.campaignSendTo")}</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={"btn " + (audienceType === "group" ? "primary" : "")}
                onClick={() => setAudienceType("group")}
                disabled={loading || sending}
              >
                {t("admin.campaignGroupSpecialGuest")}
              </button>
              <button
                type="button"
                className={"btn " + (audienceType === "user" ? "primary" : "")}
                onClick={() => setAudienceType("user")}
                disabled={loading || sending}
              >
                {t("admin.campaignSingleUser")}
              </button>
            </div>
          </div>

          {audienceType === "group" ? (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(34,197,94,0.08)",
                color: "rgba(15,23,42,0.82)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {t("admin.campaignGroupCount", { count: specialGuestUsers.length })}
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.campaignUser")}</div>
              <select
                className="select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                style={{ width: "100%", height: 42 }}
                disabled={loading || sending}
              >
                <option value="">{t("admin.campaignUserPlaceholder")}</option>
                {selectableUsers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(15,23,42,0.04)",
              color: "rgba(15,23,42,0.76)",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            {t("admin.campaignLanguageNote")}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              className="btn primary"
              type="button"
              onClick={sendCampaign}
              disabled={loading || sending || (audienceType === "user" && !selectedUserId)}
            >
              {sending ? t("admin.campaignSending") : t("admin.campaignSend")}
            </button>
          </div>

          {err && <div style={{ marginTop: 12, color: "var(--danger)" }}>{err}</div>}
          {info && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{info}</div>}
          {result && result.failedCount > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "rgba(15,23,42,0.78)" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("admin.campaignFailures")}</div>
              <div style={{ display: "grid", gap: 4 }}>
                {result.failures.slice(0, 8).map((failure) => (
                  <div key={`${failure.email}-${failure.error}`}>
                    {failure.email}: {failure.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="admin-inner-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t("admin.campaignPreview")}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t("admin.campaignPreviewDesc")}</div>
            </div>
            {preview && (
              <div
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: "rgba(15,23,42,0.06)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {preview.language.toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.subject")}</div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "12px 14px",
                background: "var(--panel)",
                fontWeight: 700,
              }}
            >
              {preview?.subject ?? "—"}
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              border: "1px solid var(--border)",
              borderRadius: 18,
              overflow: "hidden",
              background: "#f4f7fb",
            }}
          >
            {loading ? (
              <div style={{ padding: 24, color: "rgba(15,23,42,0.65)" }}>{t("admin.campaignLoadingPreview")}</div>
            ) : preview ? (
              <div dangerouslySetInnerHTML={{ __html: preview.html }} />
            ) : (
              <div style={{ padding: 24, color: "rgba(15,23,42,0.65)" }}>{t("admin.campaignNoPreview")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Expense templates admin
--------------------------------------------------------- */

function ExpenseTemplatesAdminCard({
  categories,
  onboardingActive,
  onScrollTargetRef,
}: {
  categories: Category[];
  onboardingActive: boolean;
  onScrollTargetRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const { preferredDisplayCurrencyId } = useDisplayCurrency();
  const { showSuccess, me, serverFxRate } = useAppShell();
  const { encryptPayload, decryptPayload, hasEncryptionSupport } = useEncryption();
  const [rows, setRows] = useState<ExpenseTemplateRow[]>([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [expenseType, setExpenseType] = useState<ExpenseType>("VARIABLE");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [defaultAmountUsd, setDefaultAmountUsd] = useState<string>("");
  const [createDefaultCurrencyId, setCreateDefaultCurrencyId] = useState<"UYU" | "USD">(preferredDisplayCurrencyId);
  const [createCurrencyTouched, setCreateCurrencyTouched] = useState(false);
  const [createReminderChannel, setCreateReminderChannel] = useState<ReminderChannel>("NONE");
  const [createDueDayOfMonth, setCreateDueDayOfMonth] = useState<string>("");
  const [createRemindDaysBefore, setCreateRemindDaysBefore] = useState<string>("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExpenseType, setEditExpenseType] = useState<ExpenseType>("VARIABLE");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editDefaultAmountUsd, setEditDefaultAmountUsd] = useState<string>("");
  const [editDefaultCurrencyId, setEditDefaultCurrencyId] = useState<"UYU" | "USD">("USD");
  const [editReminderChannel, setEditReminderChannel] = useState<ReminderChannel>("NONE");
  const [editDueDayOfMonth, setEditDueDayOfMonth] = useState<string>("");
  const [editRemindDaysBefore, setEditRemindDaysBefore] = useState<string>("0");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [templateActionBusy, setTemplateActionBusy] = useState<{
    id: string | null;
    kind: "add" | "remove" | "delete" | null;
  }>({ id: null, kind: null });
  const repairedReminderLabelIdsRef = useRef<Set<string>>(new Set());
  const templateFxRate = serverFxRate ?? getFxDefault();

  const catsByType = useMemo(() => {
    const fixed = categories.filter((c) => c.expenseType === "FIXED");
    const variable = categories.filter((c) => c.expenseType === "VARIABLE");
    return { fixed, variable };
  }, [categories]);

  async function resolveTemplateRows(rawRows: ExpenseTemplateRow[]) {
    const resolved: ExpenseTemplateRow[] = [];
    for (const row of rawRows) {
      const legacyPlaceholder = !row.onboardingSourceKey && isEncryptedPlaceholder(row.description);
      if (row.encryptedPayload) {
        const pl = await decryptPayload<{
          description?: string;
          defaultAmountUsd?: number | null;
          defaultAmount?: number | null;
        }>(row.encryptedPayload);
        if (pl != null && typeof pl.description === "string") {
          resolved.push({
            ...row,
            legacyPlaceholder,
            description: pl.description,
            defaultAmountUsd: pl.defaultAmountUsd ?? null,
            defaultAmount: typeof pl.defaultAmount === "number" ? pl.defaultAmount : null,
          });
        } else {
          resolved.push({ ...row, legacyPlaceholder, description: "—", defaultAmountUsd: null, defaultAmount: null });
        }
      } else {
        resolved.push({ ...row, legacyPlaceholder, defaultAmount: row.defaultAmountUsd });
      }
    }
    return resolved;
  }

  async function loadTemplates() {
    setErr("");
    setInfo("");
    const r = await api<{ rows: ExpenseTemplateRow[] }>("/admin/expenseTemplates");
    const raw = r.rows ?? [];
    const resolved = await resolveTemplateRows(raw);
    setRows(resolved);

    const repairCandidates = resolved.filter(
      (row) =>
        row.reminderChannel &&
        row.reminderChannel !== "NONE" &&
        !String(row.reminderLabel ?? "").trim() &&
        typeof row.description === "string" &&
        row.description.trim() &&
        row.description.trim() !== "—" &&
        !isEncryptedPlaceholder(row.description) &&
        !repairedReminderLabelIdsRef.current.has(row.id)
    );

    if (repairCandidates.length > 0) {
      for (const row of repairCandidates) repairedReminderLabelIdsRef.current.add(row.id);
      const repaired = await Promise.all(
        repairCandidates.map(async (row) => {
          try {
            await api(`/admin/expenseTemplates/${row.id}`, {
              method: "PUT",
              body: JSON.stringify({ reminderLabel: row.description }),
            });
            return true;
          } catch {
            return false;
          }
        })
      );
      if (repaired.some(Boolean)) {
        const refreshed = await api<{ rows: ExpenseTemplateRow[] }>("/admin/expenseTemplates");
        setRows(await resolveTemplateRows(refreshed.rows ?? []));
      }
    }
  }

  useEffect(() => {
    loadTemplates().catch((e: any) => setErr(e?.message ?? t("common.error")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      const pick = categories.find((c) => c.expenseType === expenseType) ?? categories[0];
      setCategoryId(pick.id);
    } else if (categoryId) {
      const exists = categories.some((c) => c.id === categoryId);
      if (!exists && categories.length > 0) setCategoryId(categories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  useEffect(() => {
    if (!createCurrencyTouched) {
      setCreateDefaultCurrencyId(preferredDisplayCurrencyId);
    }
  }, [preferredDisplayCurrencyId, createCurrencyTouched]);

  useEffect(() => {
    const pick = categories.find((c) => c.expenseType === expenseType);
    if (pick) setCategoryId(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseType]);

  useEffect(() => {
    if (!editingId) return;
    const allowed = editExpenseType === "FIXED" ? catsByType.fixed : catsByType.variable;
    if (allowed.length === 0) return;
    const currentStillMatches = allowed.some((c) => c.id === editCategoryId);
    if (!currentStillMatches) {
      setEditCategoryId(allowed[0].id);
    }
  }, [editingId, editExpenseType, editCategoryId, catsByType.fixed, catsByType.variable]);

  function computeDefaultAmountUsd(
    amountStr: string,
    currencyId: "UYU" | "USD",
    usdUyuRate: number
  ): number | null {
    const amt = editNumberOrNull(amountStr);
    if (amt == null) return null;
    if (currencyId === "USD") return amt;
    if (!Number.isFinite(usdUyuRate) || usdUyuRate <= 0) return null;
    return amt / usdUyuRate;
  }

  function computeDisplayedTemplateAmount(row: Pick<ExpenseTemplateRow, "defaultAmount" | "defaultAmountUsd" | "defaultCurrencyId">) {
    if (row.defaultAmount != null && Number.isFinite(row.defaultAmount)) {
      return row.defaultAmount;
    }
    if (row.defaultAmountUsd == null || !Number.isFinite(row.defaultAmountUsd)) return null;
    if ((row.defaultCurrencyId ?? "USD") === "UYU") {
      return Math.round(row.defaultAmountUsd * templateFxRate);
    }
    return row.defaultAmountUsd;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");

    const desc = description.trim();
    if (!desc) return setErr(t("admin.descriptionRequired"));
    if (!categoryId) return setErr(t("admin.categoryRequired"));

    const amountStr = defaultAmountUsd.trim();
    const defaultAmountUsdValue = amountStr
      ? computeDefaultAmountUsd(amountStr, createDefaultCurrencyId, templateFxRate)
      : null;
    if (amountStr && defaultAmountUsdValue == null)
      return setErr(createDefaultCurrencyId === "UYU" ? t("expenses.fx") : t("common.error"));

    let reminderPayload: { reminderChannel: ReminderChannel; dueDayOfMonth: number | null; remindDaysBefore: number };
    try {
      reminderPayload = buildReminderPayload({
        reminderChannel: createReminderChannel,
        dueDayOfMonth: createDueDayOfMonth,
        remindDaysBefore: createRemindDaysBefore,
      });
    } catch (error: any) {
      return setErr(
        error?.message === "dueDayOfMonth"
          ? t("admin.reminderDueDayRequired")
          : t("admin.reminderDaysBeforeInvalid")
      );
    }

    try {
      const body: Record<string, unknown> = {
        expenseType,
        categoryId,
        defaultCurrencyId: createDefaultCurrencyId,
        defaultAmountUsd: defaultAmountUsdValue,
        reminderLabel: desc,
        ...reminderPayload,
      };
      if (hasEncryptionSupport) {
        const enc = await encryptPayload({
          description: desc,
          defaultAmountUsd: defaultAmountUsdValue,
          defaultAmount: amountStr ? Number(amountStr) : null,
        });
        if (enc) body.encryptedPayload = enc;
        else { body.description = desc; body.defaultAmountUsd = defaultAmountUsdValue; }
      } else {
        body.description = desc;
        body.defaultAmountUsd = defaultAmountUsdValue;
      }

      await api("/admin/expenseTemplates", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setDescription("");
      setDefaultAmountUsd("");
      setCreateCurrencyTouched(false);
      setCreateDefaultCurrencyId(preferredDisplayCurrencyId);
      setCreateReminderChannel("NONE");
      setCreateDueDayOfMonth("");
      setCreateRemindDaysBefore("0");
      await loadTemplates();
      setInfo(t("admin.templateCreatedInfo"));
      showSuccess(t("admin.templateCreated"));
    } catch (e: any) {
      setErr(e?.message ?? t("admin.errorCreatingTemplate"));
    }
  }

  function startEdit(row: ExpenseTemplateRow) {
    setEditingId(row.id);
    setEditExpenseType(row.expenseType);
    setEditCategoryId(row.categoryId);
    setEditDescription(getTemplateDescriptionDisplay(row, t));
    const cur = (row.defaultCurrencyId ?? "USD") as "UYU" | "USD";
    setEditDefaultCurrencyId(cur);
    setEditReminderChannel(row.reminderChannel ?? "NONE");
    setEditDueDayOfMonth(row.dueDayOfMonth != null ? String(row.dueDayOfMonth) : "");
    setEditRemindDaysBefore(String(Number(row.remindDaysBefore ?? 0)));
    const displayedAmount = computeDisplayedTemplateAmount(row);
    const amt = displayedAmount == null ? "" : String(Math.round(displayedAmount));
    setEditDefaultAmountUsd(amt);
    setErr("");
    setInfo("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDefaultAmountUsd("");
    setEditReminderChannel("NONE");
    setEditDueDayOfMonth("");
    setEditRemindDaysBefore("0");
  }

  async function saveEdit(id: string) {
    setErr("");
    setInfo("");
    setSavingId(id);

    const desc = editDescription.trim();
    if (!desc) {
      setErr(t("admin.descriptionRequired"));
      setSavingId(null);
      return;
    }
    if (!editCategoryId) {
      setErr(t("admin.categoryRequired"));
      setSavingId(null);
      return;
    }

    const row = rows.find((r) => r.id === id);
    const displayedTranslated = row ? getTemplateDescriptionDisplay(row, t) : "";
    const descToSend = row && desc === displayedTranslated ? row.description : desc;
    const amountUsdValue = editDefaultAmountUsd.trim()
      ? computeDefaultAmountUsd(editDefaultAmountUsd, editDefaultCurrencyId, templateFxRate)
      : null;
    if (editDefaultAmountUsd.trim() && amountUsdValue == null) {
      setErr(editDefaultCurrencyId === "UYU" ? t("expenses.fx") : t("common.error"));
      setSavingId(null);
      return;
    }

    let reminderPayload: { reminderChannel: ReminderChannel; dueDayOfMonth: number | null; remindDaysBefore: number };
    try {
      reminderPayload = buildReminderPayload({
        reminderChannel: editReminderChannel,
        dueDayOfMonth: editDueDayOfMonth,
        remindDaysBefore: editRemindDaysBefore,
      });
    } catch (error: any) {
      setErr(
        error?.message === "dueDayOfMonth"
          ? t("admin.reminderDueDayRequired")
          : t("admin.reminderDaysBeforeInvalid")
      );
      setSavingId(null);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        categoryId: editCategoryId,
        defaultCurrencyId: editDefaultCurrencyId,
        defaultAmountUsd: amountUsdValue,
        reminderLabel: desc,
        ...reminderPayload,
      };
      if (hasEncryptionSupport) {
        const enc = await encryptPayload({
          description: descToSend,
          defaultAmountUsd: amountUsdValue,
          defaultAmount: editDefaultAmountUsd.trim() ? Number(editDefaultAmountUsd) : null,
        });
        if (enc) body.encryptedPayload = enc;
        else { body.description = descToSend; body.defaultAmountUsd = amountUsdValue; }
      } else {
        body.description = descToSend;
        body.defaultAmountUsd = amountUsdValue;
      }
      await api(`/admin/expenseTemplates/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setEditingId(null);
      await loadTemplates();
      showSuccess(t("admin.templateUpdated"));
    } catch (e: any) {
      setErr(e?.message ?? t("common.error"));
    } finally {
      setSavingId(null);
    }
  }

  async function setShowInExpenses(id: string, visible: boolean) {
    setErr("");
    setInfo("");
    setTemplateActionBusy({ id, kind: visible ? "add" : "remove" });
    try {
      await api(`/admin/expenseTemplates/${id}`, {
        method: "PUT",
        body: JSON.stringify({ showInExpenses: visible }),
      });
      await loadTemplates();
      showSuccess(visible ? t("admin.templateAddedToExpenses") : t("admin.templateRemovedFromExpenses"));
    } catch (e: any) {
      setErr(e?.message ?? t("common.error"));
    } finally {
      setTemplateActionBusy({ id: null, kind: null });
    }
  }

  async function del(id: string) {
    setErr("");
    setInfo("");
    if (!confirm(t("admin.deleteTemplate"))) return;

    setTemplateActionBusy({ id, kind: "delete" });
    try {
      await api(`/admin/expenseTemplates/${id}`, { method: "DELETE" });
      await loadTemplates();
      setInfo("Template deleted.");
      showSuccess("Template deleted.");
    } catch (e: any) {
      setErr(e?.message ?? "Error deleting template");
    } finally {
      setTemplateActionBusy({ id: null, kind: null });
    }
  }

  const supersededCategoryIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (String(row.onboardingSourceKey ?? "").startsWith("onboarding:template:")) {
        set.add(row.categoryId);
      }
    }
    return set;
  }, [rows]);

  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        const isLegacyPlaceholder = !row.onboardingSourceKey && Boolean(row.legacyPlaceholder);
        if (!isLegacyPlaceholder) return true;
        return !supersededCategoryIds.has(row.categoryId);
      }),
    [rows, supersededCategoryIds]
  );

  const visibleRows = displayRows.filter((r) => r.showInExpenses !== false);
  const notVisibleRows = displayRows.filter((r) => r.showInExpenses === false);

  const sortTemplates = (a: ExpenseTemplateRow, b: ExpenseTemplateRow) => {
    if (a.expenseType !== b.expenseType) return a.expenseType.localeCompare(b.expenseType);
    const catA = a.category?.name ?? "";
    const catB = b.category?.name ?? "";
    if (catA !== catB) return catA.localeCompare(catB, undefined, { sensitivity: "base" });
    return (a.description ?? "").localeCompare(b.description ?? "", undefined, { sensitivity: "base" });
  };
  const visibleRowsSorted = useMemo(() => [...visibleRows].sort(sortTemplates), [visibleRows]);
  const notVisibleRowsSorted = useMemo(() => [...notVisibleRows].sort(sortTemplates), [notVisibleRows]);

  const showOnbCallout = onboardingActive;
  const templatesBusy = templateActionBusy.kind !== null;

  function renderTemplateRow(row: ExpenseTemplateRow, options: { showAddButton?: boolean; showRemoveButton?: boolean }) {
    const { showAddButton = false, showRemoveButton = false } = options;
    const isEditing = editingId === row.id;
    const isActionBusy = templateActionBusy.id === row.id;
    return (
      <tr key={row.id} style={isEditing ? { background: "rgba(15,23,42,0.03)" } : undefined}>
        <td className="muted" style={{ width: 110 }}>
          {isEditing ? (
            <select className="select" value={editExpenseType} onChange={(e) => setEditExpenseType(e.target.value as any)} style={{ width: "100%", height: 32 }}>
              <option value="FIXED">{t("expenses.typeFixed")}</option>
              <option value="VARIABLE">{t("expenses.typeVariable")}</option>
            </select>
          ) : (
            getExpenseTypeLabel(row.expenseType, t)
          )}
        </td>
        <td style={{ width: 220 }}>
          {isEditing ? (
            <select className="select" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} style={{ width: "100%", height: 32 }}>
              {(editExpenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
                <option key={c.id} value={c.id}>{getCategoryDisplayName(c, t)}</option>
              ))}
            </select>
          ) : (
            row.category ? getCategoryDisplayName(row.category, t) : row.categoryId
          )}
        </td>
        <td>
          {isEditing ? (
            <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%", height: 32 }} />
          ) : (
            getTemplateDescriptionDisplay(row, t)
          )}
        </td>
        <td className="right" style={{ minWidth: 248, width: 248 }}>
          {isEditing ? (
            <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
              <select className="select" value={editDefaultCurrencyId} onChange={(e) => setEditDefaultCurrencyId(e.target.value as "UYU" | "USD")} style={{ width: 56, height: 32, fontSize: 11, flexShrink: 0 }}>
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
              <input className="input" type="number" value={editDefaultAmountUsd} onChange={(e) => setEditDefaultAmountUsd(e.target.value)} style={{ width: 82, height: 32, textAlign: "right", flexShrink: 0 }} />
            </div>
          ) : (
            computeDisplayedTemplateAmount(row) == null ? (
              <span className="muted">—</span>
            ) : (
              <span>{usd0.format(computeDisplayedTemplateAmount(row) ?? 0)} {row.defaultCurrencyId ?? "USD"}</span>
            )
          )}
        </td>
        <td style={{ minWidth: 260, width: 260 }}>
          {isEditing ? (
            <div style={{ display: "grid", gap: 6 }}>
              <select className="select" value={editReminderChannel} onChange={(e) => setEditReminderChannel(e.target.value as ReminderChannel)} style={{ width: "100%", height: 32 }}>
                <option value="NONE">{t("admin.reminderChannelNone")}</option>
                <option value="EMAIL">{t("admin.reminderChannelEmail")}</option>
                <option value="SMS">{t("admin.reminderChannelSms")}</option>
              </select>
              {editReminderChannel !== "NONE" && (
                <div style={{ display: "grid", gap: 6 }}>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <div style={{ minWidth: 88, flex: "0 0 88px" }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                        {t("admin.reminderDueDayShort")}
                      </div>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={31}
                        value={editDueDayOfMonth}
                        onChange={(e) => setEditDueDayOfMonth(e.target.value)}
                        placeholder="15"
                        style={{ width: "100%", height: 32 }}
                      />
                    </div>
                    <div style={{ minWidth: 120, flex: "0 0 120px" }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                        {t("admin.reminderDaysBeforeShort")}
                      </div>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={31}
                        value={editRemindDaysBefore}
                        onChange={(e) => setEditRemindDaysBefore(e.target.value)}
                        style={{ width: "100%", height: 32 }}
                      />
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {t("admin.reminderDaysBeforeHelp")}
                  </div>
                </div>
              )}
              {editReminderChannel === "SMS" && !me?.phoneVerifiedAt && (
                <div className="muted" style={{ fontSize: 11 }}>
                  {t("admin.reminderSmsRequiresPhone")}
                </div>
              )}
            </div>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              {reminderSummary(
                {
                  reminderChannel: row.reminderChannel ?? "NONE",
                  dueDayOfMonth: row.dueDayOfMonth,
                  remindDaysBefore: row.remindDaysBefore,
                },
                t
              )}
            </span>
          )}
        </td>
        <td className="right" style={{ minWidth: showAddButton || showRemoveButton ? 260 : 200, width: showAddButton || showRemoveButton ? 260 : 200 }}>
          <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
            {isEditing ? (
              <>
                <button className="btn primary" type="button" onClick={() => saveEdit(row.id)} disabled={savingId === row.id} style={{ height: 32 }}>
                  {savingId === row.id ? t("common.loading") : t("common.save")}
                </button>
                <button className="btn" type="button" onClick={cancelEdit} style={{ height: 32 }}>{t("common.cancel")}</button>
              </>
            ) : (
              <>
                <button className="btn" type="button" onClick={() => startEdit(row)} disabled={templatesBusy} style={{ height: 32 }}>{t("admin.edit")}</button>
                <button className="btn danger" type="button" onClick={() => del(row.id)} disabled={templatesBusy} style={{ height: 32 }}>
                  {isActionBusy && templateActionBusy.kind === "delete" ? t("admin.templateActionProcessing") : t("common.delete")}
                </button>
                {showAddButton && (
                  <button className="btn primary" type="button" onClick={() => setShowInExpenses(row.id, true)} disabled={templatesBusy} style={{ height: 32 }}>
                    {isActionBusy && templateActionBusy.kind === "add" ? t("admin.templateActionProcessing") : t("admin.addToExpenses")}
                  </button>
                )}
                {showRemoveButton && (
                  <button className="btn" type="button" onClick={() => setShowInExpenses(row.id, false)} disabled={templatesBusy} style={{ height: 32 }}>
                    {isActionBusy && templateActionBusy.kind === "remove" ? t("admin.templateActionProcessing") : t("admin.removeFromExpenses")}
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="admin-card-templates" style={{ marginTop: 0 }} ref={onScrollTargetRef}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900 }}>{t("admin.tabTemplates")}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.templatesIntro")}</div>
        </div>
        <button className="btn" type="button" onClick={loadTemplates} disabled={templatesBusy}>
          {templatesBusy ? t("admin.templateActionProcessing") : t("common.refresh")}
        </button>
      </div>

      {templatesBusy && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(15,23,42,0.04)",
            color: "rgba(15,23,42,0.78)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {t("admin.templateActionProcessingNotice")}
        </div>
      )}

      {showOnbCallout && (
        <div className="admin-onb-callout" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>{t("admin.step1Title")}</div>
          <div className="muted" style={{ fontSize: 13 }}>{t("admin.templatesDesc")}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {t("admin.step1Tip")}
          </div>
        </div>
      )}

      <div className="admin-inner-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("admin.create")} {t("admin.expenseTemplates").toLowerCase()}</div>
        <form onSubmit={create} className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 140 }}>
            <label className="admin-label">{t("admin.type")}</label>
            <select className="select" value={expenseType} onChange={(e) => setExpenseType(e.target.value as any)} style={{ width: "100%", marginTop: 4, height: 40 }}>
              <option value="FIXED">{t("expenses.typeFixed")}</option>
              <option value="VARIABLE">{t("expenses.typeVariable")}</option>
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="admin-label">{t("admin.category")}</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", marginTop: 4, height: 40 }}>
              {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
                <option key={c.id} value={c.id}>{getCategoryDisplayName(c, t)}</option>
              ))}
              {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).length === 0 && (
                <option value="" disabled>{t("admin.noCategoriesOfThisType")}</option>
              )}
            </select>
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 200 }}>
            <label className="admin-label">{t("admin.description")}</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("admin.descriptionPlaceholder")} style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div style={{ minWidth: 80 }}>
            <label className="admin-label">{t("expenses.curr")}</label>
            <select
              className="select"
              value={createDefaultCurrencyId}
              onChange={(e) => {
                setCreateDefaultCurrencyId(e.target.value as "UYU" | "USD");
                setCreateCurrencyTouched(true);
              }}
              style={{ width: "100%", marginTop: 4, height: 40, fontSize: 11 }}
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="admin-label">{t("admin.defaultAmountLabel", { currency: createDefaultCurrencyId })}</label>
            <input className="input" type="number" value={defaultAmountUsd} onChange={(e) => setDefaultAmountUsd(e.target.value)} placeholder={t("admin.optionalPlaceholder")} style={{ width: "100%", marginTop: 4, height: 40 }} />
          </div>
          <div style={{ minWidth: 140 }}>
            <label className="admin-label">{t("admin.reminder")}</label>
            <select className="select" value={createReminderChannel} onChange={(e) => setCreateReminderChannel(e.target.value as ReminderChannel)} style={{ width: "100%", marginTop: 4, height: 40 }}>
              <option value="NONE">{t("admin.reminderChannelNone")}</option>
              <option value="EMAIL">{t("admin.reminderChannelEmail")}</option>
              <option value="SMS">{t("admin.reminderChannelSms")}</option>
            </select>
          </div>
          {createReminderChannel !== "NONE" && (
            <>
              <div style={{ minWidth: 110 }}>
                <label className="admin-label">{t("admin.reminderDueDay")}</label>
                <input className="input" type="number" min={1} max={31} value={createDueDayOfMonth} onChange={(e) => setCreateDueDayOfMonth(e.target.value)} placeholder="15" style={{ width: "100%", marginTop: 4, height: 40 }} />
              </div>
              <div style={{ minWidth: 150 }}>
                <label className="admin-label">{t("admin.reminderDaysBefore")}</label>
                <input className="input" type="number" min={0} max={31} value={createRemindDaysBefore} onChange={(e) => setCreateRemindDaysBefore(e.target.value)} style={{ width: "100%", marginTop: 4, height: 40 }} />
                <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                  {t("admin.reminderDaysBeforeHelp")}
                </div>
              </div>
            </>
          )}
          <button className="btn primary" type="submit" style={{ height: 40 }}>{t("admin.create")}</button>
        </form>
        {createReminderChannel === "SMS" && !me?.phoneVerifiedAt && (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
            {t("admin.reminderSmsRequiresPhone")}
          </div>
        )}
        {err && <div className="admin-message admin-message--error" style={{ marginTop: 10 }}>{err}</div>}
        {info && <div className="admin-message admin-message--info" style={{ marginTop: 10 }}>{info}</div>}
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="admin-inner-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{t("admin.templatesVisibleInExpenses")}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{t("admin.templateNote")}</div>
          <div className="admin-table-wrap">
            <table className="table admin-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>{t("expenses.type")}</th>
                  <th style={{ width: 220 }}>{t("expenses.category")}</th>
                  <th>{t("expenses.description")}</th>
                  <th className="right" style={{ width: 120 }}>{t("admin.defaultUsd")}</th>
                  <th style={{ width: 260 }}>{t("admin.reminder")}</th>
                  <th className="right" style={{ width: 260, minWidth: 260 }}>{t("expenses.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRowsSorted.map((row) => renderTemplateRow(row, { showRemoveButton: true }))}
                {visibleRowsSorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("admin.noTemplatesYet")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-inner-card">
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{t("admin.templatesNotVisible")}</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{t("admin.templatesNotVisibleDesc")}</div>
          <div className="admin-table-wrap">
            <table className="table admin-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>{t("expenses.type")}</th>
                  <th style={{ width: 220 }}>{t("expenses.category")}</th>
                  <th>{t("expenses.description")}</th>
                  <th className="right" style={{ width: 120 }}>{t("admin.defaultUsd")}</th>
                  <th style={{ width: 260 }}>{t("admin.reminder")}</th>
                  <th className="right" style={{ width: 260, minWidth: 260 }}>{t("expenses.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {notVisibleRowsSorted.map((row) => renderTemplateRow(row, { showAddButton: true }))}
                {notVisibleRowsSorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("admin.noTemplatesNotVisible")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {err && <div className="admin-message admin-message--error" style={{ marginTop: 12 }}>{err}</div>}
      {info && <div className="admin-message admin-message--info" style={{ marginTop: 12 }}>{info}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   Recent activity (super admin): users + verification codes
--------------------------------------------------------- */

type RecentUser = { id: string; email: string; role: string; createdAt: string };
type RecentCode = {
  id: string;
  email: string;
  purpose: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  attempts: number;
  status: "used" | "expired" | "pending";
};
type RecentLogin = {
  id: string;
  userId: string;
  email: string;
  loggedAt: string;
  ip: string | null;
  userAgent: string | null;
};
type RecentActivityResp = {
  recentUsers: RecentUser[];
  recentVerificationCodes: RecentCode[];
  recentLogins?: RecentLogin[];
  note: string;
};

function RecentActivityCard() {
  const { t } = useTranslation();
  const [data, setData] = useState<RecentActivityResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await api<RecentActivityResp>("/admin/recent-activity");
      setData(r);
    } catch (e: any) {
      setErr(e?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const formatDate = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900 }}>{t("admin.recentActivityTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.recentActivityDesc")}</div>
        </div>
        <button className="btn" type="button" onClick={load} disabled={loading}>
          {loading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      {err && <div style={{ marginTop: 12, color: "var(--danger)" }}>{err}</div>}
      {data && (
        <>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{t("admin.recentLogins")}</div>
            <div className="admin-table-wrap">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.email")}</th>
                    <th style={{ width: 180 }}>{t("admin.loggedAt")}</th>
                    <th style={{ width: 140 }}>{t("admin.ip")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentLogins ?? []).map((l) => (
                    <tr key={l.id}>
                      <td>{l.email}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{formatDate(l.loggedAt)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{l.ip ?? "—"}</td>
                    </tr>
                  ))}
                  {(data.recentLogins ?? []).length === 0 && (
                    <tr><td colSpan={3} className="muted" style={{ padding: 16, textAlign: "center" }}>{t("admin.noLogins")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{t("admin.recentUsers")}</div>
            <div className="admin-table-wrap">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.email")}</th>
                    <th style={{ width: 120 }}>{t("admin.role")}</th>
                    <th style={{ width: 180 }}>{t("admin.created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td className="muted">{u.role}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {data.recentUsers.length === 0 && (
                    <tr><td colSpan={3} className="muted" style={{ padding: 16, textAlign: "center" }}>{t("admin.noUsers")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>{t("admin.recentVerificationCodes")}</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{data.note}</div>
            <div className="admin-table-wrap">
              <table className="table admin-table">
                <thead>
                  <tr>
                    <th>{t("admin.email")}</th>
                    <th style={{ width: 100 }}>{t("admin.purpose")}</th>
                    <th style={{ width: 160 }}>{t("admin.requested")}</th>
                    <th style={{ width: 160 }}>{t("admin.expires")}</th>
                    <th style={{ width: 100 }}>{t("admin.status")}</th>
                    <th style={{ width: 120 }}>{t("admin.usedAt")}</th>
                    <th style={{ width: 80 }}>{t("admin.attempts")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVerificationCodes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.email}</td>
                      <td className="muted">{c.purpose}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{formatDate(c.createdAt)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{formatDate(c.expiresAt)}</td>
                      <td>
                        <span style={{
                          fontWeight: 600,
                          color: c.status === "used" ? "var(--muted)" : c.status === "expired" ? "var(--muted)" : "var(--text)",
                        }}>
                          {c.status === "used" ? t("admin.codeUsed") : c.status === "expired" ? t("admin.codeExpired") : t("admin.codePending")}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>{c.usedAt ? formatDate(c.usedAt) : "—"}</td>
                      <td>{c.attempts}</td>
                    </tr>
                  ))}
                  {data.recentVerificationCodes.length === 0 && (
                    <tr><td colSpan={7} className="muted" style={{ padding: 16, textAlign: "center" }}>{t("admin.noVerificationCodes")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Admin page
--------------------------------------------------------- */

export default function AdminPage() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, showSuccess, serverFxRate, isMobile } = useAppShell();
  const { year: appYear } = useAppYearMonth();
  const { formatAmountUsd } = useDisplayCurrency();
  const { encryptPayload, decryptPayload, hasEncryptionSupport } = useEncryption();
  const usdUyuRate = serverFxRate ?? getFxDefault();

  const [meResp, setMeResp] = useState<MeResp | null>(null);
  const [_meError, setMeError] = useState<string>("");

  const isSuperAdmin = meResp?.role === "SUPER_ADMIN";

  type AdminTab = "categories" | "templates" | "monthClose" | "users" | "campaigns";
  const [activeTab, setActiveTab] = useState<AdminTab>("templates");

  /**
   * 🔧 Fix: when user clicks "Start with step 1" we navigate to /admin,
   * but sometimes their onboardingStep is "dashboard" (used as "hide panel for now"),
   * so the Admin banner won't show.
   *
   * If we land on /admin while onboarding is not done and the step is "welcome" OR "dashboard",
   * normalize it to "admin" so:
   *  - the Admin banner appears
   *  - the templates callout appears
   */
  useEffect(() => {
    if (!meLoaded || !me) return;
    if (onboardingStep === "done") return;

    if (onboardingStep === "welcome" || onboardingStep === "dashboard") {
      setOnboardingStep("admin");
    }
  }, [meLoaded, me, onboardingStep, setOnboardingStep]);

  // Show Step 1 banner if onboarding not done AND currently in welcome/admin (admin normalized above)
  const onboardingActive =
    meLoaded && !!me && onboardingStep !== "done" && (onboardingStep === "welcome" || onboardingStep === "admin");

  const templatesRef = useRef<HTMLDivElement>(null);

  // ---------- Categories ----------
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<ExpenseType>("VARIABLE");
  const [catError, setCatError] = useState("");
  const [catInfo, setCatInfo] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editType, setEditType] = useState<ExpenseType>("VARIABLE");

  // ---------- Month close ----------
  const [mcYear, setMcYear] = useState<number>(appYear);
  const [mcMonth, setMcMonth] = useState<number>(1);
  const [monthCloses, setMonthCloses] = useState<MonthCloseRow[]>([]);
  const [monthClosesLoaded, setMonthClosesLoaded] = useState(false);
  const mcInitialDefaultSet = useRef(false);
  const [mcError, setMcError] = useState("");
  const [mcInfo, setMcInfo] = useState("");
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [closePreviewData, setClosePreviewData] = useState<ClosePreviewResp | null>(null);
  const [closeMonthPreparing, setCloseMonthPreparing] = useState(false);
  const [closeMonthSubmitting, setCloseMonthSubmitting] = useState(false);
  const closeMonthBusy = closeMonthPreparing || closeMonthSubmitting;

  const closedSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of monthCloses) {
      if (r.isClosed !== false) s.add(`${r.year}-${r.month}`);
    }
    return s;
  }, [monthCloses]);

  const selectedClose = useMemo(() => {
    return monthCloses.find((r) => r.year === mcYear && r.month === mcMonth) ?? null;
  }, [monthCloses, mcYear, mcMonth]);

  const isSelectedClosed = closedSet.has(`${mcYear}-${mcMonth}`);

  useEffect(() => {
    if (!monthClosesLoaded || mcInitialDefaultSet.current) return;
    mcInitialDefaultSet.current = true;
    const rows = monthCloses;
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      const nextMonth = last.month === 12 ? 1 : last.month + 1;
      const nextYear = last.month === 12 ? last.year + 1 : last.year;
      setMcYear(nextYear);
      setMcMonth(nextMonth);
    } else {
      setMcYear(appYear);
      setMcMonth(1);
    }
  }, [monthClosesLoaded, monthCloses, appYear]);

  useEffect(() => {
    setHeader({
      title: t("admin.title"),
      subtitle: t("admin.subtitle", { year: appYear }),
    });
  }, [setHeader, appYear, t]);

  async function loadMe() {
    setMeError("");
    try {
      const r = await api<MeResp>("/auth/me");
      setMeResp(r);
    } catch (err: any) {
      setMeResp(null);
      setMeError(err?.message ?? "Error loading /auth/me");
    }
  }

  async function loadCategories() {
    const data = await api<Category[]>("/categories");
    setCategories(data);
  }

  async function loadMonthCloses(y: number) {
    const r = await api<{ year: number; rows: MonthCloseRow[] }>(`/monthCloses?year=${y}`);
    const raw = r.rows ?? [];
    const resolved: MonthCloseRow[] = await Promise.all(
      raw.map(async (row) => {
        if (!row.encryptedPayload) return row;
        const pl = await decryptPayload<{
          incomeUsd?: number;
          expensesUsd?: number;
          investmentEarningsUsd?: number;
          balanceUsd?: number;
          netWorthStartUsd?: number;
          netWorthEndUsd?: number | null;
        }>(row.encryptedPayload);
        if (pl != null)
          return {
            ...row,
            incomeUsd: pl.incomeUsd ?? 0,
            expensesUsd: pl.expensesUsd ?? 0,
            investmentEarningsUsd: pl.investmentEarningsUsd ?? 0,
            balanceUsd: pl.balanceUsd ?? 0,
            netWorthStartUsd: pl.netWorthStartUsd ?? 0,
            netWorthEndUsd: pl.netWorthEndUsd ?? null,
          };
        return { ...row, incomeUsd: 0, expensesUsd: 0, investmentEarningsUsd: 0, balanceUsd: 0, netWorthStartUsd: 0, netWorthEndUsd: null };
      })
    );
    setMonthCloses(resolved);
    setMonthClosesLoaded(true);
  }

  async function loadAll() {
    setCatError("");
    setCatInfo("");
    setMcError("");
    setMcInfo("");
    await Promise.allSettled([loadMe(), loadCategories(), loadMonthCloses(mcYear)]);
  }

  useEffect(() => {
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMonthCloses(mcYear).catch((err: any) => setMcError(err?.message ?? "Error loading month closes"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcYear]);

  // ---------- Categories handlers ----------
  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError("");
    setCatInfo("");

    const name = newName.trim();
    if (!name) return;

    try {
      await api("/categories", { method: "POST", body: JSON.stringify({ name, expenseType: newType }) });
      setNewName("");
      setNewType("VARIABLE");
      await loadCategories();
      setCatInfo(t("admin.categoryCreated"));
      showSuccess(t("admin.categoryCreated"));
    } catch (err: any) {
      setCatError(err?.message ?? "Error");
    }
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditValue(c.name);
    setEditType(c.expenseType ?? "VARIABLE");
    setCatError("");
    setCatInfo("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveEdit() {
    if (!editingId) return;

    setCatError("");
    setCatInfo("");

    const name = editValue.trim();
    if (!name) return;

    try {
      await api(`/categories/${editingId}`, { method: "PUT", body: JSON.stringify({ name, expenseType: editType }) });
      setEditingId(null);
      setEditValue("");
      await loadCategories();
      setCatInfo(t("admin.categoryUpdated"));
      showSuccess(t("admin.categoryUpdated"));
    } catch (err: any) {
      setCatError(err?.message ?? "Error");
    }
  }

  async function removeCategory(id: string) {
    setCatError("");
    setCatInfo("");
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      await loadCategories();
      setCatInfo(t("admin.categoryDeleted"));
      showSuccess(t("admin.categoryDeleted"));
    } catch (err: any) {
      const msg = err?.message ?? "Error";
      setCatError(
        msg.includes("Cannot delete")
          ? t("admin.categoryHasExpensesError")
          : msg
      );
    }
  }

  /** Construye en cliente ingresos, gastos, ganancias, balance y patrimonio (inicio/fin mes) para el preview y el cierre con E2EE. */
  async function buildClosePreviewClient(): Promise<{
    incomeUsd: number;
    baseExpensesUsd: number;
    expensesUsd: number;
    investmentEarningsUsd: number;
    balanceUsd: number;
    netWorthStartUsd: number;
    netWorthEndUsd: number;
    realBalanceUsd: number;
    budgetBalanceUsd: number;
    otherExpensesCurrent: number;
    otherExpensesProposed: number;
    message: string;
  }> {
    type InvLite = { id: string; type?: string; currencyId?: string | null; targetAnnualReturn?: number | null; yieldStartYear?: number | null; yieldStartMonth?: number | null };
    type SnapRow = { month: number; closingCapital?: number | null; closingCapitalUsd?: number | null; encryptedPayload?: string | null; _decryptedZero?: boolean };
    const year = mcYear;
    const m = mcMonth;
    const [incomeResp, expensesList, annualResp, invsResp] = await Promise.all([
      api<{ year: number; rows: Array<{ month: number; totalUsd?: number; encryptedPayload?: string }> }>(`/income?year=${year}`),
      api<Array<{ amountUsd?: number; encryptedPayload?: string | null }>>(`/expenses?year=${year}&month=${m}`),
      api<{ year: number; months: Array<{ month: number; otherExpensesUsd?: number; otherExpensesEncryptedPayload?: string; investmentEarningsUsd?: number; netWorthUsd?: number }> }>(`/budgets/annual?year=${year}`),
      api<InvLite[]>("/investments"),
    ]);
    let incomeUsd = 0;
    const incomeRow = (incomeResp.rows ?? []).find((r) => r.month === m);
    if (incomeRow?.encryptedPayload) {
      const pl = await decryptPayload<{ nominalUsd?: number; extraordinaryUsd?: number; taxesUsd?: number }>(incomeRow.encryptedPayload);
      if (pl) incomeUsd = (pl.nominalUsd ?? 0) + (pl.extraordinaryUsd ?? 0) - (pl.taxesUsd ?? 0);
    } else if (incomeRow) {
      incomeUsd = incomeRow.totalUsd ?? 0;
    }
    let baseExpensesUsd = 0;
    for (const e of expensesList ?? []) {
      if (e.encryptedPayload) {
        const pl = await decryptPayload<{ amountUsd?: number }>(e.encryptedPayload);
        if (pl != null && typeof pl.amountUsd === "number") baseExpensesUsd += pl.amountUsd;
      } else {
        baseExpensesUsd += e.amountUsd ?? 0;
      }
    }
    const monthData = (annualResp.months ?? []).find((x) => x.month === m);
    let otherExpensesUsd = monthData?.otherExpensesUsd ?? 0;
    if (monthData?.otherExpensesEncryptedPayload) {
      const pl = await decryptPayload<{ otherExpensesUsd?: number }>(monthData.otherExpensesEncryptedPayload);
      if (pl != null && typeof pl.otherExpensesUsd === "number") otherExpensesUsd = pl.otherExpensesUsd;
    }
    const expensesUsd = baseExpensesUsd + otherExpensesUsd;

    const invs = invsResp ?? [];
    const portfolios = invs.filter((i) => i.type === "PORTFOLIO");
    const snapsByInvId: Record<string, SnapRow[]> = {};
    for (const inv of invs) {
      type SnapshotsResp = { months?: SnapRow[]; data?: { months?: SnapRow[] } };
      const r: SnapshotsResp = await api<SnapshotsResp>(`/investments/${inv.id}/snapshots?year=${year}`).catch(() => ({ months: [] }));
      const raw = (r.months ?? r.data?.months ?? []).slice();
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
      snapsByInvId[inv.id] = filled;
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
    function capitalUsdInv(inv: InvLite, snaps: SnapRow[], monthNum: number): number {
      const idx = monthNum - 1;
      const s = snaps[idx];
      const direct = valueUsdSnap(s, inv.currencyId ?? "USD");
      if (direct != null) return direct;
      const monthlyFactor = 1 + (inv.targetAnnualReturn ?? 0) / 12;
      const yieldStart = inv.yieldStartYear != null && inv.yieldStartYear > year ? 13 : inv.yieldStartYear === year ? (inv.yieldStartMonth ?? 1) : 1;
      for (let i = monthNum - 2; i >= 0; i--) {
        const prevVal = valueUsdSnap(snaps[i], inv.currencyId ?? "USD");
        if (prevVal != null) {
          const start = Math.max(yieldStart, i + 1);
          const diff = monthNum - start;
          if (diff <= 0) return prevVal;
          return prevVal * Math.pow(monthlyFactor, diff);
        }
      }
      return 0;
    }
    const portfolioNW = Array.from({ length: 12 }, (_, i) =>
      portfolios.reduce((acc, inv) => acc + capitalUsdInv(inv, snapsByInvId[inv.id] ?? [], i + 1), 0)
    );
    const projectedNextJan = portfolios.reduce((acc, inv) => {
      const snaps = snapsByInvId[inv.id] ?? [];
      const decCap = capitalUsdInv(inv, snaps, 12);
      return acc + decCap * (1 + (inv.targetAnnualReturn ?? 0) / 12);
    }, 0);
    const totalNW = Array.from({ length: 12 }, (_, i) =>
      invs.reduce((acc, inv) => acc + capitalUsdInv(inv, snapsByInvId[inv.id] ?? [], i + 1), 0)
    );
    const movResp = await api<{ year: number; rows: Array<{ month?: number; date?: string; investmentId: string; type: string; amount?: number; currencyId?: string; encryptedPayload?: string | null }> }>(`/investments/movements?year=${year}`).catch(() => ({ rows: [] }));
    const movementRows = movResp?.rows ?? [];
    const movementsDecrypted = await Promise.all(
      movementRows.map(async (mv) => {
        let amount = mv.amount ?? 0;
        if (mv.encryptedPayload) {
          const pl = await decryptPayload<{ amount?: number }>(mv.encryptedPayload);
          if (pl != null && typeof pl.amount === "number") amount = pl.amount;
        }
        const movMonth = mv.month ?? (mv.date ? new Date(mv.date).getUTCMonth() + 1 : 0);
        return { ...mv, amount, month: movMonth };
      })
    );
    const flows = Array.from({ length: 12 }, () => 0);
    const invById = new Map(portfolios.map((i) => [i.id, i]));
    const fx = Number.isFinite(usdUyuRate) && usdUyuRate > 0 ? usdUyuRate : null;
    for (const mv of movementsDecrypted) {
      const movM = mv.month ?? 0;
      if (movM < 1 || movM > 12) continue;
      const inv = invById.get(mv.investmentId);
      if (!inv || inv.type !== "PORTFOLIO") continue;
      const sign = mv.type === "deposit" ? 1 : mv.type === "withdrawal" ? -1 : 0;
      const amount = mv.amount ?? 0;
      const cur = (mv.currencyId ?? "USD").toUpperCase();
      if (cur === "USD") flows[movM - 1] += sign * amount;
      else if (cur === "UYU" && fx) flows[movM - 1] += sign * (amount / fx);
    }
    const variation = Array.from({ length: 12 }, (_, i) =>
      i < 11 ? (portfolioNW[i + 1] ?? 0) - (portfolioNW[i] ?? 0) : projectedNextJan - (portfolioNW[11] ?? 0)
    );
    const investmentEarningsUsd = (variation[m - 1] ?? 0) - (flows[m - 1] ?? 0);
    const balanceUsd = incomeUsd - expensesUsd + investmentEarningsUsd;
    const netWorthStartUsd = totalNW[m - 1] ?? 0;
    const netWorthEndUsd = m < 12 ? (totalNW[m] ?? 0) : netWorthStartUsd + balanceUsd;
    const realBalanceUsd = netWorthEndUsd - netWorthStartUsd;
    const budgetBalanceUsd = balanceUsd;
    const otherExpensesCurrent = otherExpensesUsd;
    const otherExpensesProposed = incomeUsd + investmentEarningsUsd - realBalanceUsd - baseExpensesUsd;
    const diff = Math.abs(realBalanceUsd - budgetBalanceUsd);
    const message =
      diff < CLOSE_BALANCE_TOLERANCE_USD
        ? "El balance real y el calculado coinciden. No se ajustará Otros gastos."
        : `Balance real: ${realBalanceUsd.toFixed(2)} USD. Balance calculado (presupuesto): ${budgetBalanceUsd.toFixed(2)} USD. Se ajustará "Otros gastos" de ${otherExpensesCurrent.toFixed(2)} a ${otherExpensesProposed.toFixed(2)} USD para que cierre. ¿Confirmar cierre?`;
    return {
      incomeUsd,
      baseExpensesUsd,
      expensesUsd,
      investmentEarningsUsd,
      balanceUsd,
      netWorthStartUsd,
      netWorthEndUsd,
      realBalanceUsd,
      budgetBalanceUsd,
      otherExpensesCurrent,
      otherExpensesProposed,
      message,
    };
  }

  // ---------- Month close handlers ----------
  async function closeMonth() {
    if (closeMonthBusy) return;
    setMcError("");
    setMcInfo("");
    setClosePreviewData(null);
    setClosePreviewOpen(false);
    setCloseMonthPreparing(true);
    try {
      try {
        const preview = await api<ClosePreviewResp>(`/monthCloses/preview`, {
          method: "POST",
          body: JSON.stringify({ year: mcYear, month: mcMonth }),
        });
        // E2EE: siempre calcular valores en cliente para que el modal no muestre 0 (el servidor no puede descifrar)
        if (hasEncryptionSupport) {
          const clientPreview = await buildClosePreviewClient();
          setClosePreviewData({ ...preview, ...clientPreview });
          setClosePreviewOpen(true);
          return;
        }
        if (preview?.message != null) {
          setClosePreviewData(preview);
          setClosePreviewOpen(true);
          return;
        }
      } catch (previewErr: any) {
        // Con E2EE intentar igualmente construir y enviar el payload para no guardar 0
        if (hasEncryptionSupport) {
          try {
            await buildEncryptedSnapshotAndClose();
          } catch (buildErr: any) {
            setMcError(buildErr?.message ?? "Error closing month");
          }
          return;
        }
        await doCloseMonth();
        return;
      }
      await doCloseMonth();
    } catch (err: any) {
      setMcError(err?.message ?? "Error closing month");
    } finally {
      setCloseMonthPreparing(false);
    }
  }

  async function doCloseMonth(encryptedPayload?: string | null) {
    const body: { year: number; month: number; encryptedPayload?: string } = { year: mcYear, month: mcMonth };
    if (encryptedPayload) body.encryptedPayload = encryptedPayload;
    await api(`/monthCloses/close`, { method: "POST", body: JSON.stringify(body) });
    await loadMonthCloses(mcYear);
    setMcInfo(`Month ${m2(mcMonth)}/${mcYear} closed.`);
    showSuccess(t("admin.monthClosedSuccess"));
  }

  async function persistOtherExpenses(otherExpensesUsd: number) {
    let payload: Record<string, unknown> = { otherExpensesUsd };
    if (hasEncryptionSupport) {
      const enc = await encryptPayload({ otherExpensesUsd });
      if (enc) payload = { encryptedPayload: enc };
    }
    await api(`/budgets/other-expenses/${mcYear}/${mcMonth}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  /** Construye snapshot cifrado (ingresos, gastos, patrimonio, ganancias) y cierra el mes. Usado con E2EE. Valores siempre desde cliente. */
  async function buildEncryptedSnapshotAndClose() {
    const client = await buildClosePreviewClient();
    const shouldAdjustOtherExpenses = Math.abs(client.realBalanceUsd - client.budgetBalanceUsd) >= CLOSE_BALANCE_TOLERANCE_USD;
    const resolvedOtherExpenses = shouldAdjustOtherExpenses ? client.otherExpensesProposed : client.otherExpensesCurrent;
    const resolvedExpensesUsd = client.baseExpensesUsd + resolvedOtherExpenses;
    if (shouldAdjustOtherExpenses) {
      await persistOtherExpenses(resolvedOtherExpenses);
    }
    const snapshot = {
      incomeUsd: client.incomeUsd,
      expensesUsd: resolvedExpensesUsd,
      investmentEarningsUsd: client.investmentEarningsUsd,
      balanceUsd: shouldAdjustOtherExpenses ? client.realBalanceUsd : client.budgetBalanceUsd,
      netWorthStartUsd: client.netWorthStartUsd,
      netWorthEndUsd: client.netWorthEndUsd,
    };
    const enc = await encryptPayload(snapshot);
    if (enc) await doCloseMonth(enc);
    else await doCloseMonth();
  }

  async function confirmCloseMonth() {
    if (!closePreviewData || closeMonthBusy) return;
    setMcError("");
    setCloseMonthSubmitting(true);
    try {
      if (hasEncryptionSupport) {
        await buildEncryptedSnapshotAndClose();
      } else {
        await doCloseMonth();
      }
      setClosePreviewOpen(false);
      setClosePreviewData(null);
    } catch (err: any) {
      setMcError(err?.message ?? "Error closing month");
    } finally {
      setCloseMonthSubmitting(false);
    }
  }

  async function reopenMonth() {
    setMcError("");
    setMcInfo("");
    try {
      await api(`/monthCloses/reopen`, { method: "POST", body: JSON.stringify({ year: mcYear, month: mcMonth }) });
      await loadMonthCloses(mcYear);
      setMcInfo(t("admin.monthReopenedInfo", { month: m2(mcMonth), year: mcYear }));
      showSuccess(t("admin.monthReopenedSuccess"));
    } catch (err: any) {
      setMcError(err?.message ?? t("admin.reopenMonthError"));
    }
  }

  function goTemplates() {
    templatesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markStep1Done() {
    setOnboardingStep("expenses");
    nav(`${APP_BASE}/expenses`, { replace: false });
  }

  function skipOnboarding() {
    setOnboardingStep("done");
    nav(APP_BASE, { replace: false });
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "templates", label: t("admin.tabTemplates") },
    { id: "categories", label: t("admin.tabCategories") },
    { id: "monthClose", label: t("admin.tabMonthClose") },
    ...(isSuperAdmin ? [{ id: "users" as const, label: t("admin.tabUsers") }] : []),
    ...(isSuperAdmin ? [{ id: "campaigns" as const, label: t("admin.tabCampaigns") }] : []),
  ];

  return (
    <div className="grid admin-page">
      {/* ✅ Onboarding banner (Step 1) */}
      {onboardingActive && (
        <div className="card" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(15,23,42,0.02)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{t("onboarding.welcome")}</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 720 }}>
                {t("admin.step1BannerDesc")}
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div><span style={{ fontWeight: 900 }}>1.</span> {t("admin.step1Here")}</div>
                  <div className="muted">{t("admin.step2Muted")}</div>
                  <div className="muted">{t("admin.step3Muted")}</div>
                  <div className="muted">{t("admin.step4Muted")}</div>
                  <div className="muted">{t("admin.step5Muted")}</div>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="button" onClick={() => { setActiveTab("templates"); goTemplates(); }} style={{ height: 40 }}>
                {t("admin.goToTemplates")}
              </button>
              <button className="btn primary" type="button" onClick={markStep1Done} style={{ height: 40 }}>
                {t("admin.imDoneStep1")}
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                {t("common.skip")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="card admin-tabs" style={{ padding: 0, overflow: "hidden" }}>
        <div className="muted" style={{ fontSize: 12, padding: "10px 16px 6px", fontWeight: 600 }}>
          {t("admin.tabsHint")}
        </div>
        <div className="row admin-tabs-row" style={{ gap: 0, flexWrap: "wrap", padding: "0 12px 0 8px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={"admin-tab " + (activeTab === tab.id ? "admin-tab--active" : "")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .admin-tabs { border: 1px solid var(--border); }
        .admin-tab {
          appearance: none;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          padding: 12px 16px;
          margin-bottom: -1px;
          transition: color 0.15s, border-color 0.15s;
        }
        .admin-tab:hover { color: var(--text); }
        .admin-tab--active {
          color: var(--text);
          border-bottom-color: var(--text);
        }
        @media (max-width: 900px) {
          .admin-tabs-row {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 6px !important;
          }
          .admin-tab {
            white-space: nowrap;
            flex: 0 0 auto;
          }
        }
      `}</style>

      {/* ===== Tab: Categories (add + list in one card) ===== */}
      {activeTab === "categories" && (
      <div className="card admin-card-categories">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("admin.tabCategories")}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.categoriesIntro")}</div>
          </div>
          <button className="btn" type="button" onClick={loadAll}>
            {t("common.refresh")}
          </button>
        </div>

        <div className="admin-inner-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("admin.addCategory")}</div>
          <form onSubmit={createCategory} className="row" style={{ alignItems: "end", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", minWidth: 200 }}>
              <label className="admin-label">{t("admin.name")}</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("admin.categoryNamePlaceholder")} style={{ width: "100%", marginTop: 4 }} />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="admin-label">{t("admin.type")}</label>
              <select className="select" value={newType} onChange={(e) => setNewType(e.target.value as any)} style={{ width: "100%", marginTop: 4, height: 40 }}>
                <option value="VARIABLE">{t("expenses.typeVariable")}</option>
                <option value="FIXED">{t("expenses.typeFixed")}</option>
              </select>
            </div>
            <button className="btn primary" type="submit" style={{ height: 40 }}>
              {t("common.add")}
            </button>
          </form>
          {catError && <div className="admin-message admin-message--error" style={{ marginTop: 10 }}>{catError}</div>}
          {catInfo && <div className="admin-message admin-message--info" style={{ marginTop: 10 }}>{catInfo}</div>}
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t("admin.yourCategories")}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t("admin.yourCategoriesSub")}</div>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{t("admin.categoryCount", { count: categories.length })}</span>
          </div>

          {isMobile ? (
            <div className="admin-mobile-card-list">
              {categories.map((c) => {
                const isEditing = editingId === c.id;

                return (
                  <div key={c.id} className="admin-mobile-card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {isEditing ? (
                            <input
                              className="input"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                          ) : (
                            getCategoryDisplayName(c, t)
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {isEditing ? (
                            <select className="select" value={editType} onChange={(e) => setEditType(e.target.value as any)} style={{ marginTop: 6 }}>
                              <option value="VARIABLE">{t("expenses.typeVariable")}</option>
                              <option value="FIXED">{t("expenses.typeFixed")}</option>
                            </select>
                          ) : (
                            getExpenseTypeLabel(c.expenseType, t)
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="row admin-mobile-actions" style={{ marginTop: 12, gap: 10 }}>
                      {isEditing ? (
                        <>
                          <button className="btn primary" type="button" onClick={saveEdit}>
                            {t("common.save")}
                          </button>
                          <button className="btn" type="button" onClick={cancelEdit}>
                            {t("common.cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn" type="button" onClick={() => startEdit(c)}>
                            {t("admin.edit")}
                          </button>
                          <button className="btn danger" type="button" onClick={() => removeCategory(c.id)}>
                            {t("common.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="muted" style={{ padding: 12, textAlign: "center" }}>{t("admin.noCategoriesYet")}</div>
              )}
            </div>
          ) : (
          <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>{t("admin.name")}</th>
                <th style={{ width: 160 }}>{t("admin.type")}</th>
                <th style={{ width: 240 }} className="right">{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const isEditing = editingId === c.id;

                return (
                  <tr key={c.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="input compact"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        getCategoryDisplayName(c, t)
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select className="select" value={editType} onChange={(e) => setEditType(e.target.value as any)} style={{ height: 34 }}>
                          <option value="VARIABLE">{t("expenses.typeVariable")}</option>
                          <option value="FIXED">{t("expenses.typeFixed")}</option>
                        </select>
                      ) : (
                        <span className="muted">{getExpenseTypeLabel(c.expenseType, t)}</span>
                      )}
                    </td>

                    <td className="right">
                      {isEditing ? (
                        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                          <button className="btn primary" type="button" onClick={saveEdit} style={{ height: 34 }}>
                            {t("common.save")}
                          </button>
                          <button className="btn" type="button" onClick={cancelEdit} style={{ height: 34 }}>
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                          <button className="btn" type="button" onClick={() => startEdit(c)} style={{ height: 34 }}>
                            {t("admin.edit")}
                          </button>
                          <button className="btn danger" type="button" onClick={() => removeCategory(c.id)} style={{ height: 34 }}>
                            {t("common.delete")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("admin.noCategoriesYet")}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          )}
        </div>
      </div>
      )}

      {/* ===== Tab: Month Close ===== */}
      {activeTab === "monthClose" && (
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 900 }}>{t("admin.tabMonthClose")}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.monthCloseIntro")}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.year")}</div>
            <input
              className="input"
              type="number"
              value={mcYear}
              disabled={closeMonthBusy}
              onChange={(e) => setMcYear(Number(e.target.value))}
              style={{ width: 120, height: 42 }}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.month")}</div>
            <select
              className="select"
              value={mcMonth}
              disabled={closeMonthBusy}
              onChange={(e) => setMcMonth(Number(e.target.value))}
              style={{ width: 120, height: 42 }}
            >
              {months.map((m) => (
                <option key={m} value={m}>{m2(m)}</option>
              ))}
            </select>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            {t("admin.status")}:{" "}
            <span style={{ fontWeight: 850, color: isSelectedClosed ? "var(--text)" : "var(--muted)" }}>
              {isSelectedClosed ? t("common.closed") : t("common.open")}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {isSelectedClosed ? (
            <button className="btn" type="button" onClick={reopenMonth} disabled={closeMonthBusy} style={{ height: 42 }}>
              {t("admin.reopen")}
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={closeMonth} disabled={closeMonthBusy} style={{ height: 42 }}>
              {closeMonthBusy ? t("admin.closeMonthConfirmLoading") : t("admin.closeMonth")}
              </button>
          )}
        </div>

        {mcError && <div style={{ marginTop: 12, color: "var(--danger)" }}>{mcError}</div>}
        {mcInfo && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{mcInfo}</div>}
        {closeMonthBusy && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(37, 99, 235, 0.08)",
              color: "rgba(15,23,42,0.8)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {t("admin.closeMonthProcessing")}
          </div>
        )}

        {isSelectedClosed && selectedClose && (
          isMobile ? (
            <div className="admin-mobile-card-list" style={{ marginTop: 12 }}>
              {[
                { label: t("budgets.income"), value: formatAmountUsd(selectedClose.incomeUsd) },
                { label: t("budgets.expensesCol"), value: formatAmountUsd(selectedClose.expensesUsd) },
                { label: t("budgets.investmentEarnings"), value: formatAmountUsd(selectedClose.investmentEarningsUsd) },
                { label: t("budgets.balance"), value: formatAmountUsd(selectedClose.balanceUsd) },
                { label: t("budgets.netWorthStart"), value: formatAmountUsd(selectedClose.netWorthStartUsd) },
              ].map((item) => (
                <div key={item.label} className="admin-mobile-card admin-mobile-card--compact">
                  <span className="muted" style={{ fontSize: 12 }}>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>{t("admin.closePreviewConcept")}</th>
                    <th className="right">{t("admin.closePreviewValue")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>{t("budgets.income")}</td><td className="right">{formatAmountUsd(selectedClose.incomeUsd)}</td></tr>
                  <tr><td>{t("budgets.expensesCol")}</td><td className="right">{formatAmountUsd(selectedClose.expensesUsd)}</td></tr>
                  <tr><td>{t("budgets.investmentEarnings")}</td><td className="right">{formatAmountUsd(selectedClose.investmentEarningsUsd)}</td></tr>
                  <tr><td>{t("budgets.balance")}</td><td className="right">{formatAmountUsd(selectedClose.balanceUsd)}</td></tr>
                  <tr><td>{t("budgets.netWorthStart")}</td><td className="right">{formatAmountUsd(selectedClose.netWorthStartUsd)}</td></tr>
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      )}

      {/* Modal: Cierre de mes (preview) */}
      {closePreviewOpen && closePreviewData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-preview-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            if (!closeMonthBusy) setClosePreviewOpen(false);
          }}
        >
          <div
            className="card"
            id="close-preview-title"
            style={{ maxWidth: 480, width: "100%", ...(isMobile ? { marginTop: "auto", borderRadius: "18px 18px 0 0", maxHeight: "78vh", overflow: "auto" } : {}) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>{t("admin.closeMonthTitle")}</div>
            <div style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
              <Trans
                i18nKey="admin.closeMonthPreviewP1"
                values={{
                  netWorthEndUsd: formatAmountUsd(closePreviewData.netWorthEndUsd),
                  netWorthStartUsd: formatAmountUsd(closePreviewData.netWorthStartUsd),
                  realBalanceUsd: formatAmountUsd(closePreviewData.realBalanceUsd),
                }}
                components={{ 1: <strong /> }}
              />
              <br /><br />
              <Trans
                i18nKey="admin.closeMonthPreviewP2"
                values={{
                  budgetTitle: t("budgets.title"),
                  budgetBalanceUsd: formatAmountUsd(closePreviewData.budgetBalanceUsd),
                  differenceUsd: formatAmountUsd(closePreviewData.realBalanceUsd - closePreviewData.budgetBalanceUsd),
                }}
                components={{ 1: <strong /> }}
              />
              <br /><br />
              {Math.abs((closePreviewData.realBalanceUsd ?? 0) - (closePreviewData.budgetBalanceUsd ?? 0)) < CLOSE_BALANCE_TOLERANCE_USD
                ? t("admin.closeMonthPreviewP3NoAdjust")
                : t("admin.closeMonthPreviewP3")}
            </div>
            {closeMonthBusy && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(34,197,94,0.08)",
                  color: "rgba(15,23,42,0.8)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                {t("admin.closeMonthProcessing")}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={closeMonthBusy} onClick={() => setClosePreviewOpen(false)}>
                {t("admin.closeMonthCancel")}
              </button>
              <button type="button" className="btn primary" disabled={closeMonthBusy} onClick={confirmCloseMonth}>
                {closeMonthBusy ? t("admin.closeMonthConfirmLoading") : t("admin.closeMonthConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Tab: Users (super admin only) ===== */}
      {activeTab === "users" && isSuperAdmin && (
      <>
      <div className="card">
        <UsersAdminCard />
      </div>
      <RecentActivityCard />
      </>
      )}

      {activeTab === "campaigns" && isSuperAdmin && (
      <div className="card">
        <CampaignsAdminCard />
      </div>
      )}

      {/* ===== Tab: Templates ===== */}
      {activeTab === "templates" && (
      <div className="card">
        <ExpenseTemplatesAdminCard categories={categories} onboardingActive={onboardingActive} onScrollTargetRef={templatesRef} />
      </div>
      )}

      <style>{`
        .admin-page .admin-inner-card {
          background: var(--brand-green-light);
          border: 1px solid var(--brand-green-border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
        }
        .admin-page .admin-label {
          display: block;
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 2px;
        }
        .admin-page .admin-edit-card {
          background: rgba(15,23,42,0.02);
          border: 1px solid var(--border);
          border-left: 4px solid var(--brand-green);
          border-radius: var(--radius-md);
          padding: 14px 16px;
        }
        .admin-page .admin-table-wrap {
          overflow-x: auto;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }
        .admin-page .admin-table {
          width: 100%;
          border-collapse: collapse;
        }
        .admin-page .admin-table th,
        .admin-page .admin-table td {
          padding: 10px 12px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
        }
        .admin-page .admin-table th {
          background: var(--brand-green-light);
          border-bottom: 2px solid var(--brand-green-border);
          font-weight: 700;
          text-align: left;
        }
        .admin-page .admin-table th.right { text-align: right; }
        .admin-page .admin-table tbody tr:hover {
          background: rgba(34, 197, 94, 0.04);
        }
        .admin-page .admin-table tbody tr:last-child td { border-bottom: none; }
        .admin-page .admin-message--error { color: var(--danger); font-size: 13px; }
        .admin-page .admin-message--info { color: rgba(15,23,42,0.75); font-size: 13px; }
        .admin-page .admin-onb-callout {
          border: 1px solid var(--brand-green-border);
          background: var(--brand-green-light);
          border-radius: var(--radius-md);
          padding: 12px 14px;
        }
        .admin-page .admin-table .input.compact,
        .admin-page .admin-table .select { padding: 6px 8px; border-radius: var(--radius-sm); font-size: 12px; }
        .admin-page .admin-mobile-card-list {
          display: grid;
          gap: 10px;
        }
        .admin-page .admin-mobile-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px;
          background: rgba(248,250,252,0.78);
        }
        .admin-page .admin-mobile-card--compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .admin-page .admin-mobile-actions .btn {
          flex: 1 1 0;
        }
        @media (max-width: 900px) {
          .admin-page .admin-inner-card {
            padding: 12px;
          }
          .admin-page .admin-table-wrap {
            margin-left: -6px;
            margin-right: -6px;
          }
        }
      `}</style>
    </div>
  );
}
