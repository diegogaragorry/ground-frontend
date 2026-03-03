import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APP_BASE } from "../constants";

const MOBILE_NAV_ITEMS = [
  { to: APP_BASE, labelKey: "sidebar.dashboard", shortLabel: "Panel" },
  { to: `${APP_BASE}/expenses`, labelKey: "sidebar.expenses", shortLabel: "Gastos" },
  { to: `${APP_BASE}/investments`, labelKey: "sidebar.investments", shortLabel: "Patr." },
  { to: `${APP_BASE}/budgets`, labelKey: "sidebar.budgets", shortLabel: "Pres." },
  { to: `${APP_BASE}/admin`, labelKey: "sidebar.admin", shortLabel: "Admin" },
];

export function MobileTabBar() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith("es");

  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === APP_BASE}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          <span className="mobile-tabbar-label">
            {isSpanish ? item.shortLabel : t(item.labelKey)}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
