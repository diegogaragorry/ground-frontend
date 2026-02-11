import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { APP_BASE } from "../constants";
import "./../styles/landing.css";
import "./../styles/auth.css";

const COPY = {
  es: {
    headline: "Aterrizá tus finanzas. Tomá mejores decisiones.",
    subheadline: "Entendé en qué estás gastando, hacete consciente de tus hábitos y planificá con claridad.",
    tagline: "Ordená tus finanzas.",
    ctaPrimary: "Empezar ahora →",
    ctaSecondary: "Ver cómo funciona",
    howItWorks: "Cómo funciona",
    howItWorksSub: "Tres pasos para tener el control.",
    step1Title: "Capturá",
    step1Desc: "Registrá gastos e ingresos de forma simple. Sin planillas.",
    step2Title: "Entendé",
    step2Desc: "Insights y conciencia de dónde va tu plata.",
    step3Title: "Planificá",
    step3Desc: "Presupuestos y proyecciones mensuales y anuales.",
    benefits: "Beneficios",
    benefitsSub: "Todo lo que necesitás para ordenar tu economía.",
    benefit1: "Sabé exactamente dónde va tu plata",
    benefit2: "Chau planillas, hola claridad",
    benefit3: "Setup guiado en minutos",
    benefit4: "Cierre de mes: gastos y patrimonio siempre alineados",
    benefit5: "Exportá todo a CSV o Excel",
    benefit6: "Multi-moneda con tipo de cambio actualizado",
    trust: "Hecho para finanzas reales",
    trust1: "Privado por diseño",
    trust2: "Guía simple de configuración",
    trust3: "Tus datos son tuyos",
    pricing: "Planes",
    pricingSub: "Registrate ahora y empezá con 4 meses gratis",
    earlyStage: "Early Stage",
    earlyStageBadge: "Actual",
    earlyStageDesc: "Registrate ahora",
    earlyStagePrice: "4 meses gratis",
    earlyStage1: "Todas las funcionalidades incluidas",
    earlyStage2: "Después: plan pago o descargá todos tus datos",
    pro: "Pro",
    proBadge: "Próximamente",
    proPriceTrial: "45 días gratis",
    proPriceAmount: "USD 3.99/mes",
    pro1: "Todas las funcionalidades incluidas",
    pro2: "Sin permanencia",
    faq: "Preguntas frecuentes",
    faq1Q: "¿Es una integración bancaria?",
    faq1A: "No. Ingresás tus datos manualmente. Así mantenés el control y la privacidad.",
    faq2Q: "¿Qué monedas soporta?",
    faq2A: "Multi-moneda con tipo de cambio actualizado automáticamente. Podés registrar gastos, ingresos e inversiones en las monedas soportadas.",
    faq3Q: "¿Cómo es el onboarding?",
    faq3A: "Un wizard simple: categorías, plantillas de gastos fijos, cuenta bancaria e inversiones. Podés saltar pasos y completar después.",
    faq4Q: "¿Qué pasa después de los 4 meses gratis?",
    faq4A: "Tenés dos opciones: pasás al plan Pro (cuando esté disponible) o descargás todos tus datos en CSV/Excel antes de que termine el periodo.",
    faq5Q: "¿Puedo exportar mis datos?",
    faq5A: "Sí. Podés exportar gastos, presupuesto y movimientos a CSV o Excel para análisis, backup o compartir con tu contador.",
    faq6Q: "¿Qué es el cierre de mes?",
    faq6A: "Es un paso que congela las cifras del mes. Una vez cerrado, los gastos y el patrimonio quedan fijos. Esto te ayuda a detectar inconsistencias entre lo que registrás y lo que realmente sale de tus cuentas, tomar conciencia de tus gastos y tener más control.",
    faq7Q: "¿Funciona en el celular?",
    faq7A: "ground. está pensado principalmente para desktop (pantalla grande). En mobile podés ver el panel y crear gastos; el uso completo está optimizado para escritorio.",
    faq8Q: "¿Cómo me ayuda con el control mensual?",
    faq8A: "Las plantillas de gastos y el flujo guiado acortan mucho el tiempo necesario para llevar el control. Además, te ayuda a recordar qué cosas tenés que pagar todos los meses y mantener el seguimiento sin esfuerzo.",
    finalHeadline: "Empezá a gastar con propósito hoy.",
    finalCta: "Crear cuenta / Iniciar sesión",
    footerLogin: "Iniciar sesión",
    footerCreate: "Crear cuenta",
    footerTerms: "Términos",
    footerPrivacy: "Privacidad",
    previewTitle: "Vista previa",
    kpiIncome: "Ingresos",
    kpiExpenses: "Gastos",
    kpiBalance: "Balance",
    kpiNetWorth: "Patrimonio",
    topCategories: "Top categorías",
    topExpenses: "Top gastos",
    cat1: "Hogar",
    cat2: "Transporte",
    cat3: "Comida",
    exp1: "Alquiler",
    exp2: "Supermercado",
    exp3: "Combustible",
    testimonial: "Finalmente entiendo a dónde va mi plata. Simple y sin vueltas.",
    testimonialAuthor: "Usuario de ground",
    topBarEmail: "Email",
    topBarPassword: "Contraseña",
    topBarSignIn: "Entrar",
  },
  en: {
    headline: "Ground your finances. Make smarter decisions.",
    subheadline: "See where your money goes, understand your patterns, and plan with clarity.",
    tagline: "Order your finances.",
    ctaPrimary: "Get started →",
    ctaSecondary: "See how it works",
    howItWorks: "How it works",
    howItWorksSub: "Three steps to take control.",
    step1Title: "Capture",
    step1Desc: "Track expenses and income simply. No spreadsheets.",
    step2Title: "Understand",
    step2Desc: "Insights and awareness of where your money goes.",
    step3Title: "Plan",
    step3Desc: "Budgets and monthly and annual projections.",
    benefits: "Benefits",
    benefitsSub: "Everything you need to order your finances.",
    benefit1: "Know exactly where your money goes",
    benefit2: "No spreadsheets, just clarity",
    benefit3: "Guided setup in minutes",
    benefit4: "Month-end close: expenses and net worth always aligned",
    benefit5: "Export everything to CSV or Excel",
    benefit6: "Multi-currency with updated exchange rates",
    trust: "Built for real life finances",
    trust1: "Private by design",
    trust2: "Simple setup guide",
    trust3: "Data stays yours",
    pricing: "Plans",
    pricingSub: "Sign up now and start with 4 months free",
    earlyStage: "Early Stage",
    earlyStageBadge: "Current",
    earlyStageDesc: "Sign up now",
    earlyStagePrice: "4 months free",
    earlyStage1: "Full access to all features",
    earlyStage2: "After: upgrade to paid or download all your data",
    pro: "Pro",
    proBadge: "Coming soon",
    proPriceTrial: "45 days free",
    proPriceAmount: "USD 3.99/mo",
    pro1: "Full access to all features",
    pro2: "Cancel anytime",
    faq: "FAQ",
    faq1Q: "Is this a bank integration?",
    faq1A: "No. You enter your data manually. That keeps you in control and your data private.",
    faq2Q: "What currencies does it support?",
    faq2A: "Multi-currency with automatically updated exchange rates. You can record expenses, income, and investments in supported currencies.",
    faq3Q: "How does onboarding work?",
    faq3A: "A simple wizard: categories, fixed expense templates, bank account, and investments. You can skip steps and complete them later.",
    faq4Q: "What happens after the 4 free months?",
    faq4A: "You have two options: upgrade to Pro (when available) or download all your data in CSV/Excel before the period ends.",
    faq5Q: "Can I export my data?",
    faq5A: "Yes. You can export expenses, budget, and movements to CSV or Excel for analysis, backup, or sharing with your accountant.",
    faq6Q: "What is month-end close?",
    faq6A: "A step that freezes the month's figures. Once closed, expenses and net worth are locked. This helps you spot inconsistencies between what you record and what actually leaves your accounts, become more aware of your spending, and gain more control.",
    faq7Q: "Does it work on mobile?",
    faq7A: "ground. is designed primarily for desktop (large screen). On mobile you can view the dashboard and create expenses; full use is optimized for desktop.",
    faq8Q: "How does it help with monthly control?",
    faq8A: "Expense templates and the guided flow greatly shorten the time needed for financial control. It also helps you remember what you need to pay every month and keep track without extra effort.",
    finalHeadline: "Start spending with purpose today.",
    finalCta: "Create account / Sign in",
    footerLogin: "Sign in",
    footerCreate: "Create account",
    footerTerms: "Terms",
    footerPrivacy: "Privacy",
    previewTitle: "Preview",
    kpiIncome: "Income",
    kpiExpenses: "Expenses",
    kpiBalance: "Balance",
    kpiNetWorth: "Net worth",
    topCategories: "Top categories",
    topExpenses: "Top expenses",
    cat1: "Home",
    cat2: "Transport",
    cat3: "Food",
    exp1: "Rent",
    exp2: "Groceries",
    exp3: "Fuel",
    testimonial: "Finally I understand where my money goes. Simple and straightforward.",
    testimonialAuthor: "ground user",
    topBarEmail: "Email",
    topBarPassword: "Password",
    topBarSignIn: "Sign in",
  },
} as const;

type Lang = "es" | "en";

const FAQ_ITEMS = [
  { q: "faq1Q", a: "faq1A" },
  { q: "faq2Q", a: "faq2A" },
  { q: "faq3Q", a: "faq3A" },
  { q: "faq4Q", a: "faq4A" },
  { q: "faq5Q", a: "faq5A" },
  { q: "faq6Q", a: "faq6A" },
  { q: "faq7Q", a: "faq7A" },
  { q: "faq8Q", a: "faq8A" },
] as const;

type LoginResp = { token?: string; accessToken?: string; jwt?: string; data?: { token?: string } };
function pickToken(r: LoginResp | any): string | null {
  const t = r?.token ?? r?.accessToken ?? r?.jwt ?? r?.data?.token;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

type ForgotStep = null | "email" | "code";
type RegisterStep = "request" | "verify";

function normalizeEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

export default function LandingPage() {
  const nav = useNavigate();
  const { t: tLogin, i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>("es");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const howSectionRef = useRef<HTMLDivElement | null>(null);

  const [topBarEmail, setTopBarEmail] = useState("");
  const [topBarPassword, setTopBarPassword] = useState("");
  const [topBarLoading, setTopBarLoading] = useState(false);
  const [topBarError, setTopBarError] = useState("");

  const [showAuthBox, setShowAuthBox] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotInfo, setForgotInfo] = useState("");

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("request");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerInfo, setRegisterInfo] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerShowPassword, setRegisterShowPassword] = useState(false);

  const t = COPY[lang];

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  async function onTopBarLogin(e: React.FormEvent) {
    e.preventDefault();
    setTopBarError("");
    const email = topBarEmail.trim().toLowerCase();
    if (!email) return setTopBarError(lang === "es" ? "Ingresá tu email" : "Enter your email");
    if (!topBarPassword) return setTopBarError(lang === "es" ? "Ingresá tu contraseña" : "Enter your password");
    setTopBarLoading(true);
    try {
      const resp = await api<LoginResp>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: topBarPassword }),
      });
      const token = pickToken(resp);
      if (token) {
        localStorage.setItem("token", token);
        nav(APP_BASE, { replace: true });
      } else {
        setTopBarError(lang === "es" ? "Error al iniciar sesión" : "Login failed");
      }
    } catch (err: any) {
      setTopBarError(err?.message === "Invalid credentials"
        ? (lang === "es" ? "Credenciales inválidas" : "Invalid credentials")
        : (err?.message ?? (lang === "es" ? "Error al iniciar sesión" : "Login failed")));
    } finally {
      setTopBarLoading(false);
    }
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.landingSection;
          if (entry.isIntersecting && id) {
            setVisibleSections((prev) => new Set(prev).add(id));
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    const nodes = document.querySelectorAll("[data-landing-section]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function scrollToHow() {
    howSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function showAuth(mode: "login" | "register" = "login") {
    setShowAuthBox(true);
    setAuthMode(mode);
    setAuthError("");
    setForgotStep(null);
    if (mode === "register") {
      setRegisterStep("request");
      setRegisterEmail("");
      setRegisterCode("");
      setRegisterPassword("");
      setRegisterError("");
      setRegisterInfo("");
    }
    document.querySelector(".landing-hero")?.scrollIntoView({ behavior: "smooth" });
  }

  function hideAuth() {
    setShowAuthBox(false);
    setAuthError("");
    setForgotStep(null);
  }

  async function onAuthLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const resp = await api<LoginResp>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.trim().toLowerCase(), password: authPassword }),
      });
      const token = pickToken(resp);
      if (token) {
        localStorage.setItem("token", token);
        nav(APP_BASE, { replace: true });
      } else {
        setAuthError(lang === "es" ? "Error al iniciar sesión" : "Login failed");
      }
    } catch (err: any) {
      setAuthError(err?.message === "Invalid credentials"
        ? tLogin("login.invalidCredentials")
        : (err?.message ?? tLogin("login.invalidCredentials")));
    } finally {
      setAuthLoading(false);
    }
  }

  async function onForgotSendCode(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em) return setAuthError(tLogin("login.emailRequired"));
    setAuthLoading(true);
    try {
      await api("/auth/forgot-password/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setForgotStep("code");
      setForgotInfo("");
    } catch (err: any) {
      setAuthError(err?.message ?? tLogin("login.failedToSendCode"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function onForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    if (!forgotEmail.trim() || !forgotCode.trim()) return setAuthError(tLogin("login.emailAndCodeRequired"));
    if (forgotNewPassword.length < 8) return setAuthError(tLogin("login.passwordMinLength"));
    setAuthLoading(true);
    try {
      await api("/auth/forgot-password/verify", {
        method: "POST",
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          code: forgotCode.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      setForgotSuccess(true);
    } catch (err: any) {
      setAuthError(err?.message ?? tLogin("login.failedToResetPassword"));
    } finally {
      setAuthLoading(false);
    }
  }

  function startForgot() {
    setForgotStep("email");
    setForgotEmail("");
    setForgotCode("");
    setForgotNewPassword("");
    setForgotSuccess(false);
    setForgotInfo("");
    setAuthError("");
  }

  function backToAuthLogin() {
    setForgotStep(null);
    setForgotSuccess(false);
    setAuthError("");
  }

  async function onRegisterRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError("");
    setRegisterInfo("");
    const em = normalizeEmail(registerEmail);
    if (!em) {
      setRegisterError(tLogin("login.emailRequired"));
      return;
    }
    setRegisterLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setRegisterStep("verify");
      setRegisterInfo(res.alreadySent
        ? (i18n.language === "es" ? "Ya te enviamos un código. Revisá tu bandeja (y spam)." : "A code was already sent. Check your inbox (and spam).")
        : (i18n.language === "es" ? "Te enviamos un código de 6 dígitos. Puede tardar unos minutos. Revisá tu bandeja (y spam)." : "We sent you a 6-digit code. It may take a few minutes to arrive. Check your inbox (and spam)."));
    } catch (err: any) {
      setRegisterError(err?.message ?? (lang === "es" ? "Error al enviar código" : "Error sending code"));
    } finally {
      setRegisterLoading(false);
    }
  }

  async function onRegisterVerifyAndCreate(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError("");
    setRegisterInfo("");
    const em = normalizeEmail(registerEmail);
    const c = String(registerCode || "").trim();
    const pw = String(registerPassword || "");

    if (!em) return setRegisterError(tLogin("login.emailRequired"));
    if (!c) return setRegisterError(tLogin("login.codeRequired") ?? "Code is required");
    if (!pw) return setRegisterError(tLogin("login.passwordRequired") ?? "Password is required");
    if (pw.length < 8) return setRegisterError(tLogin("login.passwordMinLength") ?? "Password must be at least 8 characters");

    setRegisterLoading(true);
    try {
      const r = await api<{ token: string }>("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email: em, code: c, password: pw }),
      });
      localStorage.setItem("token", r.token);
      nav(APP_BASE, { replace: true });
    } catch (err: any) {
      setRegisterError(err?.message ?? (lang === "es" ? "Error al crear cuenta" : "Error creating account"));
    } finally {
      setRegisterLoading(false);
    }
  }

  async function onRegisterResendCode() {
    setRegisterError("");
    setRegisterInfo("");
    const em = normalizeEmail(registerEmail);
    if (!em) return setRegisterError(tLogin("login.emailRequired"));

    setRegisterLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setRegisterInfo(res.alreadySent
        ? (i18n.language === "es" ? "Ya te enviamos un código. Revisá tu bandeja (y spam)." : "A code was already sent. Check your inbox (and spam).")
        : (i18n.language === "es" ? "Código reenviado. Puede tardar unos minutos." : "New code sent. It may take a few minutes to arrive."));
    } catch (err: any) {
      setRegisterError(err?.message ?? (lang === "es" ? "Error al reenviar código" : "Error resending code"));
    } finally {
      setRegisterLoading(false);
    }
  }

  return (
    <div className="landing">
      {/* Top bar — quick login */}
      <header className="landing-topbar">
        <div className="landing-topbar-inner">
          <span className="landing-topbar-brand">ground</span>
          <form className="landing-topbar-form" onSubmit={onTopBarLogin}>
            <input
              type="email"
              className="landing-topbar-input"
              placeholder={t.topBarEmail}
              value={topBarEmail}
              onChange={(e) => setTopBarEmail(e.target.value)}
              autoComplete="email"
              aria-label={t.topBarEmail}
            />
            <input
              type="password"
              className="landing-topbar-input"
              placeholder={t.topBarPassword}
              value={topBarPassword}
              onChange={(e) => setTopBarPassword(e.target.value)}
              autoComplete="current-password"
              aria-label={t.topBarPassword}
            />
            <button type="submit" className="landing-topbar-btn" disabled={topBarLoading}>
              {topBarLoading ? "…" : t.topBarSignIn}
            </button>
          </form>
          {topBarError && <span className="landing-topbar-error" role="alert">{topBarError}</span>}
        </div>
      </header>

      {/* Hero — visible on load */}
      <section className="landing-hero landing-hero-animate" data-landing-section="hero">
        {/* Hero content - visible immediately */}
        <div className="landing-hero-left">
          <span className="landing-logo">ground</span>
          <p className="landing-tagline">{t.tagline}</p>
          <h1 className="landing-headline">{t.headline}</h1>
          <p className="landing-subheadline">{t.subheadline}</p>
          <div className="landing-ctas">
            <button type="button" className="landing-cta-primary" onClick={showAuth}>
              {t.ctaPrimary}
            </button>
            <button type="button" className="landing-cta-secondary" onClick={scrollToHow}>
              {t.ctaSecondary}
            </button>
          </div>
          <div className="landing-lang">
            <button
              type="button"
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
              aria-label="English"
            >
              EN
            </button>
            <span className="landing-lang-sep">·</span>
            <button
              type="button"
              className={lang === "es" ? "active" : ""}
              onClick={() => setLang("es")}
              aria-label="Español"
            >
              ES
            </button>
          </div>
        </div>

        <div className="landing-hero-right">
          {showAuthBox ? (
            <div className="landing-auth-box auth-shell">
              <div className="login-panel">
                <div className="login-card">
                  <button
                    type="button"
                    className="landing-auth-close"
                    onClick={hideAuth}
                    aria-label={lang === "es" ? "Cerrar" : "Close"}
                  >
                    ×
                  </button>
                  {authMode === "register" ? (
                    <>
                      <h2>{tLogin("register.title")}</h2>
                      <p className="muted" style={{ marginBottom: 24 }}>
                        {registerStep === "request" ? tLogin("register.requestSubtitle") : tLogin("register.verifySubtitle")}
                      </p>

                      {registerStep === "request" ? (
                        <form onSubmit={onRegisterRequestCode} className="login-form">
                          <div>
                            <label className="label">{tLogin("register.email")}</label>
                            <input
                              className="input"
                              type="email"
                              value={registerEmail}
                              onChange={(e) => setRegisterEmail(e.target.value)}
                              required
                              autoComplete="email"
                              placeholder={tLogin("login.placeholderEmail")}
                            />
                          </div>
                          {registerError && <div className="error">{registerError}</div>}
                          {registerInfo && <div className="muted" style={{ fontSize: "0.875rem" }}>{registerInfo}</div>}
                          <button className="btn primary" type="submit" disabled={registerLoading}>
                            {registerLoading ? tLogin("register.sending") : tLogin("register.sendCode")}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={onRegisterVerifyAndCreate} className="login-form">
                          <p className="muted" style={{ marginBottom: 8 }}>
                            {tLogin("register.codeSentTo")} <strong>{normalizeEmail(registerEmail)}</strong>
                          </p>
                          <div>
                            <label className="label">{tLogin("register.verificationCode")}</label>
                            <input
                              className="input"
                              value={registerCode}
                              onChange={(e) => setRegisterCode(e.target.value)}
                              placeholder={tLogin("register.placeholderCode")}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              required
                            />
                          </div>
                          <div>
                            <label className="label">{tLogin("register.password")}</label>
                            <div className="auth-input-wrap">
                              <input
                                className="input"
                                type={registerShowPassword ? "text" : "password"}
                                value={registerPassword}
                                onChange={(e) => setRegisterPassword(e.target.value)}
                                required
                                minLength={8}
                                autoComplete="new-password"
                                placeholder={tLogin("login.placeholderPassword")}
                              />
                              <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setRegisterShowPassword(!registerShowPassword)}
                                aria-label={registerShowPassword ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")}
                                tabIndex={-1}
                              >
                                {registerShowPassword ? (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                )}
                              </button>
                            </div>
                            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                              {tLogin("register.minChars")}
                            </p>
                          </div>
                          {registerError && <div className="error">{registerError}</div>}
                          {registerInfo && <div className="muted" style={{ fontSize: "0.875rem" }}>{registerInfo}</div>}
                          <button className="btn primary" type="submit" disabled={registerLoading}>
                            {registerLoading ? tLogin("register.creating") : tLogin("register.createAccount")}
                          </button>
                          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <button
                              className="btn"
                              type="button"
                              disabled={registerLoading}
                              onClick={() => {
                                setRegisterStep("request");
                                setRegisterCode("");
                                setRegisterPassword("");
                                setRegisterError("");
                                setRegisterInfo("");
                              }}
                            >
                              {tLogin("register.changeEmail")}
                            </button>
                            <button
                              className="btn"
                              type="button"
                              disabled={registerLoading}
                              onClick={onRegisterResendCode}
                            >
                              {tLogin("register.resendCode")}
                            </button>
                          </div>
                        </form>
                      )}

                      <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
                        {tLogin("register.alreadyHave")}{" "}
                        <button type="button" className="link-btn" onClick={() => showAuth("login")}>
                          {tLogin("register.signIn")}
                        </button>
                      </p>
                    </>
                  ) : forgotSuccess ? (
                    <>
                      <h2>{tLogin("login.passwordResetTitle")}</h2>
                      <p className="muted" style={{ marginBottom: 24 }}>{tLogin("login.passwordResetDone")}</p>
                      <button type="button" className="btn primary" onClick={backToAuthLogin}>
                        {tLogin("login.backToSignIn")}
                      </button>
                    </>
                  ) : forgotStep === "email" ? (
                    <>
                      <h2>{tLogin("login.forgotTitle")}</h2>
                      <p className="muted" style={{ marginBottom: 24 }}>{tLogin("login.forgotSubtitle")}</p>
                      <form onSubmit={onForgotSendCode} className="login-form">
                        <div>
                          <label className="label">{tLogin("login.email")}</label>
                          <input
                            className="input"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder={tLogin("login.placeholderEmail")}
                            required
                          />
                        </div>
                        {authError && <div className="error">{authError}</div>}
                        <button className="btn primary" type="submit" disabled={authLoading}>
                          {authLoading ? tLogin("login.sending") : tLogin("login.sendResetCode")}
                        </button>
                      </form>
                      <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                        <button type="button" className="link-btn" onClick={backToAuthLogin}>
                          {tLogin("login.backToSignIn")}
                        </button>
                      </p>
                    </>
                  ) : forgotStep === "code" ? (
                    <>
                      <h2>{tLogin("login.resetTitle")}</h2>
                      <p className="muted" style={{ marginBottom: 12 }}>
                        <Trans i18nKey="login.resetSubtitle" values={{ email: forgotEmail }} components={{ 1: <strong /> }} />
                      </p>
                      <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>{tLogin("login.resetEmailNote")}</p>
                      {forgotInfo && <div className="toast-success" style={{ marginBottom: 16 }}>{forgotInfo}</div>}
                      <form onSubmit={onForgotReset} className="login-form">
                        <div>
                          <label className="label">{tLogin("login.code")}</label>
                          <input
                            className="input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={forgotCode}
                            onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder={tLogin("login.placeholderCode")}
                            maxLength={6}
                          />
                        </div>
                        <div>
                          <label className="label">{tLogin("login.newPassword")}</label>
                          <div className="auth-input-wrap">
                            <input
                              className="input"
                              type={authShowPassword ? "text" : "password"}
                              value={forgotNewPassword}
                              onChange={(e) => setForgotNewPassword(e.target.value)}
                              placeholder={tLogin("login.placeholderPassword")}
                              minLength={8}
                              required
                            />
                            <button
                              type="button"
                              className="auth-password-toggle"
                              onClick={() => setAuthShowPassword(!authShowPassword)}
                              aria-label={authShowPassword ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")}
                              tabIndex={-1}
                            >
                              {authShowPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        {authError && <div className="error">{authError}</div>}
                        <button className="btn primary" type="submit" disabled={authLoading}>
                          {authLoading ? tLogin("login.resetting") : tLogin("login.resetPassword")}
                        </button>
                      </form>
                      <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                        <button type="button" className="link-btn" onClick={startForgot}>
                          {tLogin("login.useDifferentEmail")}
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <h2>{tLogin("login.title")}</h2>
                      <p className="muted" style={{ marginBottom: 24 }}>{tLogin("login.subtitle")}</p>
                      <form onSubmit={onAuthLoginSubmit} className="login-form">
                        <div>
                          <label className="label">{tLogin("login.email")}</label>
                          <input
                            className="input"
                            type="email"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder={tLogin("login.placeholderEmail")}
                            required
                          />
                        </div>
                        <div>
                          <label className="label">{tLogin("login.password")}</label>
                          <div className="auth-input-wrap">
                            <input
                              className="input"
                              type={authShowPassword ? "text" : "password"}
                              value={authPassword}
                              onChange={(e) => setAuthPassword(e.target.value)}
                              placeholder={tLogin("login.placeholderPassword")}
                              required
                            />
                            <button
                              type="button"
                              className="auth-password-toggle"
                              onClick={() => setAuthShowPassword(!authShowPassword)}
                              aria-label={authShowPassword ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")}
                              tabIndex={-1}
                            >
                              {authShowPassword ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              )}
                            </button>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <button type="button" className="link-btn" style={{ fontSize: 13, padding: 0 }} onClick={startForgot}>
                              {tLogin("login.forgotPassword")}
                            </button>
                          </div>
                        </div>
                        {authError && <div className="error">{authError}</div>}
                        <button className="btn primary" type="submit" disabled={authLoading}>
                          {authLoading ? tLogin("login.signingIn") : tLogin("login.signIn")}
                        </button>
                      </form>
                      <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
                        {tLogin("login.newToGround")}{" "}
                        <button type="button" className="link-btn" onClick={() => showAuth("register")}>
                          {tLogin("login.createAccountLink")}
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="landing-preview landing-preview-laptop">
              <img
                src="/ground-laptop.png"
                alt={t.previewTitle}
                className="landing-preview-img"
              />
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section
        ref={howSectionRef}
        id="how"
        data-landing-section="how"
        className={`landing-section landing-section-how ${visibleSections.has("how") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-section-title">{t.howItWorks}</h2>
        <p className="landing-section-subtitle">{t.howItWorksSub}</p>
        <div className="landing-steps">
          <div className="landing-step-card">
            <h3 className="landing-step-title">{t.step1Title}</h3>
            <img src="/how-captura.png" alt={t.step1Title} className="landing-step-img" />
            <p className="landing-step-desc">{t.step1Desc}</p>
          </div>
          <div className="landing-step-card">
            <h3 className="landing-step-title">{t.step2Title}</h3>
            <img src="/how-entende.png" alt={t.step2Title} className="landing-step-img" />
            <p className="landing-step-desc">{t.step2Desc}</p>
          </div>
          <div className="landing-step-card">
            <h3 className="landing-step-title">{t.step3Title}</h3>
            <img src="/how-planifica.png" alt={t.step3Title} className="landing-step-img" />
            <p className="landing-step-desc">{t.step3Desc}</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section
        data-landing-section="benefits"
        className={`landing-section landing-section-benefits ${visibleSections.has("benefits") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-section-title">{t.benefits}</h2>
        <p className="landing-section-subtitle">{t.benefitsSub}</p>
        <div className="landing-benefits-grid">
          <div className="landing-benefit">{t.benefit1}</div>
          <div className="landing-benefit">{t.benefit2}</div>
          <div className="landing-benefit">{t.benefit3}</div>
          <div className="landing-benefit">{t.benefit4}</div>
          <div className="landing-benefit">{t.benefit5}</div>
          <div className="landing-benefit">{t.benefit6}</div>
        </div>
      </section>

      {/* Trust strip */}
      <section
        data-landing-section="trust"
        className={`landing-trust ${visibleSections.has("trust") ? "landing-reveal" : ""}`}
      >
        <div className="landing-trust-inner">
          <span className="landing-trust-main">{t.trust}</span>
          <div className="landing-trust-bullets">
            <span className="landing-trust-bullet">• {t.trust1}</span>
            <span className="landing-trust-bullet">• {t.trust2}</span>
            <span className="landing-trust-bullet">• {t.trust3}</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        data-landing-section="pricing"
        className={`landing-section landing-section-pricing ${visibleSections.has("pricing") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-section-title">{t.pricing}</h2>
        <p className="landing-section-subtitle">{t.pricingSub}</p>
        <div className="landing-pricing">
          <div className="landing-price-card landing-price-card-featured">
            <span className="landing-price-badge">{t.earlyStageBadge}</span>
            <h3 className="landing-price-name">{t.earlyStage}</h3>
            <p className="landing-price-amount">{t.earlyStagePrice}</p>
            <p className="landing-price-desc">
              <button type="button" className="landing-price-desc-link" onClick={() => showAuth("register")}>{t.earlyStageDesc}</button>
            </p>
            <ul className="landing-price-features">
              <li>{t.earlyStage1}</li>
              <li>{t.earlyStage2}</li>
            </ul>
          </div>
          <div className="landing-price-card landing-price-card-muted">
            <span className="landing-price-badge landing-price-badge-muted">{t.proBadge}</span>
            <h3 className="landing-price-name">{t.pro}</h3>
            <p className="landing-price-trial">{t.proPriceTrial}</p>
            <p className="landing-price-amount">{t.proPriceAmount}</p>
            <ul className="landing-price-features">
              <li>{t.pro1}</li>
              <li>{t.pro2}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        data-landing-section="faq"
        className={`landing-section landing-section-faq ${visibleSections.has("faq") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-section-title">{t.faq}</h2>
        <div className="landing-faq">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="landing-faq-item">
              <button
                type="button"
                className="landing-faq-toggle"
                aria-expanded={openFaq === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{t[item.q]}</span>
                <span className="landing-faq-icon" aria-hidden>▼</span>
              </button>
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className="landing-faq-content"
                style={{ display: openFaq === i ? "block" : "none" }}
              >
                {t[item.a]}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section
        data-landing-section="testimonial"
        className={`landing-section landing-section-testimonial landing-testimonial ${visibleSections.has("testimonial") ? "landing-reveal" : ""}`}
      >
        <blockquote className="landing-testimonial-quote">
          &ldquo;{t.testimonial}&rdquo;
        </blockquote>
        <cite className="landing-testimonial-author">— {t.testimonialAuthor}</cite>
      </section>

      {/* Final CTA */}
      <section
        data-landing-section="final"
        className={`landing-final-cta ${visibleSections.has("final") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-final-headline">{t.finalHeadline}</h2>
        <button type="button" className="landing-final-btn" onClick={showAuth}>
          {t.finalCta}
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <Link to="/" className="landing-footer-brand">ground</Link>
        <div className="landing-footer-links">
          <button type="button" className="landing-footer-link" onClick={showAuth}>{t.footerLogin}</button>
          <button type="button" className="landing-footer-link" onClick={() => showAuth("register")}>{t.footerCreate}</button>
          <Link to="/terms">{t.footerTerms}</Link>
          <Link to="/privacy">{t.footerPrivacy}</Link>
        </div>
        <span className="landing-footer-year">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
