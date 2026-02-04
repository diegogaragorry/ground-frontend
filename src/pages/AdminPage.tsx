import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      setMsg("Password updated.");
      onDone?.();
    } catch (err: any) {
      setMsg(err?.message ?? "Error");
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Change your password</div>

      <form onSubmit={submit} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Current password
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
            New password
          </div>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>

        <button className="btn primary" type="submit" style={{ height: 42 }}>
          Update
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
    loadUsers().catch((e: any) => setErr(e?.message ?? "Error"));
  }, []);

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
      setInfo("User created.");
    } catch (e: any) {
      setErr(e?.message ?? "Error creating user");
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
      setInfo("User updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Error updating user");
    }
  }

  async function del(id: string) {
    setErr("");
    setInfo("");
    if (!confirm("Delete this user?")) return;

    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      await loadUsers();
      setInfo("User deleted.");
    } catch (e: any) {
      setErr(e?.message ?? "Error deleting user");
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 800 }}>Users</div>
          <div className="muted" style={{ fontSize: 12 }}>Create, edit, delete users • reset passwords</div>
        </div>
        <button className="btn" type="button" onClick={loadUsers}>
          Refresh
        </button>
      </div>

      <form onSubmit={create} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
        <div style={{ minWidth: 260 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@email.com" />
        </div>

        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Password</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div style={{ minWidth: 180 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Role</div>
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as any)} style={{ height: 42 }}>
            <option value="USER">USER</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>

        <button className="btn primary" type="submit" style={{ height: 42 }}>
          Create
        </button>
      </form>

      {err && <div style={{ marginTop: 12, color: "var(--danger)" }}>{err}</div>}
      {info && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{info}</div>}

      {editing && (
        <div className="card" style={{ marginTop: 12, padding: 12, background: "rgba(15,23,42,0.03)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Edit user</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ minWidth: 260 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Email</div>
              <input className="input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>

            <div style={{ minWidth: 180 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Role</div>
              <select className="select" value={editRole} onChange={(e) => setEditRole(e.target.value as any)} style={{ height: 42 }}>
                <option value="USER">USER</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>

            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>New password (optional)</div>
              <input className="input" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>

            <button className="btn primary" type="button" onClick={saveEdit} style={{ height: 42 }}>
              Save
            </button>

            <button className="btn" type="button" onClick={() => setEditing(null)} style={{ height: 42 }}>
              Cancel
            </button>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Tip: If password is blank, it won’t be changed.
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="table compact">
          <thead>
            <tr>
              <th>Email</th>
              <th style={{ width: 140 }}>Role</th>
              <th style={{ width: 160 }}>Created</th>
              <th className="right" style={{ width: 220 }}>Actions</th>
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
                      Edit
                    </button>
                    <button className="btn danger" type="button" onClick={() => del(u.id)} style={{ height: 34 }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No users.
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
    loadTemplates().catch((e: any) => setErr(e?.message ?? "Error"));
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
    if (!desc) return setErr("Description is required");
    if (!categoryId) return setErr("Category is required");

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
      setInfo("Template created (planned drafts generated for open months of current year).");
    } catch (e: any) {
      setErr(e?.message ?? "Error creating template");
    }
  }

  function startEdit(t: ExpenseTemplateRow) {
    setEditing(t);
    setEditExpenseType(t.expenseType);
    setEditCategoryId(t.categoryId);
    setEditDescription(t.description);
    setEditDefaultAmountUsd(t.defaultAmountUsd == null ? "" : String(Math.round(t.defaultAmountUsd)));
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
    if (!desc) return setErr("Description is required");
    if (!editCategoryId) return setErr("Category is required");

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
    } catch (e: any) {
      setErr(e?.message ?? "Error updating template");
    }
  }

  async function del(id: string) {
    setErr("");
    setInfo("");
    if (!confirm("Delete this template?")) return;

    try {
      await api(`/admin/expenseTemplates/${id}`, { method: "DELETE" });
      await loadTemplates();
      setInfo("Template deleted.");
    } catch (e: any) {
      setErr(e?.message ?? "Error deleting template");
    }
  }

  const fixedRows = rows.filter((r) => r.expenseType === "FIXED");
  const variableRows = rows.filter((r) => r.expenseType === "VARIABLE");

  const showOnbCallout = onboardingActive;

  return (
    <div style={{ marginTop: 14 }} ref={onScrollTargetRef}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Expense templates</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Configure recurring expenses • When you create/update a template, drafts are generated/synced for open months of current year
          </div>
        </div>
        <button className="btn" type="button" onClick={loadTemplates}>
          Refresh
        </button>
      </div>

      {showOnbCallout && (
        <div className="onb-callout" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Step 1 — Review templates & categories</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Create (or edit) your base templates (e.g. Rent, Utilities). This will generate drafts you can confirm in Expenses.
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Tip: Start with 2–5 fixed expenses and 2–5 variable ones.
          </div>
        </div>
      )}

      <form onSubmit={create} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end", marginTop: 10 }}>
        <div style={{ minWidth: 180 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
          <select className="select" value={expenseType} onChange={(e) => setExpenseType(e.target.value as any)} style={{ height: 42 }}>
            <option value="FIXED">FIXED</option>
            <option value="VARIABLE">VARIABLE</option>
          </select>
        </div>

        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Category</div>
          <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ height: 42 }}>
            {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {(expenseType === "FIXED" ? catsByType.fixed : catsByType.variable).length === 0 && (
              <option value="" disabled>
                No categories of this type
              </option>
            )}
          </select>
        </div>

        <div style={{ minWidth: 260, flex: 1 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Description</div>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Rent" />
        </div>

        <div style={{ minWidth: 200 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Default amount (USD)</div>
          <input
            className="input"
            type="number"
            value={defaultAmountUsd}
            onChange={(e) => setDefaultAmountUsd(e.target.value)}
            placeholder="optional"
          />
        </div>

        <button className="btn primary" type="submit" style={{ height: 42 }}>
          Create
        </button>
      </form>

      {err && <div style={{ marginTop: 12, color: "var(--danger)" }}>{err}</div>}
      {info && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{info}</div>}

      {editing && (
        <div className="card" style={{ marginTop: 12, padding: 12, background: "rgba(15,23,42,0.03)" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Edit template</div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ minWidth: 180 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
              <select
                className="select"
                value={editExpenseType}
                onChange={(e) => setEditExpenseType(e.target.value as any)}
                style={{ height: 42 }}
              >
                <option value="FIXED">FIXED</option>
                <option value="VARIABLE">VARIABLE</option>
              </select>
            </div>

            <div style={{ minWidth: 220 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Category</div>
              <select className="select" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} style={{ height: 42 }}>
                {(editExpenseType === "FIXED" ? catsByType.fixed : catsByType.variable).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: 260, flex: 1 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Description</div>
              <input className="input" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>

            <div style={{ minWidth: 200 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Default amount (USD)</div>
              <input
                className="input"
                type="number"
                value={editDefaultAmountUsd}
                onChange={(e) => setEditDefaultAmountUsd(e.target.value)}
                placeholder="optional"
              />
            </div>

            <button className="btn primary" type="button" onClick={saveEdit} style={{ height: 42 }}>
              Save
            </button>

            <button className="btn" type="button" onClick={cancelEdit} style={{ height: 42 }}>
              Cancel
            </button>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Note: On update, only planned drafts in <b>open months</b> and <b>not confirmed</b> are synced.
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          FIXED: {fixedRows.length} • VARIABLE: {variableRows.length}
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Type</th>
              <th style={{ width: 220 }}>Category</th>
              <th>Description</th>
              <th className="right" style={{ width: 180 }}>Default USD</th>
              <th className="right" style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="muted">{t.expenseType}</td>
                <td>{t.category?.name ?? t.categoryId}</td>
                <td>{t.description}</td>
                <td className="right">{t.defaultAmountUsd == null ? <span className="muted">—</span> : usd0.format(t.defaultAmountUsd)}</td>
                <td className="right">
                  <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                    <button className="btn" type="button" onClick={() => startEdit(t)} style={{ height: 34 }}>
                      Edit
                    </button>
                    <button className="btn danger" type="button" onClick={() => del(t.id)} style={{ height: 34 }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No templates yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .table.compact th, .table.compact td { padding: 6px 8px; }
        .onb-callout{
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          border-radius: 14px;
          padding: 12px 14px;
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------
   Admin page
--------------------------------------------------------- */

export default function AdminPage() {
  const nav = useNavigate();

  const { setHeader, onboardingStep, setOnboardingStep, meLoaded, me } = useAppShell();
  const { year: appYear } = useAppYearMonth();

  const [meResp, setMeResp] = useState<MeResp | null>(null);
  const [meError, setMeError] = useState<string>("");

  const isSuperAdmin = meResp?.role === "SUPER_ADMIN";

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
      title: "Admin",
      subtitle: `Categories + Month close + Users — ${appYear}`,
    });
  }, [setHeader, appYear]);

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
      setCatInfo("Category created.");
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
      setCatInfo("Category updated.");
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
      setCatInfo("Category deleted.");
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
    try {
      await api(`/monthCloses/close`, { method: "POST", body: JSON.stringify({ year: mcYear, month: mcMonth }) });
      await loadMonthCloses(mcYear);
      setMcInfo(`Month ${m2(mcMonth)}/${mcYear} closed.`);
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

  return (
    <div className="grid">
      {/* ✅ Onboarding banner (Step 1) */}
      {onboardingActive && (
        <div className="card" style={{ border: "1px solid rgba(15,23,42,0.10)", background: "rgba(15,23,42,0.02)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Welcome to Ground</div>
              <div className="muted" style={{ marginTop: 4, fontSize: 13, maxWidth: 720 }}>
                Step 1 is to review your Categories and Templates, and create your base template.
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div><span style={{ fontWeight: 900 }}>1.</span> Review templates & categories (you are here)</div>
                  <div className="muted">2. Confirm drafts in Expenses</div>
                  <div className="muted">3. Set Accounts/Funds in Investments</div>
                  <div className="muted">4. Add Income & Other expenses in Budgets</div>
                  <div className="muted">5. Review Dashboard</div>
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="button" onClick={goTemplates} style={{ height: 40 }}>
                Go to Templates
              </button>
              <button className="btn primary" type="button" onClick={markStep1Done} style={{ height: 40 }}>
                I’m done with Step 1
              </button>
              <button className="btn" type="button" onClick={skipOnboarding} style={{ height: 40 }}>
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Categories: Add ===== */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Categories</div>
            <div className="muted" style={{ fontSize: 12 }}>Manage categories used by expenses and templates</div>
          </div>
          <button className="btn" type="button" onClick={loadAll}>
            Refresh
          </button>
        </div>

        <div style={{ marginTop: 12, fontWeight: 800 }}>Add category</div>

        <form onSubmit={createCategory} className="row" style={{ alignItems: "end", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Name</div>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Supermarket" />
          </div>

          <div style={{ minWidth: 180 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Type</div>
            <select className="select" value={newType} onChange={(e) => setNewType(e.target.value as any)} style={{ height: 42 }}>
              <option value="VARIABLE">VARIABLE</option>
              <option value="FIXED">FIXED</option>
            </select>
          </div>

          <button className="btn primary" type="submit" style={{ height: 42 }}>
            Add
          </button>
        </form>

        {catError && <div style={{ marginTop: 12, color: "var(--danger)" }}>{catError}</div>}
        {catInfo && <div style={{ marginTop: 12, color: "rgba(15,23,42,0.75)" }}>{catInfo}</div>}
      </div>

      {/* ===== Categories: List ===== */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Your categories</div>
            <div className="muted" style={{ fontSize: 12 }}>Rename / change type / delete</div>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{categories.length} items</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table compact">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 160 }}>Type</th>
                <th style={{ width: 240 }} className="right">Actions</th>
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
                            Save
                          </button>
                          <button className="btn" type="button" onClick={cancelEdit} style={{ height: 34 }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
                          <button className="btn" type="button" onClick={() => startEdit(c)} style={{ height: 34 }}>
                            Edit
                          </button>
                          <button className="btn danger" type="button" onClick={() => removeCategory(c.id)} style={{ height: 34 }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">No categories yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <style>{`
          .table.compact th, .table.compact td { padding: 6px 8px; }
          .input.compact { padding: 6px 8px; border-radius: 10px; }
        `}</style>
      </div>

      {/* ===== Month Close ===== */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Close month</div>
            <div className="muted" style={{ fontSize: 12 }}>Lock a month snapshot</div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "end" }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Year</div>
            <input className="input" type="number" value={mcYear} onChange={(e) => setMcYear(Number(e.target.value))} style={{ width: 120, height: 42 }} />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Month</div>
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
              Reopen
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={closeMonth} style={{ height: 42 }}>
              Close month
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

      {/* ===== User admin ===== */}
      <div className="card">
        <div style={{ fontWeight: 900 }}>User admin</div>

        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {meResp ? `Signed in as: ${meResp.email} (${meResp.role})` : "Loading user…"}
        </div>

        {meError && <div style={{ marginTop: 10, color: "var(--danger)" }}>{meError}</div>}

        <ChangePasswordCard />
        {isSuperAdmin && <UsersAdminCard />}
      </div>

      {/* ===== Expense templates ===== */}
      <div className="card">
        <ExpenseTemplatesAdminCard categories={categories} onboardingActive={onboardingActive} onScrollTargetRef={templatesRef} />
      </div>
    </div>
  );
}