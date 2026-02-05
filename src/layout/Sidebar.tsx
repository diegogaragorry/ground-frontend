import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type SidebarProps = {
  /** Llamar al hacer click en un enlace de navegación (p. ej. cerrar drawer en móvil) */
  onNavigateClick?: () => void;
};

export function Sidebar(props: SidebarProps) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { onNavigateClick } = props;

  function logout() {
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  }

  return (
    <aside className="sidebar sidebar-ground">
      <div className="sidebar-brand">
        <span className="sidebar-wordmark">{t("brand.name")}</span>
        <span className="sidebar-tagline">{t("brand.tagline")}</span>
        <div className="sidebar-lang" style={{ marginTop: 8 }}>
          <button
            type="button"
            className={i18n.language === "en" ? "lang-btn active" : "lang-btn"}
            onClick={() => i18n.changeLanguage("en")}
            aria-label="English"
          >
            EN
          </button>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>·</span>
          <button
            type="button"
            className={i18n.language === "es" ? "lang-btn active" : "lang-btn"}
            onClick={() => i18n.changeLanguage("es")}
            aria-label="Español"
          >
            ES
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
          {t("sidebar.dashboard")}
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
          {t("sidebar.expenses")}
        </NavLink>
        <NavLink to="/budgets" className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
          {t("sidebar.budgets")}
        </NavLink>
        <NavLink to="/investments" className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
          {t("sidebar.investments")}
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
          {t("sidebar.admin")}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="btn danger sidebar-logout" type="button" onClick={logout}>
          {t("sidebar.logout")}
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

        .sidebar-lang { display: flex; align-items: center; gap: 6px; }
        .lang-btn {
          background: none;
          border: none;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
          padding: 2px 4px;
        }
        .lang-btn:hover { color: var(--text); }
        .lang-btn.active { color: var(--text); }

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