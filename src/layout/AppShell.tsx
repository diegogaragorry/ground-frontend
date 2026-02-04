import React, { createContext, useContext, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { api } from "../api";

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
   UI: Welcome checklist (ONLY welcome step)
========================= */

function OnboardingPanel(props: {
  onStart: () => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const { onStart, onDone, onSkip } = props;

  const items: Array<{ title: string; sub: string }> = [
    { title: "1) Review templates & categories", sub: "Admin → Templates. Define your base monthly template." },
    { title: "2) Confirm January drafts", sub: "Expenses → confirm drafts to create real expenses." },
    { title: "3) Set your accounts (optional funds)", sub: "Investments → add Bank Account and any funds you track." },
    { title: "4) Add income & other expenses", sub: "Budgets → fill monthly income + “Other expenses”." },
    { title: "5) Review your dashboard", sub: "See monthly snapshot + annual projection." },
  ];

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.1 }}>Welcome to Ground</div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.35 }}>
          Order your finances, ground your spending, grow your dreams.
        </div>

        <div style={{ marginTop: 6, padding: 12, borderRadius: 14, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 850, marginBottom: 10 }}>Your setup checklist</div>

          {items.map((it, idx) => (
            <div key={idx} className="ob-item">
              <div className="ob-left">
                <div className="ob-title">{it.title}</div>
                <div className="muted ob-sub">{it.sub}</div>
              </div>

              {/* only a hint here; real navigation happens when you start */}
              <span className="muted" style={{ fontSize: 12 }}>
                →
              </span>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="ob-cta">
          <button className="btn primary ob-start" type="button" onClick={onStart}>
            Start with Step 1 →
          </button>

          <div className="row ob-right" style={{ gap: 10 }}>
            <button className="btn" type="button" onClick={onSkip} title="Hide for now (you can reopen it later)">
              Not now
            </button>
            <button className="btn" type="button" onClick={onDone} title="Skip setup and go to dashboard">
              Skip setup → Dashboard
            </button>
          </div>
        </div>

        <style>{`
          .ob-item{
            display:flex;
            justify-content:space-between;
            gap:12px;
            align-items:center;
            padding:10px 0;
            border-bottom:1px solid rgba(0,0,0,0.06);
          }
          .ob-item:last-child{ border-bottom:none; }
          .ob-left{ min-width:0; }
          .ob-title{ font-weight:850; font-size:13px; }
          .ob-sub{ font-size:12px; margin-top:2px; }

          .ob-cta{
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            flex-wrap:wrap;
          }
          .ob-start{
            height: 40px;
            padding: 10px 14px;
            font-weight: 850;
          }

          /* Make Start CTA dominant on narrow screens */
          @media (max-width: 700px){
            .ob-cta{ align-items: stretch; }
            .ob-start{ width: 100%; }
            .ob-right{ width: 100%; justify-content: flex-end; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* =========================
   Context
========================= */

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const ymValue = ymToInputValue(ctx.year, ctx.month);

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

  function startStep1() {
    if (!ctx.me) return;
    ctx.setOnboardingStep("admin");
    nav("/admin", { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function skipSetup() {
    if (!ctx.me) return;
    ctx.setOnboardingStep("done");
    nav("/", { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function notNow() {
    // hide for now but keep ability to resume later via "Setup guide"
    if (!ctx.me) return;
    ctx.setOnboardingStep("done");
  }

  return (
    <div className="container">
      <Sidebar />

      {drawerOpen && (
        <div className="drawerOverlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}

      <main className="main">
        <div style={{ display: "grid", gap: 12 }}>
          <Topbar
            title={ctx.header.title}
            subtitle={ctx.header.subtitle}
            onOpenMenu={() => setDrawerOpen(true)}
            right={
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
                  style={{ width: 132 }}
                />
              </div>
            }
          />

          {/* ✅ Welcome panel only here */}
          {showWelcomePanel && (
            <OnboardingPanel
              onStart={startStep1}
              onDone={skipSetup}
              onSkip={notNow}
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