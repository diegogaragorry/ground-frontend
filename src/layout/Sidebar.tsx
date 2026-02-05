import { NavLink, useNavigate } from "react-router-dom";

export function Sidebar() {
  const nav = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  }

  return (
    <aside className="sidebar sidebar-ground">
      <div className="sidebar-brand">
        <span className="sidebar-wordmark">Ground</span>
        <span className="sidebar-tagline">Order your finances.</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => (isActive ? "active" : "")}>
          Expenses
        </NavLink>
        <NavLink to="/budgets" className={({ isActive }) => (isActive ? "active" : "")}>
          Budgets
        </NavLink>
        <NavLink to="/investments" className={({ isActive }) => (isActive ? "active" : "")}>
          Investments
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
          Admin
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="btn danger sidebar-logout" type="button" onClick={logout}>
          Logout
        </button>
      </div>

      <style>{`
        .sidebar-ground {
          display: flex;
          flex-direction: column;
          align-self: start;
          position: sticky;
          top: 0;
          height: 100vh;
          padding: 20px 16px;
          background: var(--panel);
          border-right: 1px solid var(--border);
        }

        .sidebar-brand {
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--border);
        }

        .sidebar-wordmark {
          display: block;
          font-family: "Plus Jakarta Sans", system-ui, sans-serif;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
          line-height: 1.1;
        }

        .sidebar-tagline {
          display: block;
          font-size: 0.75rem;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.3;
        }

        .sidebar-nav {
          display: grid;
          gap: 4px;
        }

        .sidebar-nav a {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          color: var(--muted);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.9375rem;
          transition: background 0.15s, color 0.15s;
        }

        .sidebar-nav a:hover {
          background: rgba(15, 23, 42, 0.06);
          color: var(--text);
        }

        .sidebar-nav a.active {
          background: rgba(15, 23, 42, 0.08);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .sidebar-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .sidebar-logout {
          width: 100%;
          font-size: 0.875rem;
        }
      `}</style>
    </aside>
  );
}