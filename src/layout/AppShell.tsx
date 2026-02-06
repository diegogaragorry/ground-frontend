import React, { createContext, useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { api } from "../api";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";
import { OnboardingTour } from "../onboarding/OnboardingTour";

/* =========================
   Types
========================= */

type YearMonth = { year: number; month: number };

type ShellHeader = { title: string; subtitle?: string };

type Me = {
  id: string;
  email: string;
  role: "USER" | "SUPER_ADMIN";
};

type OnboardingStep = "welcome" | "admin" | "expenses" | "investments" | "budget" | "dashboard" | "done";

/* =========================
   Helpers
========================= */

function ymNow(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function ymToInputValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`; // YYYY-MM
}

function inputValueToYm(v: string): YearMonth | null {
  const [y, m] = v.split("-").map((x) => Number(x));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
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
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/expenses")) return "expenses";
  if (pathname.startsWith("/investments")) return "investments";
  if (pathname.startsWith("/budgets")) return "budget";
  return null;
}

/* =========================
   Context
========================= */

type Toast = { text: string } | null;

type AppShellCtx = {
  year: number;
  month: number;
  setYearMonth: (ym: YearMonth) => void;

  header: ShellHeader;
  setHeader: (h: ShellHeader) => void;

  me: Me | null;
  meLoaded: boolean;

  onboardingStep: OnboardingStep;
  setOnboardingStep: (s: OnboardingStep) => void;
  reopenOnboarding: () => void;

  onboardingTourStep: number | null;
  setOnboardingTourStep: (s: number | null) => void;

  toast: Toast;
  showSuccess: (text: string) => void;
};

const Ctx = createContext<AppShellCtx | null>(null);

/* =========================
   Provider
========================= */

export function AppShellProvider(props: { children: React.ReactNode }) {
  const now = useMemo(() => ymNow(), []);
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);

  const [header, setHeader] = useState<ShellHeader>({
    title: "Ground",
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

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    api<Me>("/auth/me")
      .then((r) => {
        setMe(r);
        const step = readOnboarding(r.id);
        _setOnboardingStep(step);
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => setMeLoaded(true));
  }, []);

  function setOnboardingStep(step: OnboardingStep) {
    if (!me) return;
    writeOnboarding(me.id, step);
    _setOnboardingStep(step);
  }

  function reopenOnboarding() {
    if (!me) return;
    writeOnboarding(me.id, "welcome");
    _setOnboardingStep("welcome");
  }

  const value: AppShellCtx = {
    year,
    month,
    setYearMonth: ({ year, month }) => {
      setYear(year);
      setMonth(month);
    },
    header,
    setHeader,
    me,
    meLoaded,
    onboardingStep,
    setOnboardingStep,
    reopenOnboarding,
    onboardingTourStep,
    setOnboardingTourStep,
    toast,
    showSuccess,
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
    me: ctx.me,
    meLoaded: ctx.meLoaded,
    onboardingStep: ctx.onboardingStep,
    setOnboardingStep: ctx.setOnboardingStep,
    reopenOnboarding: ctx.reopenOnboarding,
    showSuccess: ctx.showSuccess,
  };
}

/* =========================
   Shell layout
========================= */

const MOBILE_BREAKPOINT = 900;

export function AppShell(props: { children: React.ReactNode }) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AppShell must be used within <AppShellProvider />");

  const nav = useNavigate();
  const loc = useLocation();

  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  );
  const ymValue = ymToInputValue(ctx.year, ctx.month);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Force onboarding to welcome when ?resetOnboarding=1 (e.g. for testing)
  React.useEffect(() => {
    if (!ctx.meLoaded || !ctx.me) return;
    const params = new URLSearchParams(loc.search);
    if (params.get("resetOnboarding") === "1") {
      ctx.reopenOnboarding();
      nav("/", { replace: true });
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
  const showWelcomePanel = ctx.meLoaded && !!ctx.me && ctx.onboardingStep === "welcome" && loc.pathname === "/";

  function skipSetup() {
    if (!ctx || !ctx.me) return;
    ctx.setOnboardingStep("done");
    nav("/", { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="container">
      {/* En desktop: sidebar fijo. En mobile: no se renderiza aquí, solo dentro del drawer. */}
      {!isMobile && <Sidebar />}

      {drawerOpen && (
        <div className="drawerOverlay" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigateClick={() => setDrawerOpen(false)} />
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
            title={isMobile ? t("common.menu") : ctx.header.title}
            subtitle={isMobile ? undefined : ctx.header.subtitle}
            onOpenMenu={() => setDrawerOpen(true)}
            isMobileFixed={isMobile}
            right={
              !isMobile ? (
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Month
                  </span>
                  <input
                    className="input"
                    type="month"
                    value={ymValue}
                    onChange={(e) => {
                      const v = inputValueToYm(e.target.value);
                      if (!v) return;
                      ctx.setYearMonth(v);
                    }}
                    style={{ width: 132, minWidth: 0 }}
                  />
                </div>
              ) : undefined
            }
          />
          {isMobile && <div className="topbar-spacer" aria-hidden />}

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
                onComplete={() => {
                  if (!ctx?.me) return;
                  ctx.setOnboardingStep("expenses");
                  ctx.setOnboardingTourStep(0);
                  nav("/expenses", { replace: false });
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
              onNext={() => {
                const s = ctx.onboardingTourStep ?? 0;
                if (s === 0) {
                  ctx.setOnboardingTourStep(1);
                  nav("/investments", { replace: false });
                } else if (s === 1) {
                  ctx.setOnboardingTourStep(2);
                  nav("/budgets", { replace: false });
                } else if (s === 2) {
                  ctx.setOnboardingTourStep(3);
                  nav("/", { replace: false });
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
    </div>
  );
}