import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/ground-logo.jpg";

export function Sidebar() {
  const nav = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  }

  return (
    <aside className="sidebar">
      {/* BRAND */}
      <div className="brand" style={{ gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "white",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
          title="Ground"
        >
          <img
            src={logo}
            alt="Ground"
            style={{
              width: 30,
              height: 30,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.2, lineHeight: 1.1 }}>Ground</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.2, marginTop: 2 }}>
            Order your finances.
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav className="nav" style={{ marginTop: 14 }}>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
          📊 Dashboard
        </NavLink>

        <NavLink to="/expenses" className={({ isActive }) => (isActive ? "active" : "")}>
          💸 Expenses
        </NavLink>

        <NavLink to="/budgets" className={({ isActive }) => (isActive ? "active" : "")}>
          🎯 Budgets
        </NavLink>

        <NavLink to="/investments" className={({ isActive }) => (isActive ? "active" : "")}>
          📈 Investments
        </NavLink>

        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
          🧩 Admin
        </NavLink>
      </nav>

      {/* FOOTER */}
      <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <button className="btn danger" style={{ width: "100%" }} onClick={logout} type="button">
          Logout
        </button>
      </div>

      <style>{`
        .sidebar .brand {
          padding: 14px 14px 10px;
        }

        .sidebar .nav a {
          border-radius: 12px;
          padding: 10px 12px;
          transition: background 120ms ease, transform 120ms ease;
        }

        .sidebar .nav a:hover {
          background: rgba(0,0,0,0.03);
          transform: translateY(-1px);
        }

        .sidebar .nav a.active {
          background: rgba(79,70,229,0.10);
          border: 1px solid rgba(79,70,229,0.18);
        }
      `}</style>
    </aside>
  );
}