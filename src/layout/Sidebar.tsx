import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppShell } from "./AppShell";

/** Tour step → path to highlight (Expenses → Investments → Budget → Dashboard) */
const TOUR_STEP_PATH: (string | null)[] = ["/expenses", "/investments", "/budgets", "/"];

type SidebarProps = {
  /** En móvil solo se muestran Panel, Gastos y Salir */
  isMobile?: boolean;
  /** Llamar al hacer click en un enlace de navegación (p. ej. cerrar drawer en móvil) */
  onNavigateClick?: () => void;
};

export function Sidebar({ isMobile = false, onNavigateClick }: SidebarProps) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { onboardingTourStep, preferredDisplayCurrencyId, updatePreferredDisplayCurrency } = useAppShell();
  const tourHighlightPath = onboardingTourStep != null ? TOUR_STEP_PATH[onboardingTourStep] ?? null : null;

  function logout() {
    localStorage.removeItem("token");
    nav("/login", { replace: true });
  }

  return (
    <aside className="sidebar sidebar-ground">
      <div className="sidebar-brand">
        <span className="sidebar-wordmark">{t("brand.name")}</span>
        {!isMobile && <span className="sidebar-tagline">{t("brand.tagline")}</span>}
        {!isMobile && (
          <div className="sidebar-drops" style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>
            <select
              className="select sidebar-drop"
              value={i18n.language?.startsWith("es") ? "es" : "en"}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t("sidebar.language")}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
            <select
              className="select sidebar-drop sidebar-drop-currency"
              value={preferredDisplayCurrencyId}
              onChange={(e) => updatePreferredDisplayCurrency(e.target.value as "USD" | "UYU")}
              aria-label={t("income.currencyLabel")}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => [isActive && "active", tourHighlightPath === "/" && "tour-highlight"].filter(Boolean).join(" ") || ""}
          onClick={onNavigateClick}
        >
          {t("sidebar.dashboard")}
        </NavLink>
        {!isMobile && (
          <NavLink to="/income" className={({ isActive }) => [isActive && "active"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
            {t("sidebar.income")}
          </NavLink>
        )}
        <NavLink to="/expenses" className={({ isActive }) => [isActive && "active", tourHighlightPath === "/expenses" && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
          {t("sidebar.expenses")}
        </NavLink>
        {!isMobile && (
          <>
            <NavLink to="/investments" className={({ isActive }) => [isActive && "active", tourHighlightPath === "/investments" && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
              {t("sidebar.investments")}
            </NavLink>
            <NavLink to="/budgets" className={({ isActive }) => [isActive && "active", tourHighlightPath === "/budgets" && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
              {t("sidebar.budgets")}
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
              {t("sidebar.admin")}
            </NavLink>
          </>
        )}
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
          padding: 20px 16px;
          background: var(--panel);
          border-right: 1px solid var(--border);
        }
        @media (min-width: 901px) {
          .sidebar-ground {
            position: sticky;
            top: 0;
            height: 100vh;
          }
        }

        .sidebar-brand {
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 2px solid var(--border);
        }

        .sidebar-wordmark {
          display: block;
          font-family: var(--font-sans);
          font-size: 1.95rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
          line-height: 1.1;
          text-transform: lowercase;
        }
        .sidebar-wordmark::after {
          content: ".";
          color: var(--brand-green);
        }

        .sidebar-tagline {
          display: block;
          font-size: 0.75rem;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.3;
        }

        .sidebar-drops { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
        .sidebar-drop {
          font-size: 10px;
          height: 24px;
          padding: 0 4px;
          width: 48px;
          min-width: 48px;
          border-radius: 4px;
          border: 1px solid var(--border);
        }
        .sidebar-drop-currency {
          width: 56px;
          min-width: 56px;
          padding: 0 6px;
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
          background: var(--brand-green-light);
          color: var(--text);
          border: 1px solid var(--brand-green-border);
          border-left: 3px solid var(--brand-green);
        }

        .sidebar-nav a.tour-highlight {
          background: rgba(59, 130, 246, 0.28);
          color: var(--text);
          border: 2px solid rgb(59, 130, 246);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
        }
        .sidebar-nav a.tour-highlight:hover {
          background: rgba(59, 130, 246, 0.35);
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