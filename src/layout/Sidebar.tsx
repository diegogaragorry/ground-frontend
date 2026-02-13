import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppShell } from "./AppShell";
import { APP_BASE, CONTACT_WHATSAPP_URL } from "../constants";

/** Tour step → path to highlight (Expenses → Investments → Income → Budget → Dashboard) */
const TOUR_STEP_PATH: (string | null)[] = [`${APP_BASE}/expenses`, `${APP_BASE}/investments`, `${APP_BASE}/income`, `${APP_BASE}/budgets`, APP_BASE];

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
    nav("/", { replace: true });
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
              title={t("sidebar.displayCurrencyTooltip")}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to={APP_BASE}
          end
          className={({ isActive }) => [isActive && "active", tourHighlightPath === APP_BASE && "tour-highlight"].filter(Boolean).join(" ") || ""}
          onClick={onNavigateClick}
        >
          {t("sidebar.dashboard")}
        </NavLink>
        {!isMobile && (
          <NavLink to={`${APP_BASE}/income`} className={({ isActive }) => [isActive && "active"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
            {t("sidebar.income")}
          </NavLink>
        )}
        <NavLink to={`${APP_BASE}/expenses`} className={({ isActive }) => [isActive && "active", tourHighlightPath === `${APP_BASE}/expenses` && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
          {t("sidebar.expenses")}
        </NavLink>
        {!isMobile && (
          <>
            <NavLink to={`${APP_BASE}/investments`} className={({ isActive }) => [isActive && "active", tourHighlightPath === `${APP_BASE}/investments` && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
              {t("sidebar.investments")}
            </NavLink>
            <NavLink to={`${APP_BASE}/budgets`} className={({ isActive }) => [isActive && "active", tourHighlightPath === `${APP_BASE}/budgets` && "tour-highlight"].filter(Boolean).join(" ") || ""} onClick={onNavigateClick}>
              {t("sidebar.budgets")}
            </NavLink>
            <NavLink to={`${APP_BASE}/admin`} className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
              {t("sidebar.admin")}
            </NavLink>
            <NavLink to={`${APP_BASE}/help`} className={({ isActive }) => (isActive ? "active" : "")} onClick={onNavigateClick}>
              {t("sidebar.help")}
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <a
          href={CONTACT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-contact-link"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8, fontSize: 13, color: "var(--muted)" }}
          title="WhatsApp"
        >
          {t("sidebar.contactWhatsApp")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
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