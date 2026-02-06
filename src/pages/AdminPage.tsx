import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppShell, useAppYearMonth } from "../layout/AppShell";

type ExpenseType = "FIXED" | "VARIABLE";
type Category = { id: string; name: string; expenseType: ExpenseType };

type MonthCloseRow = {
  id: string;
  year: number;
  month: number;
  incomeUsd: number;
  expensesUsd: number;
  investmentEarningsUsd: number;
  balanceUsd: number;
  netWorthStartUsd: number;
  closedAt: string;
};

type ClosePreviewResp = {
  realBalanceUsd: number;
  budgetBalanceUsd: number;
  otherExpensesCurrent: number;
  otherExpensesProposed: number;
  netWorthStartUsd: number;
  netWorthEndUsd: number;
  message: string;
};

type MeResp = { id: string; email: string; role: "USER" | "SUPER_ADMIN" };
type UserRow = { id: string; email: string; role: "USER" | "SUPER_ADMIN"; createdAt: string };

type ExpenseTemplateRow = {
  id: string;
  expenseType: ExpenseType;
  categoryId: string;
  description: string;
  defaultAmountUsd: number | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; expenseType?: ExpenseType };
};

const usd0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const m2 = (m: number) => String(m).padStart(2, "0");

/* ---------------------------------------------------------
   Shared helpers
--------------------------------------------------------- */

function editNumberOrNull(v: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------------------------------------------------------
   Change password card
--------------------------------------------------------- */

function ChangePasswordCard({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/admin/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMsg(t("admin.passwordUpdated"));
      onDone?.();
    } catch (err: any) {
      setMsg(err?.message ?? t("common.error"));
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("admin.changePassword")}</div>

      <form onSubmit={submit} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {t("admin.currentPassword")}
          </div>
          <input
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {t("admin.newPassword")}
          </div>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>

        <button className="btn primary" type="submit" style={{ height: 42 }}>
          {t("admin.update")}
        </button>
      </form>

      {msg && (
        <div
          style={{
            marginTop: 10,
            color: msg.toLowerCase().includes("updated") ? "rgba(15,23,42,0.75)" : "var(--danger)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
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

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "SUPER_ADMIN">("USER");
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
        body: JSON.stringify({ email, password, role }),
      });
      setEmail("");
      setPassword("");
      setRole("USER");
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

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="table compact">
          <thead>
            <tr>
              <th>{t("admin.email")}</th>
              <th style={{ width: 140 }}>{t("admin.role")}</th>
              <th style={{ width: 160 }}>{t("admin.created")}</th>
              <th className="right" style={{ width: 220 }}>{t("expenses.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
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
                <td colSpan={4} className="muted">
                  {t("admin.noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .table.compact th, .table.compact td { padding: 6px 8px; }
      `}</style>
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
  const { showSuccess } = useAppShell();
  const [rows, setRows] = useState<ExpenseTemplateRow[]>([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [expenseType, setExpenseType] = useState<ExpenseType>("VARIABLE");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState<string>("Rent");
  const [defaultAmountUsd, setDefaultAmountUsd] = useState<string>("");

  const [editing, setEditing] = useState<ExpenseTemplateRow | null>(null);
  const [editExpenseType, setEditExpenseType] = useState<ExpenseType>("VARIABLE");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editDefaultAmountUsd, setEditDefaultAmountUsd] = useState<string>("");

  const catsByType = useMemo(() => {
    const fixed = categories.filter((c) => c.expenseType === "FIXED");
    const variable = categories.filter((c) => c.expenseType === "VARIABLE");
    return { fixed, variable };
  }, [categories]);

  async function loadTemplates() {
    setErr("");
    setInfo("");
    const r = await api<{ rows: ExpenseTemplateRow[] }>("/admin/expenseTemplates");
    setRows(r.rows ?? []);
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
    const pick = categories.find((c) => c.expenseType === expenseType);
    if (pick) setCategoryId(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseType]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");

    const desc = description.trim();
    if (!desc) return setErr(t("admin.descriptionRequired"));
    if (!categoryId) return setErr(t("admin.categoryRequired"));

    const amt = editNumberOrNull(defaultAmountUsd);

    try {
      await api("/admin/expenseTemplates", {
        method: "POST",
        body: JSON.stringify({
          expenseType,
          categoryId,
          description: desc,
          defaultAmountUsd: amt,
        }),
      });

      setDescription("");
      setDefaultAmountUsd("");
      await loadTemplates();
      setInfo(t("admin.templateCreatedInfo"));
      showSuccess(t("admin.templateCreated"));
    } catch (e: any) {
      setErr(e?.message ?? t("admin.errorCreatingTemplate"));
    }
  }

  function startEdit(row: ExpenseTemplateRow) {
    setEditing(row);
    setEditExpenseType(row.expenseType);
    setEditCategoryId(row.categoryId);
    setEditDescription(row.description);
    setEditDefaultAmountUsd(row.defaultAmountUsd == null ? "" : String(Math.round(row.defaultAmountUsd)));
    setErr("");
    setInfo("");
  }

  function cancelEdit() {
    setEditing(null);
    setEditDefaultAmountUsd("");
  }

  async function saveEdit() {
    if (!editing) return;
    setErr("");
    setInfo("");

    const desc = editDescription.trim();
    if (!desc) return setErr(t("admin.descriptionRequired"));
    if (!editCategoryId) return setErr(t("admin.categoryRequired"));

    const amt = editNumberOrNull(editDefaultAmountUsd);

    try {
      await api(`/admin/expenseTemplates/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          expenseType: editExpenseType,
          categoryId: editCategoryId,
          description: desc,
          defaultAmountUsd: amt,
        }),
      });

      setEditing(null);
      await loadTemplates();
      setInfo("Template updated (planned drafts synced for open months of current year).");
      showSuccess("Template updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Error updating template");
    }
  }

  async function del(id: string) {
    setErr("");
    setInfo("");
    if (!confirm(t("admin.deleteTemplate"))) return;

    try {
      await api(`/admin/expenseTemplates/${id}`, { method: "DELETE" });
      await loadTemplates();
      setInfo("Template deleted.");
      showSuccess("Template deleted.");
    } catch (e: any) {
      setErr(e?.message ?? "Error deleting template");
    }
  }

  const fixedRows = rows.filter((r) => r.expenseType === "FIXED");
  const variableRows = rows.filter((r) => r.expenseType === "VARIABLE");

  const showOnbCallout = onboardingActive;

  return (
    <div className="admin-card-templates" style={{ marginTop: 0 }} ref={onScrollTargetRef}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900 }}>{t("admin.tabTemplates")}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.templatesIntro")}</div>
        </div>
        <button className="btn" type="button" onClick={loadTemplates}>
          {t("common.refresh")}
        </button>
      </div>

      {showOnbCallout && (
        <div className="admin-onb-callout" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>{t("admin.step1Title")}</div>
          <div className="muted" style={{ fontSize: 13 }}>{t("admin.templatesDesc")}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Tip: Start with 2–5 fixed expenses and 2–5 variable ones.
          </div>
        </div>
      )}

      <div className="admin-inner-card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("admin.create")} {t("admin.expenseTemplates").toLowerCase()}</div>
        <form onSubmit={create} className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 140 }}>
            <label className="admin-label">{t("admin.type")}</label>
            <select className="select" value={expenseType} onChange={(e) => setExpenseType(e.target.value as any)} style={{ width: "100%", marginTop: 4, height: 40 }}>
              <option value="FIXED">FIXED</option>
              <option value="VARIABLE">VARIABLE</option>
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="admin-label">{t("admin.category")}</label>
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: "100%", marginTop: 4, height: 40 }}>
              {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).length === 0 && (
                <option value="" disabled>{t("admin.noCategoriesOfThisType")}</option>
              )}
            </select>
          </div>
          <div style={{ flex: "1 1 200px", minWidth: 200 }}>
            <label className="admin-label">{t("admin.description")}</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent" style={{ width: "100%", marginTop: 4 }} />
          </div>
          <div style={{ minWidth: 120 }}>
            <label className="admin-label">{t("admin.defaultAmountUsd")}</label>
            <input className="input" type="number" value={defaultAmountUsd} onChange={(e) => setDefaultAmountUsd(e.target.value)} placeholder={t("admin.optionalPlaceholder")} style={{ width: "100%", marginTop: 4, height: 40 }} />
          </div>
          <button className="btn primary" type="submit" style={{ height: 40 }}>{t("admin.create")}</button>
        </form>
        {err && <div className="admin-message admin-message--error" style={{ marginTop: 10 }}>{err}</div>}
        {info && <div className="admin-message admin-message--info" style={{ marginTop: 10 }}>{info}</div>}
      </div>

      {editing && (
        <div className="admin-edit-card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{t("admin.editTemplate")}</div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ minWidth: 140 }}>
              <label className="admin-label">{t("admin.type")}</label>
              <select className="select" value={editExpenseType} onChange={(e) => setEditExpenseType(e.target.value as any)} style={{ width: "100%", marginTop: 4, height: 40 }}>
                <option value="FIXED">FIXED</option>
                <option value="VARIABLE">VARIABLE</option>
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="admin-label">{t("admin.category")}</label>
              <select className="select" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} style={{ width: "100%", marginTop: 4, height: 40 }}>
                {(editExpenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 200 }}>
              <label className="admin-label">{t("admin.description")}</label>
              <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="admin-label">{t("admin.defaultAmountUsd")}</label>
              <input className="input" type="number" value={editDefaultAmountUsd} onChange={(e) => setEditDefaultAmountUsd(e.target.value)} placeholder={t("admin.optionalPlaceholder")} style={{ width: "100%", marginTop: 4, height: 40 }} />
            </div>
            <button className="btn primary" type="button" onClick={saveEdit} style={{ height: 40 }}>{t("common.save")}</button>
            <button className="btn" type="button" onClick={cancelEdit} style={{ height: 40 }}>{t("common.cancel")}</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t("admin.templateNote")}</div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="muted" style={{ fontSize: 12 }}>{t("admin.templateFixedVariable", { fixed: fixedRows.length, variable: variableRows.length })}</div>
        </div>
        <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t("expenses.type")}</th>
                <th style={{ width: 220 }}>{t("expenses.category")}</th>
                <th>{t("expenses.description")}</th>
                <th className="right" style={{ width: 180 }}>{t("admin.defaultUsd")}</th>
                <th className="right" style={{ width: 220 }}>{t("expenses.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{row.expenseType}</td>
                  <td>{row.category?.name ?? row.categoryId}</td>
                  <td>{row.description}</td>
                  <td className="right">{row.defaultAmountUsd == null ? <span className="muted">—</span> : usd0.format(row.defaultAmountUsd)}</td>
                  <td className="right">
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                      <button className="btn" type="button" onClick={() => startEdit(row)} style={{ height: 32 }}>{t("admin.edit")}</button>
                      <button className="btn danger" type="button" onClick={() => del(row.id)} style={{ height: 32 }}>{t("common.delete")}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("admin.noTemplatesYet")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
type RecentActivityResp = {
  recentUsers: RecentUser[];
  recentVerificationCodes: RecentCode[];
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

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me, showSuccess } = useAppShell();
  const { year: appYear } = useAppYearMonth();

  const [meResp, setMeResp] = useState<MeResp | null>(null);
  const [meError, setMeError] = useState<string>("");

  const isSuperAdmin = meResp?.role === "SUPER_ADMIN";

  type AdminTab = "account" | "categories" | "templates" | "monthClose" | "users";
  const [activeTab, setActiveTab] = useState<AdminTab>("categories");

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
  const [mcError, setMcError] = useState("");
  const [mcInfo, setMcInfo] = useState("");
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [closePreviewData, setClosePreviewData] = useState<ClosePreviewResp | null>(null);

  const closedSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of monthCloses) s.add(`${r.year}-${r.month}`);
    return s;
  }, [monthCloses]);

  const selectedClose = useMemo(() => {
    return monthCloses.find((r) => r.year === mcYear && r.month === mcMonth) ?? null;
  }, [monthCloses, mcYear, mcMonth]);

  const isSelectedClosed = closedSet.has(`${mcYear}-${mcMonth}`);

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
    setMonthCloses(r.rows ?? []);
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
          ? "This category has expenses linked. Remove or reassign those expenses first."
          : msg
      );
    }
  }

  // ---------- Month close handlers ----------
  async function closeMonth() {
    setMcError("");
    setMcInfo("");
    setClosePreviewData(null);
    setClosePreviewOpen(false);
    try {
      try {
        const preview = await api<ClosePreviewResp>(`/monthCloses/preview`, {
          method: "POST",
          body: JSON.stringify({ year: mcYear, month: mcMonth }),
        });
        if (preview?.message != null) {
          setClosePreviewData(preview);
          setClosePreviewOpen(true);
          return;
        }
      } catch (previewErr: any) {
        // 403 o error → cerrar sin modal (comportamiento anterior)
        await doCloseMonth();
        return;
      }
      await doCloseMonth();
    } catch (err: any) {
      setMcError(err?.message ?? "Error closing month");
    }
  }

  async function doCloseMonth() {
    await api(`/monthCloses/close`, { method: "POST", body: JSON.stringify({ year: mcYear, month: mcMonth }) });
    await loadMonthCloses(mcYear);
    setMcInfo(`Month ${m2(mcMonth)}/${mcYear} closed.`);
    showSuccess(t("admin.monthClosedSuccess"));
  }

  async function confirmCloseMonth() {
    if (!closePreviewData) return;
    setMcError("");
    try {
      await doCloseMonth();
      setClosePreviewOpen(false);
      setClosePreviewData(null);
    } catch (err: any) {
      setMcError(err?.message ?? "Error closing month");
    }
  }

  async function reopenMonth() {
    setMcError("");
    setMcInfo("");
    try {
      await api(`/monthCloses/reopen`, { method: "POST", body: JSON.stringify({ year: mcYear, month: mcMonth }) });
      await loadMonthCloses(mcYear);
      setMcInfo(`Month ${m2(mcMonth)}/${mcYear} reopened.`);
      showSuccess("Month reopened.");
    } catch (err: any) {
      setMcError(err?.message ?? "Error reopening month");
    }
  }

  function goTemplates() {
    templatesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markStep1Done() {
    setOnboardingStep("expenses");
    nav("/expenses", { replace: false });
  }

  function skipOnboarding() {
    setOnboardingStep("done");
    nav("/", { replace: false });
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "categories", label: t("admin.tabCategories") },
    { id: "templates", label: t("admin.tabTemplates") },
    { id: "monthClose", label: t("admin.tabMonthClose") },
    { id: "account", label: t("admin.tabAccount") },
    ...(isSuperAdmin ? [{ id: "users" as const, label: t("admin.tabUsers") }] : []),
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
        <div className="row" style={{ gap: 0, flexWrap: "wrap", padding: "0 12px 0 8px" }}>
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
      `}</style>

      {/* ===== Tab: Account ===== */}
      {activeTab === "account" && (
      <div className="card">
        <div style={{ fontWeight: 900 }}>{t("admin.tabAccount")}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("admin.accountIntro")}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          {meResp ? `${t("admin.signedInAs")}: ${meResp.email} (${meResp.role})` : t("admin.loadingUser")}
        </div>
        {meError && <div style={{ marginTop: 10, color: "var(--danger)" }}>{meError}</div>}
        <ChangePasswordCard />
      </div>
      )}

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
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Supermarket" style={{ width: "100%", marginTop: 4 }} />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="admin-label">{t("admin.type")}</label>
              <select className="select" value={newType} onChange={(e) => setNewType(e.target.value as any)} style={{ width: "100%", marginTop: 4, height: 40 }}>
                <option value="VARIABLE">VARIABLE</option>
                <option value="FIXED">FIXED</option>
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
                        c.name
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <select className="select" value={editType} onChange={(e) => setEditType(e.target.value as any)} style={{ height: 34 }}>
                          <option value="VARIABLE">VARIABLE</option>
                          <option value="FIXED">FIXED</option>
                        </select>
                      ) : (
                        <span className="muted">{c.expenseType}</span>
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
            <input className="input" type="number" value={mcYear} onChange={(e) => setMcYear(Number(e.target.value))} style={{ width: 120, height: 42 }} />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("admin.month")}</div>
            <select className="select" value={mcMonth} onChange={(e) => setMcMonth(Number(e.target.value))} style={{ width: 120, height: 42 }}>
              {months.map((m) => (
                <option key={m} value={m}>{m2(m)}</option>
              ))}
            </select>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            Status:{" "}
            <span style={{ fontWeight: 850, color: isSelectedClosed ? "var(--text)" : "var(--muted)" }}>
              {isSelectedClosed ? "Closed" : "Open"}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {isSelectedClosed ? (
            <button className="btn" type="button" onClick={reopenMonth} style={{ height: 42 }}>
              {t("admin.reopen")}
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={closeMonth} style={{ height: 42 }}>
{t("admin.closeMonth")}
              </button>
          )}
        </div>

        {mcError && <div style={{ marginTop: 12, color: "var(--danger)" }}>{mcError}</div>}
        {mcInfo && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{mcInfo}</div>}

        {selectedClose && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="table compact">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Income</td><td className="right">{usd0.format(selectedClose.incomeUsd)}</td></tr>
                <tr><td>Expenses</td><td className="right">{usd0.format(selectedClose.expensesUsd)}</td></tr>
                <tr><td>Investment earnings</td><td className="right">{usd0.format(selectedClose.investmentEarningsUsd)}</td></tr>
                <tr><td>Balance</td><td className="right">{usd0.format(selectedClose.balanceUsd)}</td></tr>
                <tr><td>Total net worth (start)</td><td className="right">{usd0.format(selectedClose.netWorthStartUsd)}</td></tr>
              </tbody>
            </table>
          </div>
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
          onClick={() => setClosePreviewOpen(false)}
        >
          <div
            className="card"
            id="close-preview-title"
            style={{ maxWidth: 480, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Cierre de mes</div>
            <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
              Estás cerrando el mes con un patrimonio real de <strong>{usd0.format(closePreviewData.netWorthEndUsd)} USD</strong>, habiéndolo
              comenzado con <strong>{usd0.format(closePreviewData.netWorthStartUsd)} USD</strong>, lo que da un balance de{" "}
              <strong>{usd0.format(closePreviewData.realBalanceUsd)} USD</strong> (patrimonio final − inicial).
              <br /><br />
              El balance calculado en Budget en base a tus ingresos y gastos da{" "}
              <strong>{usd0.format(closePreviewData.budgetBalanceUsd)} USD</strong>, lo que tiene una diferencia de{" "}
              <strong>{usd0.format(closePreviewData.realBalanceUsd - closePreviewData.budgetBalanceUsd)} USD</strong> con el balance real.
              <br /><br />
              Se ajustará &quot;Otros gastos&quot; del mes para que cierre. ¿Quieres avanzar?
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => setClosePreviewOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={confirmCloseMonth}>
                Sí, avanzar
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

      {/* ===== Tab: Templates ===== */}
      {activeTab === "templates" && (
      <div className="card">
        <ExpenseTemplatesAdminCard categories={categories} onboardingActive={onboardingActive} onScrollTargetRef={templatesRef} />
      </div>
      )}

      <style>{`
        .admin-page .admin-inner-card {
          background: rgba(15,23,42,0.03);
          border: 1px solid var(--border);
          border-radius: 12px;
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
          border-left: 3px solid var(--text);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .admin-page .admin-table-wrap {
          overflow-x: auto;
          border-radius: 10px;
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
          background: rgba(15,23,42,0.04);
          font-weight: 700;
          text-align: left;
        }
        .admin-page .admin-table th.right { text-align: right; }
        .admin-page .admin-table tbody tr:hover {
          background: rgba(15,23,42,0.02);
        }
        .admin-page .admin-table tbody tr:last-child td { border-bottom: none; }
        .admin-page .admin-message--error { color: var(--danger); font-size: 13px; }
        .admin-page .admin-message--info { color: rgba(15,23,42,0.75); font-size: 13px; }
        .admin-page .admin-onb-callout {
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .admin-page .admin-table .input.compact,
        .admin-page .admin-table .select { padding: 6px 8px; border-radius: 8px; font-size: 12px; }
      `}</style>
    </div>
  );
}