import React, { createContext, useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { APP_BASE } from "../constants";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { api } from "../api";
import { setFxDefault } from "../utils/fx";
import { formatAmountUsdWith } from "../utils/formatCurrency";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { OnboardingTour } from "../onboarding/OnboardingTour";

/* =========================
   Types
========================= */

type YearMonth = { year: number; month: number };

type ShellHeader = { title: string; subtitle?: string | React.ReactNode };

type Me = {
  id: string;
  email: string;
  role: "USER" | "SUPER_ADMIN";
  forceOnboardingNextLogin?: boolean;
  onboardingStep?: string;
  mobileWarningDismissed?: boolean;
  preferredDisplayCurrencyId?: string | null;
};

type OnboardingStep = "welcome" | "admin" | "expenses" | "investments" | "budget" | "dashboard" | "done";

/* =========================
   Helpers
========================= */

function ymNow(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/* =========================
   Onboarding (per user)
========================= */

function obKey(userId: string) {
  return `ground:onboarding:v1:${userId}`;
}

function readOnboarding(userId: string): OnboardingStep {
  const raw = localStorage.getItem(obKey(userId));
  const v = (raw ?? "welcome") as OnboardingStep;
  const allowed: OnboardingStep[] = ["welcome", "admin", "expenses", "investments", "budget", "dashboard", "done"];
  return allowed.includes(v) ? v : "welcome";
}

function writeOnboarding(userId: string, step: OnboardingStep) {
  localStorage.setItem(obKey(userId), step);
}

function isOnboardingRouteStep(pathname: string): OnboardingStep | null {
  if (pathname === APP_BASE || pathname === `${APP_BASE}/`) return "dashboard";
  if (pathname.startsWith(`${APP_BASE}/admin`)) return "admin";
  if (pathname.startsWith(`${APP_BASE}/expenses`)) return "expenses";
  if (pathname.startsWith(`${APP_BASE}/investments`)) return "investments";
  if (pathname.startsWith(`${APP_BASE}/budgets`)) return "budget";
  return null;
}

/* =========================
   Context
========================= */

type Toast = { text: string } | null;

const MOBILE_BREAKPOINT_PX = 900;

type AppShellCtx = {
  year: number;
  month: number;
  setYearMonth: (ym: YearMonth) => void;

  header: ShellHeader;
  setHeader: (h: ShellHeader) => void;

  isMobile: boolean;

  me: Me | null;
  meLoaded: boolean;

  onboardingStep: OnboardingStep;
  setOnboardingStep: (s: OnboardingStep) => void;
  reopenOnboarding: () => void;

  onboardingTourStep: number | null;
  setOnboardingTourStep: (s: number | null) => void;

  toast: Toast;
  showSuccess: (text: string) => void;

  /** Tipo de cambio USD/UYU del servidor (actualizado 1x/día). null hasta que se reciba. */
  serverFxRate: number | null;

  /** Marca el aviso mobile como visto para el usuario actual (persistido en backend). */
  dismissMobileWarning: () => Promise<void>;

  /** Moneda para mostrar totales (USD | UYU). Por defecto USD. */
  preferredDisplayCurrencyId: "USD" | "UYU";
  /** Actualiza la moneda de visualización y recarga me. */
  updatePreferredDisplayCurrency: (currencyId: "USD" | "UYU") => Promise<void>;
};

const Ctx = createContext<AppShellCtx | null>(null);

/* =========================
   Provider
========================= */

export function AppShellProvider(props: { children: React.ReactNode }) {
  const now = useMemo(() => ymNow(), []);
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const [header, setHeader] = useState<ShellHeader>({
    title: "ground",
    subtitle: "Order your finances, ground your spending, grow your dreams.",
  });

  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  const [onboardingStep, _setOnboardingStep] = useState<OnboardingStep>("welcome");
  const [onboardingTourStep, setOnboardingTourStep] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast>(null);
  const showSuccess = React.useCallback((text: string) => {
    setToast({ text });
  }, []);

  const [serverFxRate, setServerFxRate] = useState<number | null>(null);

  const dismissMobileWarning = React.useCallback((): Promise<void> => {
    return api("/auth/me", { method: "PATCH", body: JSON.stringify({ mobileWarningDismissed: true }) }).then(() => {
      setMe((prev) => (prev ? { ...prev, mobileWarningDismissed: true } : null));
    });
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    api<Me>("/auth/me")
      .then((r) => {
        setMe(r);
        const forceFromServer = r.forceOnboardingNextLogin === true || (r as Record<string, unknown>).forceOnboardingNextLogin === true;
        const allowed: OnboardingStep[] = ["welcome", "admin", "expenses", "investments", "budget", "dashboard", "done"];
        let step: OnboardingStep =
          forceFromServer
            ? "welcome"
            : (r.onboardingStep && allowed.includes(r.onboardingStep as OnboardingStep)
              ? (r.onboardingStep as OnboardingStep)
              : readOnboarding(r.id));
        if (forceFromServer) {
          writeOnboarding(r.id, "welcome");
          api("/auth/me", { method: "PATCH", body: JSON.stringify({ forceOnboardingNextLogin: false, onboardingStep: "welcome" }) }).catch(() => {});
        }
        writeOnboarding(r.id, step);
        _setOnboardingStep(step);
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => setMeLoaded(true));
  }, []);

  React.useEffect(() => {
    if (!me) return;
    api<{ usdUyuRate: number }>("/fx/rate")
      .then((r) => {
        setFxDefault(r.usdUyuRate);
        setServerFxRate(r.usdUyuRate);
      })
      .catch(() => {});
  }, [me]);

  function setOnboardingStep(step: OnboardingStep) {
    if (!me) return;
    writeOnboarding(me.id, step);
    _setOnboardingStep(step);
    api("/auth/me", { method: "PATCH", body: JSON.stringify({ onboardingStep: step }) }).catch(() => {});
  }

  function reopenOnboarding() {
    if (!me) return;
    writeOnboarding(me.id, "welcome");
    _setOnboardingStep("welcome");
    api("/auth/me", { method: "PATCH", body: JSON.stringify({ onboardingStep: "welcome" }) }).catch(() => {});
  }

  const updatePreferredDisplayCurrency = React.useCallback(
    (currencyId: "USD" | "UYU") => {
      setMe((prev) => (prev ? { ...prev, preferredDisplayCurrencyId: currencyId } : prev));
      return api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ preferredDisplayCurrencyId: currencyId }),
      }).then(() => api<Me>("/auth/me")).then(setMe);
    },
    []
  );

  const preferredDisplayCurrencyId: "USD" | "UYU" =
    me?.preferredDisplayCurrencyId === "UYU" ? "UYU" : "USD";

  const value: AppShellCtx = {
    year,
    month,
    setYearMonth: ({ year, month }) => {
      setYear(year);
      setMonth(month);
    },
    header,
    setHeader,
    isMobile,
    me,
    meLoaded,
    onboardingStep,
    setOnboardingStep,
    reopenOnboarding,
    onboardingTourStep,
    setOnboardingTourStep,
    toast,
    showSuccess,
    serverFxRate,
    dismissMobileWarning,
    preferredDisplayCurrencyId,
    updatePreferredDisplayCurrency,
  };

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useAppYearMonth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppYearMonth must be used within <AppShellProvider />");
  return { year: ctx.year, month: ctx.month, setYearMonth: ctx.setYearMonth };
}

export function useAppShell() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppShell must be used within <AppShellProvider />");
  return {
    header: ctx.header,
    setHeader: ctx.setHeader,
    isMobile: ctx.isMobile,
    me: ctx.me,
    meLoaded: ctx.meLoaded,
    onboardingStep: ctx.onboardingStep,
    setOnboardingStep: ctx.setOnboardingStep,
    reopenOnboarding: ctx.reopenOnboarding,
    onboardingTourStep: ctx.onboardingTourStep,
    setOnboardingTourStep: ctx.setOnboardingTourStep,
    showSuccess: ctx.showSuccess,
    serverFxRate: ctx.serverFxRate,
    dismissMobileWarning: ctx.dismissMobileWarning,
    preferredDisplayCurrencyId: ctx.preferredDisplayCurrencyId,
    updatePreferredDisplayCurrency: ctx.updatePreferredDisplayCurrency,
  };
}

/** Formatear monto en USD a la moneda de visualización (USD o UYU). */
export function useDisplayCurrency() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDisplayCurrency must be used within <AppShellProvider />");
  const rate = ctx.serverFxRate ?? null;
  return {
    preferredDisplayCurrencyId: ctx.preferredDisplayCurrencyId,
    formatAmountUsd: (amountUsd: number) =>
      formatAmountUsdWith(amountUsd, ctx.preferredDisplayCurrencyId, rate),
    /** Valor numérico en moneda de visualización (para ejes de gráficos). */
    displayValue: (amountUsd: number) =>
      ctx.preferredDisplayCurrencyId === "UYU" && rate != null && rate > 0 ? amountUsd * rate : amountUsd,
    currencyLabel: ctx.preferredDisplayCurrencyId,
  };
}

/* =========================
   Shell layout
========================= */

export function AppShell(props: { children: React.ReactNode }) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AppShell must be used within <AppShellProvider />");

  const nav = useNavigate();
  const loc = useLocation();
  const isMobile = ctx.isMobile;

  const { t, i18n } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const locale = i18n.language?.startsWith("es") ? "es" : "en";
  const monthNames = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => {
      const name = fmt.format(new Date(2000, i, 1));
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return { value: i + 1, label };
    });
  }, [locale]);
  const years = React.useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => y - 2 + i);
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Force onboarding: ?resetOnboarding=1 o ?forceOnboarding=1 (p. ej. para testing o si el backend no devolvió el flag)
  React.useEffect(() => {
    if (!ctx.meLoaded || !ctx.me) return;
    const params = new URLSearchParams(loc.search);
    if (params.get("resetOnboarding") === "1" || params.get("forceOnboarding") === "1") {
      ctx.reopenOnboarding();
      nav(APP_BASE, { replace: true });
    }
  }, [ctx.meLoaded, ctx.me, loc.search, nav, ctx]);

  // Keep step aligned with navigation (only after welcome has started)
  React.useEffect(() => {
    if (!ctx.me) return;
    if (ctx.onboardingStep === "done") return;

    const current = isOnboardingRouteStep(loc.pathname);
    if (!current) return;

    // Do NOT auto-advance while still on welcome.
    // Welcome should stay until user explicitly starts.
    if (ctx.onboardingStep === "welcome") return;

    const order: OnboardingStep[] = ["welcome", "admin", "expenses", "investments", "budget", "dashboard", "done"];
    const currIdx = order.indexOf(ctx.onboardingStep);
    const navIdx = order.indexOf(current);
    if (navIdx > currIdx) ctx.setOnboardingStep(current);
  }, [loc.pathname, ctx.me, ctx.onboardingStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Show Welcome card ONLY on dashboard and ONLY when step === welcome
  const showWelcomePanel = ctx.meLoaded && !!ctx.me && ctx.onboardingStep === "welcome" && (loc.pathname === APP_BASE || loc.pathname === `${APP_BASE}/`);

  function skipSetup() {
    if (!ctx || !ctx.me) return;
    ctx.setOnboardingStep("admin");
    nav(`${APP_BASE}/admin`, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="container">
      {/* En desktop: sidebar fijo. En mobile: no se renderiza aquí, solo dentro del drawer. */}
      {!isMobile && <Sidebar isMobile={false} />}

      {drawerOpen && (
        <div className="drawerOverlay" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <Sidebar isMobile={true} onNavigateClick={() => setDrawerOpen(false)} />
          </div>
          <div
            className="drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}
            aria-hidden
          />
        </div>
      )}

      <main className="main">
        <div style={{ display: "grid", gap: 12 }}>
          {ctx.toast && (
            <div className="toast-success" role="status">
              {ctx.toast.text}
            </div>
          )}
          <Topbar
            title={ctx.header.title}
            subtitle={!isMobile ? ctx.header.subtitle : undefined}
            onOpenMenu={() => setDrawerOpen(true)}
            isMobileFixed={isMobile}
            right={
              <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {isMobile && <span className="muted" style={{ fontSize: 12 }}>{t("common.month")}</span>}
                <select
                  className="input"
                  value={ctx.month}
                  onChange={(e) => ctx.setYearMonth({ year: ctx.year, month: Number(e.target.value) })}
                  style={{ width: isMobile ? 100 : 120, minWidth: 0, fontSize: isMobile ? 14 : undefined }}
                  aria-label={t("common.month")}
                >
                  {monthNames.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={ctx.year}
                  onChange={(e) => ctx.setYearMonth({ year: Number(e.target.value), month: ctx.month })}
                  style={{ width: isMobile ? 72 : 96, minWidth: 0, fontSize: isMobile ? 14 : undefined }}
                  aria-label={t("admin.year")}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
          {isMobile && <div className="topbar-spacer" aria-hidden />}
          {isMobile && !drawerOpen && ctx.meLoaded && ctx.me && !ctx.me.mobileWarningDismissed && (
            <div className="mobile-warning" role="alert">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, marginBottom: 6, color: "var(--danger)" }}>
                  {t("common.mobileWarningTitle")}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, color: "rgba(220, 38, 38, 0.9)" }}>
                  {t("common.mobileWarningMessage")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => ctx.dismissMobileWarning()}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--danger)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: 20,
                  lineHeight: 1,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                aria-label={t("common.close")}
              >
                ×
              </button>
            </div>
          )}

          {/* ✅ Onboarding wizard en overlay full-screen para no distraer con el dashboard */}
          {showWelcomePanel && (
            <div
              className="onboarding-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "var(--overlay-bg, rgba(0,0,0,0.5))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <OnboardingWizard
                key={i18n.language}
                onComplete={() => {
                  if (!ctx?.me) return;
                  ctx.setOnboardingStep("expenses");
                  ctx.setOnboardingTourStep(0);
                  nav(`${APP_BASE}/expenses`, { replace: false });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onSkip={skipSetup}
              />
            </div>
          )}

          {/* Tour con tooltips después del wizard */}
          {ctx.onboardingTourStep !== null && (
            <OnboardingTour
              step={ctx.onboardingTourStep}
              leaveSidebarVisible={!isMobile}
              onNext={() => {
                const s = ctx.onboardingTourStep ?? 0;
                if (s === 0) {
                  ctx.setOnboardingTourStep(1);
                  nav(`${APP_BASE}/investments`, { replace: false });
                } else if (s === 1) {
                  ctx.setOnboardingTourStep(2);
                  nav(`${APP_BASE}/income`, { replace: false });
                } else if (s === 2) {
                  ctx.setOnboardingTourStep(3);
                  nav(`${APP_BASE}/budgets`, { replace: false });
                } else if (s === 3) {
                  ctx.setOnboardingTourStep(4);
                  nav(APP_BASE, { replace: false });
                } else {
                  ctx.setOnboardingTourStep(null);
                  ctx.setOnboardingStep("done");
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onClose={() => ctx.setOnboardingTourStep(null)}
            />
          )}

          <style>{`
            @media (max-width: 900px) {
              #mobileMenuBtn { display: inline-flex !important; }
            }
            .sidebar { width: 220px; }
          `}</style>

          {props.children}
        </div>
      </main>
      <a
        href="https://www.exchangerate-api.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: 8,
          right: 12,
          fontSize: 10,
          color: "rgba(15,23,42,0.4)",
          textDecoration: "none",
        }}
      >
        {t("expenses.fxAttribution")}
      </a>
    </div>
  );
}