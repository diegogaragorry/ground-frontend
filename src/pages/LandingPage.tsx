import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { generateEncryptionSalt, deriveEncryptionKey, importKeyFromBase64 } from "../utils/crypto";
import { buildCountryOptions, isValidCountryCode } from "../utils/countries";
import { APP_BASE, CONTACT_WHATSAPP_URL } from "../constants";
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
    benefit7: "Cifrado E2EE: solo vos podés ver tus datos sensibles",
    benefitsLead: "Resultado antes que planilla: cada bloque apunta a una mejora concreta en tu mes.",
    benefitHeroEyebrow: "Resultado principal",
    benefitHeroTitle: "Ahorrá 3-5 horas por mes de control financiero",
    benefitHeroDesc: "Centralizá gastos, ingresos, presupuesto y patrimonio en un solo flujo, sin armar ni mantener planillas.",
    benefitHeroProof: "Prueba: onboarding guiado + plantillas + cierre mensual en el mismo lugar.",
    benefitHeroCta: "Crear cuenta gratis",
    benefitCard1Title: "Detectá fugas de gasto en minutos",
    benefitCard1Desc: "Visualizá top categorías y gastos repetidos para corregir desvíos rápido.",
    benefitCard1Proof: "Prueba: ranking de categorías y panel mensual.",
    benefitCard1Cta: "Ver ejemplo",
    benefitCard2Title: "Decidí con contexto real del mes",
    benefitCard2Desc: "Combiná ejecución vs presupuesto para anticiparte antes del cierre.",
    benefitCard2Proof: "Prueba: presupuesto mensual + anual en un mismo flujo.",
    benefitCard2Cta: "Probar flujo guiado",
    benefitCard3Title: "Tu patrimonio deja de ser una caja negra",
    benefitCard3Desc: "Alineá cuentas e inversiones con tus ingresos y gastos en una vista coherente.",
    benefitCard3Proof: "Prueba: cierre de mes que fija cifras y evita inconsistencias.",
    benefitCard3Cta: "Empezar ahora",
    benefitCard4Title: "Exportá y auditá cuando quieras",
    benefitCard4Desc: "Llevate los datos a CSV/Excel para análisis, respaldo o contador.",
    benefitCard4Proof: "Prueba: exportación disponible por módulo.",
    benefitCard4Cta: "Ver cómo funciona",
    benefitCard5Title: "Operá en multi-moneda sin fricción",
    benefitCard5Desc: "Registrá y compará valores en distintas monedas con tipo de cambio actualizado.",
    benefitCard5Proof: "Prueba: FX integrado en gastos, ingresos e inversiones.",
    benefitCard5Cta: "Crear cuenta",
    benefitCard6Title: "Mantené privacidad real en tus datos sensibles",
    benefitCard6Desc: "Tus montos y descripciones sensibles se cifran antes de salir de tu dispositivo.",
    benefitCard6Proof: "Prueba: E2EE, el servidor no puede leerlos.",
    benefitCard6Cta: "Probar ground",
    trust: "Hecho para finanzas reales",
    trust1: "Privado por diseño",
    trust2: "Guía simple de configuración",
    trust3: "Tus datos son tuyos",
    pricing: "Planes",
    pricingSub: "Registrate ahora y empezá con 2 meses gratis",
    earlyStage: "Early Stage",
    earlyStageBadge: "Actual",
    earlyStageCta: "Registrate ahora",
    earlyStagePrice: "2 meses gratis",
    earlyStage1: "Acceso completo",
    earlyStage2: "Este grupo tendrá acceso prioritario al Pro Early cuando esté disponible",
    earlyStage3: "Capacidad de descargar todos tus datos en cualquier momento.",
    pro: "Pro Early",
    proBadge: "Próximamente",
    proExclusive: "Solo para usuarios Early Stage y un grupo limitado",
    proPriceTrial: "1 mes gratis",
    proPriceAmount: "USD 3.99/mes",
    proPriceNote: "a partir del 2º mes",
    pro1: "Lo mismo que Early Stage +",
    pro2: "Cancelá cuando quieras",
    pro3: "Exportá tus datos cuando quieras",
    proStandard: "Pro estándar",
    proStandardPrice: "USD 5.99/mes",
    proStandard1: "Acceso completo",
    proStandard2: "Precio de lista cuando se acaben los cupos de Pro Early",
    proStandard3: "Cancelá cuando quieras",
    faq: "Preguntas frecuentes",
    faq1Q: "¿Es una integración bancaria?",
    faq1A: "No. Ingresás tus datos manualmente. Así mantenés el control y la privacidad.",
    faq2Q: "¿Qué monedas soporta?",
    faq2A: "Multi-moneda con tipo de cambio actualizado automáticamente. Podés registrar gastos, ingresos e inversiones en las monedas soportadas.",
    faq3Q: "¿Cómo es el onboarding?",
    faq3A: "Un wizard simple: categorías, plantillas de gastos fijos, cuenta bancaria e inversiones. Podés saltar pasos y completar después.",
    faq4Q: "¿Qué pasa después de los 2 meses gratis?",
    faq4A: "Tenés dos opciones: pasás al plan Pro (cuando esté disponible) o descargás todos tus datos en CSV/Excel antes de que termine el periodo.",
    faq5Q: "¿Puedo exportar mis datos?",
    faq5A: "Sí. Podés exportar gastos, presupuesto y movimientos a CSV o Excel para análisis, backup o compartir con tu contador.",
    faq6Q: "¿Qué es el cierre de mes?",
    faq6A: "Es un paso que congela las cifras del mes. Una vez cerrado, los gastos y el patrimonio quedan fijos. Esto te ayuda a detectar inconsistencias entre lo que registrás y lo que realmente sale de tus cuentas, tomar conciencia de tus gastos y tener más control.",
    faq7Q: "¿Funciona en el celular?",
    faq7A: "ground. está pensado principalmente para desktop (pantalla grande). En mobile podés ver el panel y crear gastos; el uso completo está optimizado para escritorio.",
    faq8Q: "¿Cómo me ayuda con el control mensual?",
    faq8A: "Las plantillas de gastos y el flujo guiado acortan mucho el tiempo necesario para llevar el control. Además, te ayuda a recordar qué cosas tenés que pagar todos los meses y mantener el seguimiento sin esfuerzo.",
    faq9Q: "¿Qué significa que los datos estén cifrados con E2EE?",
    faq9A: "Significa que los montos y descripciones sensibles se cifran en tu dispositivo antes de enviarse. El servidor guarda datos cifrados y no puede leerlos; solo vos, con tu clave, podés descifrarlos.",
    finalHeadline: "Empezá a gastar con propósito hoy.",
    finalCta: "Crear cuenta / Iniciar sesión",
    footerLogin: "Iniciar sesión",
    footerCreate: "Crear cuenta",
    footerContact: "Contacto",
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
    proofPill1: "Cifrado E2EE real",
    proofPill2: "Setup guiado en minutos",
    proofPill3: "Cierre de mes confiable",
    heroStat1Label: "Flujo",
    heroStat1Value: "Captura → Entiende → Planifica",
    heroStat2Label: "Privacidad",
    heroStat2Value: "Solo vos descifrás tus datos",
    storyTitle: "Control financiero, sin fricción",
    storyLead: "Ground combina registro diario, presupuesto y patrimonio en un flujo único para que tomes decisiones con contexto real.",
    storyBullet1: "Gastos, ingresos y patrimonio alineados en un mismo timeline.",
    storyBullet2: "Cierre mensual para evitar desvíos y comparar meses en serio.",
    storyBullet3: "Datos exportables siempre, sin lock-in.",
    storyCta: "Crear cuenta gratis",
    testimonial2: "Pasé de planillas dispersas a una visión clara del mes y del patrimonio.",
    testimonial2Author: "Usuario Pro Early",
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
    benefit7: "E2EE encryption: only you can read sensitive data",
    benefitsLead: "Outcome over spreadsheets: each block targets a concrete monthly improvement.",
    benefitHeroEyebrow: "Primary outcome",
    benefitHeroTitle: "Save 3-5 hours per month on financial control",
    benefitHeroDesc: "Centralize expenses, income, budget, and net worth in one flow, without building or maintaining spreadsheets.",
    benefitHeroProof: "Proof: guided onboarding + templates + month-end close in one place.",
    benefitHeroCta: "Create free account",
    benefitCard1Title: "Spot spending leaks in minutes",
    benefitCard1Desc: "See top categories and recurring expenses so you can correct drift quickly.",
    benefitCard1Proof: "Proof: category ranking and monthly dashboard.",
    benefitCard1Cta: "See example",
    benefitCard2Title: "Decide with real month context",
    benefitCard2Desc: "Combine actuals vs budget so you can act before month close.",
    benefitCard2Proof: "Proof: monthly + annual planning in one flow.",
    benefitCard2Cta: "Try guided flow",
    benefitCard3Title: "Make net worth no longer a black box",
    benefitCard3Desc: "Align accounts and investments with income and expenses in one coherent view.",
    benefitCard3Proof: "Proof: month-end close locks figures and prevents inconsistencies.",
    benefitCard3Cta: "Get started",
    benefitCard4Title: "Export and audit anytime",
    benefitCard4Desc: "Take your data to CSV/Excel for analysis, backup, or accountant workflows.",
    benefitCard4Proof: "Proof: exports available per module.",
    benefitCard4Cta: "See how it works",
    benefitCard5Title: "Handle multi-currency without friction",
    benefitCard5Desc: "Track and compare values in different currencies with updated FX rates.",
    benefitCard5Proof: "Proof: FX integrated across expenses, income, and investments.",
    benefitCard5Cta: "Create account",
    benefitCard6Title: "Keep real privacy for sensitive data",
    benefitCard6Desc: "Sensitive amounts and descriptions are encrypted before leaving your device.",
    benefitCard6Proof: "Proof: E2EE, server cannot read them.",
    benefitCard6Cta: "Try ground",
    trust: "Built for real life finances",
    trust1: "Private by design",
    trust2: "Simple setup guide",
    trust3: "Data stays yours",
    pricing: "Plans",
    pricingSub: "Sign up now and start with 2 months free",
    earlyStage: "Early Stage",
    earlyStageBadge: "Current",
    earlyStageCta: "Sign up now",
    earlyStagePrice: "2 months free",
    earlyStage1: "Full access",
    earlyStage2: "This group gets priority access to Pro Early when available",
    earlyStage3: "Download all your data anytime.",
    pro: "Pro Early",
    proBadge: "Coming soon",
    proExclusive: "Only for Early Stage users and a limited group",
    proPriceTrial: "1 month free",
    proPriceAmount: "USD 3.99/mo",
    proPriceNote: "from month 2",
    pro1: "Same as Early Stage +",
    pro2: "Cancel anytime",
    pro3: "Export your data anytime",
    proStandard: "Pro standard",
    proStandardPrice: "USD 5.99/mo",
    proStandard1: "Full access",
    proStandard2: "List price when Pro Early slots run out",
    proStandard3: "Cancel anytime",
    faq: "FAQ",
    faq1Q: "Is this a bank integration?",
    faq1A: "No. You enter your data manually. That keeps you in control and your data private.",
    faq2Q: "What currencies does it support?",
    faq2A: "Multi-currency with automatically updated exchange rates. You can record expenses, income, and investments in supported currencies.",
    faq3Q: "How does onboarding work?",
    faq3A: "A simple wizard: categories, fixed expense templates, bank account, and investments. You can skip steps and complete them later.",
    faq4Q: "What happens after the 2 free months?",
    faq4A: "You have two options: upgrade to Pro (when available) or download all your data in CSV/Excel before the period ends.",
    faq5Q: "Can I export my data?",
    faq5A: "Yes. You can export expenses, budget, and movements to CSV or Excel for analysis, backup, or sharing with your accountant.",
    faq6Q: "What is month-end close?",
    faq6A: "A step that freezes the month's figures. Once closed, expenses and net worth are locked. This helps you spot inconsistencies between what you record and what actually leaves your accounts, become more aware of your spending, and gain more control.",
    faq7Q: "Does it work on mobile?",
    faq7A: "ground. is designed primarily for desktop (large screen). On mobile you can view the dashboard and create expenses; full use is optimized for desktop.",
    faq8Q: "How does it help with monthly control?",
    faq8A: "Expense templates and the guided flow greatly shorten the time needed for financial control. It also helps you remember what you need to pay every month and keep track without extra effort.",
    faq9Q: "What does E2EE encryption mean for my data?",
    faq9A: "It means sensitive amounts and descriptions are encrypted on your device before upload. The server stores encrypted data and cannot read it; only you, with your key, can decrypt it.",
    finalHeadline: "Start spending with purpose today.",
    finalCta: "Create account / Sign in",
    footerLogin: "Sign in",
    footerCreate: "Create account",
    footerContact: "Contact",
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
    proofPill1: "Real E2EE encryption",
    proofPill2: "Guided setup in minutes",
    proofPill3: "Reliable month-end close",
    heroStat1Label: "Flow",
    heroStat1Value: "Capture → Understand → Plan",
    heroStat2Label: "Privacy",
    heroStat2Value: "Only you can decrypt your data",
    storyTitle: "Financial control, without friction",
    storyLead: "Ground combines daily tracking, budget and net worth in one flow so you can decide with real context.",
    storyBullet1: "Expenses, income, and net worth aligned in the same timeline.",
    storyBullet2: "Monthly close to prevent drift and compare months seriously.",
    storyBullet3: "Always exportable data, no lock-in.",
    storyCta: "Create free account",
    testimonial2: "I moved from scattered spreadsheets to a clear view of my month and net worth.",
    testimonial2Author: "Pro Early user",
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
  { q: "faq9Q", a: "faq9A" },
] as const;

const BENEFIT_ITEMS = [
  { title: "benefitCard1Title", desc: "benefitCard1Desc", proof: "benefitCard1Proof", cta: "benefitCard1Cta", action: "how" },
  { title: "benefitCard2Title", desc: "benefitCard2Desc", proof: "benefitCard2Proof", cta: "benefitCard2Cta", action: "how" },
  { title: "benefitCard3Title", desc: "benefitCard3Desc", proof: "benefitCard3Proof", cta: "benefitCard3Cta", action: "auth" },
  { title: "benefitCard4Title", desc: "benefitCard4Desc", proof: "benefitCard4Proof", cta: "benefitCard4Cta", action: "how" },
  { title: "benefitCard5Title", desc: "benefitCard5Desc", proof: "benefitCard5Proof", cta: "benefitCard5Cta", action: "auth" },
  { title: "benefitCard6Title", desc: "benefitCard6Desc", proof: "benefitCard6Proof", cta: "benefitCard6Cta", action: "auth" },
] as const;

type LoginUser = { id: string; email: string; role: string; encryptionSalt?: string; recoveryEnabled?: boolean; encryptionKey?: string };
type LoginResp = { token?: string; accessToken?: string; jwt?: string; data?: { token?: string }; user?: LoginUser };
function pickToken(r: LoginResp | any): string | null {
  const t = r?.token ?? r?.accessToken ?? r?.jwt ?? r?.data?.token;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

type ForgotStep = null | "email" | "code";
type RegisterStep = "request" | "verify";

function normalizePhone(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

export default function LandingPage() {
  const nav = useNavigate();
  const { t: tLogin, i18n } = useTranslation();
  const { setEncryptionKey } = useEncryption();
  const [lang, setLang] = useState<Lang>("es");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const howSectionRef = useRef<HTMLDivElement | null>(null);

  const [topBarEmail, setTopBarEmail] = useState("");
  const [topBarPassword, setTopBarPassword] = useState("");
  const [topBarLoading, setTopBarLoading] = useState(false);
  const [topBarError, setTopBarError] = useState("");
  const [topBarFormExpanded, setTopBarFormExpanded] = useState(false);
  const [isTopBarMobile, setIsTopBarMobile] = useState(false);

  const [showAuthBox, setShowAuthBox] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotPhoneCode, setForgotPhoneCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotInfo, setForgotInfo] = useState("");
  const [forgotUseRecovery, setForgotUseRecovery] = useState(false);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("request");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerCountry, setRegisterCountry] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerInfo, setRegisterInfo] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerShowPassword, setRegisterShowPassword] = useState(false);

  const t = COPY[lang];
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || "es"), [i18n.language]);
  const proofPills = [t.proofPill1, t.proofPill2, t.proofPill3];

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    const update = () => setIsTopBarMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

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
      if (!token) {
        setTopBarError(lang === "es" ? "Error al iniciar sesión" : "Login failed");
        return;
      }
      const user = resp?.user as LoginUser | undefined;
      if (user?.encryptionKey) {
        try {
          const k = await importKeyFromBase64(user.encryptionKey);
          setEncryptionKey(k);
        } catch {
          if (user?.encryptionSalt) {
            try {
              const k = await deriveEncryptionKey(topBarPassword, user.encryptionSalt);
              setEncryptionKey(k);
            } catch {
              setEncryptionKey(null);
            }
          } else {
            setEncryptionKey(null);
          }
        }
      } else if (user?.encryptionSalt) {
        try {
          const k = await deriveEncryptionKey(topBarPassword, user.encryptionSalt);
          setEncryptionKey(k);
        } catch {
          setEncryptionKey(null);
        }
      } else {
        setEncryptionKey(null);
      }
      localStorage.setItem("token", token);
      nav(APP_BASE, { replace: true });
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
      setRegisterFirstName("");
      setRegisterLastName("");
      setRegisterEmail("");
      setRegisterPhone("");
      setRegisterCountry("");
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
      if (!token) {
        setAuthError(lang === "es" ? "Error al iniciar sesión" : "Login failed");
        return;
      }
      const user = resp?.user as LoginUser | undefined;
      if (user?.encryptionKey) {
        try {
          const k = await importKeyFromBase64(user.encryptionKey);
          setEncryptionKey(k);
        } catch {
          if (user?.encryptionSalt) {
            try {
              const k = await deriveEncryptionKey(authPassword, user.encryptionSalt);
              setEncryptionKey(k);
            } catch {
              setEncryptionKey(null);
            }
          } else {
            setEncryptionKey(null);
          }
        }
      } else if (user?.encryptionSalt) {
        try {
          const k = await deriveEncryptionKey(authPassword, user.encryptionSalt);
          setEncryptionKey(k);
        } catch {
          setEncryptionKey(null);
        }
      } else {
        setEncryptionKey(null);
      }
      localStorage.setItem("token", token);
      nav(APP_BASE, { replace: true });
    } catch (err: any) {
      setAuthError(err?.message === "Invalid credentials"
        ? tLogin("login.invalidCredentials")
        : (err?.message ?? tLogin("login.invalidCredentials")));
    } finally {
      setAuthLoading(false);
    }
  }

  async function onForgotSendRecoveryCodes(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em) return setAuthError(tLogin("login.emailRequired"));
    setAuthLoading(true);
    try {
      const data = await api<{ ok?: boolean; emailOnly?: boolean }>("/auth/recovery/request", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setForgotUseRecovery(!data?.emailOnly);
      setForgotStep("code");
      setForgotInfo(data?.emailOnly ? tLogin("login.emailOnlySubtitle") : tLogin("login.recoverySubtitle"));
    } catch (err: any) {
      setAuthError(err?.message ?? tLogin("login.failedToSendCode"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function onForgotSendLegacyCode(e: React.FormEvent) {
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
      setForgotUseRecovery(false);
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
    if (forgotUseRecovery && !forgotPhoneCode.trim()) return setAuthError(tLogin("account.codeRequired"));
    if (forgotNewPassword.length < 8) return setAuthError(tLogin("login.passwordMinLength"));
    setAuthLoading(true);
    try {
      if (forgotUseRecovery) {
        const verifyRes = await api<{ recoveryToken: string; encryptionKey: string }>("/auth/recovery/verify", {
          method: "POST",
          body: JSON.stringify({
            email: forgotEmail.trim().toLowerCase(),
            emailCode: forgotCode.trim(),
            phoneCode: forgotPhoneCode.trim(),
          }),
        });
        await api("/auth/recovery/set-password", {
          method: "POST",
          body: JSON.stringify({
            recoveryToken: verifyRes.recoveryToken,
            newPassword: forgotNewPassword,
            newRecoveryPackage: verifyRes.encryptionKey,
          }),
        });
      } else {
        await api("/auth/forgot-password/verify", {
          method: "POST",
          body: JSON.stringify({
            email: forgotEmail.trim().toLowerCase(),
            code: forgotCode.trim(),
            newPassword: forgotNewPassword,
          }),
        });
      }
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
    setForgotPhoneCode("");
    setForgotNewPassword("");
    setForgotSuccess(false);
    setForgotInfo("");
    setForgotUseRecovery(false);
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
    const firstName = registerFirstName.trim();
    const lastName = registerLastName.trim();
    const phone = normalizePhone(registerPhone);
    const country = registerCountry.trim().toUpperCase();
    if (!em) {
      setRegisterError(tLogin("login.emailRequired"));
      return;
    }
    if (!firstName) return setRegisterError(tLogin("register.firstNameRequired"));
    if (!lastName) return setRegisterError(tLogin("register.lastNameRequired"));
    if (!phone || phone.length < 10) return setRegisterError(tLogin("register.phoneRequired"));
    if (!country || !isValidCountryCode(country)) return setRegisterError(tLogin("register.countryRequired"));
    setRegisterLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em, firstName, lastName, phone, country }),
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
    const firstName = registerFirstName.trim();
    const lastName = registerLastName.trim();
    const phone = normalizePhone(registerPhone);
    const country = registerCountry.trim().toUpperCase();

    if (!em) return setRegisterError(tLogin("login.emailRequired"));
    if (!firstName) return setRegisterError(tLogin("register.firstNameRequired"));
    if (!lastName) return setRegisterError(tLogin("register.lastNameRequired"));
    if (!phone || phone.length < 10) return setRegisterError(tLogin("register.phoneRequired"));
    if (!country || !isValidCountryCode(country)) return setRegisterError(tLogin("register.countryRequired"));
    if (!c) return setRegisterError(tLogin("login.codeRequired") ?? "Code is required");
    if (!pw) return setRegisterError(tLogin("login.passwordRequired") ?? "Password is required");
    if (pw.length < 8) return setRegisterError(tLogin("login.passwordMinLength") ?? "Password must be at least 8 characters");

    setRegisterLoading(true);
    try {
      const encryptionSalt = generateEncryptionSalt();
      const r = await api<{ token: string }>("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email: em, code: c, password: pw, encryptionSalt, firstName, lastName, phone, country }),
      });
      try {
        const k = await deriveEncryptionKey(pw, encryptionSalt);
        setEncryptionKey(k);
      } catch {
        setEncryptionKey(null);
      }
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
    const firstName = registerFirstName.trim();
    const lastName = registerLastName.trim();
    const phone = normalizePhone(registerPhone);
    const country = registerCountry.trim().toUpperCase();
    if (!em) return setRegisterError(tLogin("login.emailRequired"));
    if (!firstName) return setRegisterError(tLogin("register.firstNameRequired"));
    if (!lastName) return setRegisterError(tLogin("register.lastNameRequired"));
    if (!phone || phone.length < 10) return setRegisterError(tLogin("register.phoneRequired"));
    if (!country || !isValidCountryCode(country)) return setRegisterError(tLogin("register.countryRequired"));

    setRegisterLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em, firstName, lastName, phone, country }),
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
          {isTopBarMobile && !topBarFormExpanded ? (
            <button
              type="button"
              className="landing-topbar-btn"
              onClick={() => setTopBarFormExpanded(true)}
              style={{ marginLeft: "auto" }}
            >
              {t.topBarSignIn}
            </button>
          ) : (
            <div className="landing-topbar-form-wrap" style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
              {topBarError && (
                <div className="landing-topbar-error-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%" }}>
                  <button
                    type="button"
                    className="landing-topbar-forgot-link"
                    onClick={() => {
                      setTopBarError("");
                      showAuth("login");
                      startForgot();
                      setForgotEmail(topBarEmail.trim() || authEmail.trim());
                    }}
                  >
                    {lang === "es" ? "¿Olvidaste la contraseña?" : "Forgot password?"}
                  </button>
                  <span className="landing-topbar-error" role="alert">{topBarError}</span>
                </div>
              )}
            </div>
          )}
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
            <button type="button" className="landing-cta-primary" onClick={() => showAuth()}>
              {t.ctaPrimary}
            </button>
            <button type="button" className="landing-cta-secondary" onClick={scrollToHow}>
              {t.ctaSecondary}
            </button>
          </div>
          <div className="landing-hero-proof">
            {proofPills.map((pill) => (
              <span key={pill} className="landing-hero-proof-pill">{pill}</span>
            ))}
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
                          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 180px" }}>
                              <label className="label">{tLogin("register.firstName")}</label>
                              <input
                                className="input"
                                value={registerFirstName}
                                onChange={(e) => setRegisterFirstName(e.target.value)}
                                required
                                autoComplete="given-name"
                                placeholder={tLogin("register.placeholderFirstName")}
                              />
                            </div>
                            <div style={{ flex: "1 1 180px" }}>
                              <label className="label">{tLogin("register.lastName")}</label>
                              <input
                                className="input"
                                value={registerLastName}
                                onChange={(e) => setRegisterLastName(e.target.value)}
                                required
                                autoComplete="family-name"
                                placeholder={tLogin("register.placeholderLastName")}
                              />
                            </div>
                          </div>
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
                          <div>
                            <label className="label">{tLogin("register.phone")}</label>
                            <input
                              className="input"
                              type="tel"
                              value={registerPhone}
                              onChange={(e) => setRegisterPhone(e.target.value)}
                              required
                              autoComplete="tel"
                              placeholder={tLogin("register.placeholderPhone")}
                            />
                          </div>
                          <div>
                            <label className="label">{tLogin("register.country")}</label>
                            <select
                              className="select"
                              value={registerCountry}
                              onChange={(e) => setRegisterCountry(e.target.value)}
                              required
                            >
                              <option value="">{tLogin("register.selectCountry")}</option>
                              {countryOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
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
                          <div className="muted" style={{ fontSize: "0.875rem", marginTop: -4 }}>
                            {registerFirstName.trim()} {registerLastName.trim()} · {(countryOptions.find((c) => c.code === registerCountry)?.label ?? registerCountry.trim())} · {registerPhone.trim()}
                          </div>
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
                      <form onSubmit={onForgotSendRecoveryCodes} className="login-form">
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                          <button className="btn primary" type="submit" disabled={authLoading}>
                            {authLoading ? tLogin("login.sending") : tLogin("login.recoverySendCodes")}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
                            onClick={(ev) => { ev.preventDefault(); onForgotSendLegacyCode(ev); }}
                            disabled={authLoading}
                          >
                            {tLogin("login.recoverySendEmailOnly")}
                          </button>
                        </div>
                        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                          <button type="button" className="link-btn" onClick={(ev) => { ev.preventDefault(); const em = forgotEmail.trim().toLowerCase(); if (!em) return setAuthError(tLogin("login.emailRequired")); setAuthLoading(true); setAuthError(""); api("/auth/forgot-password/request-code", { method: "POST", body: JSON.stringify({ email: em }) }).then(() => { setForgotUseRecovery(false); setForgotStep("code"); setForgotInfo(""); }).catch((err: any) => setAuthError(err?.message ?? tLogin("login.failedToSendCode"))).finally(() => setAuthLoading(false)); }}>
                            {tLogin("login.recoveryNoSms")}
                          </button>
                        </p>
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
                          <label className="label">{tLogin("login.email")} {tLogin("login.code")}</label>
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
                        {forgotUseRecovery && (
                          <div>
                            <label className="label">{tLogin("login.phoneCode")}</label>
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              value={forgotPhoneCode}
                              onChange={(e) => setForgotPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                              placeholder={tLogin("login.placeholderCode")}
                              maxLength={6}
                            />
                          </div>
                        )}
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
                        {authError && (
                          <>
                            <div className="error">{authError}</div>
                            <p style={{ marginTop: 8, marginBottom: 0 }}>
                              <button type="button" className="link-btn" onClick={startForgot}>
                                {tLogin("login.forgotPassword")}
                              </button>
                            </p>
                          </>
                        )}
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
              <div className="landing-preview-stage">
                <img
                  src="/ground-laptop.png"
                  alt={t.previewTitle}
                  className="landing-preview-img"
                />
                <div className="landing-preview-floating landing-preview-floating-left">
                  <span className="landing-preview-floating-label">{t.heroStat1Label}</span>
                  <strong className="landing-preview-floating-value">{t.heroStat1Value}</strong>
                </div>
                <div className="landing-preview-floating landing-preview-floating-right">
                  <span className="landing-preview-floating-label">{t.heroStat2Label}</span>
                  <strong className="landing-preview-floating-value">{t.heroStat2Value}</strong>
                </div>
              </div>
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
        <p className="landing-benefits-lead">{t.benefitsLead}</p>
        <div className="landing-benefits-layout">
          <article className="landing-benefit-hero">
            <p className="landing-benefit-hero-eyebrow">{t.benefitHeroEyebrow}</p>
            <h3 className="landing-benefit-hero-title">{t.benefitHeroTitle}</h3>
            <p className="landing-benefit-hero-desc">{t.benefitHeroDesc}</p>
            <p className="landing-benefit-proof">{t.benefitHeroProof}</p>
            <button type="button" className="landing-benefit-cta" onClick={() => showAuth("register")}>
              {t.benefitHeroCta}
            </button>
          </article>
          <div className="landing-benefits-grid">
            {BENEFIT_ITEMS.map((item) => (
              <article key={item.title} className="landing-benefit-card">
                <h3 className="landing-benefit-card-title">{t[item.title]}</h3>
                <p className="landing-benefit-card-desc">{t[item.desc]}</p>
                <p className="landing-benefit-proof">{t[item.proof]}</p>
                <button
                  type="button"
                  className="landing-benefit-cta landing-benefit-cta-inline"
                  onClick={item.action === "how" ? scrollToHow : () => showAuth("register")}
                >
                  {t[item.cta]}
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        data-landing-section="story"
        className={`landing-section landing-section-story ${visibleSections.has("story") ? "landing-reveal" : ""}`}
      >
        <div className="landing-story-card">
          <div className="landing-story-copy">
            <h2 className="landing-story-title">{t.storyTitle}</h2>
            <p className="landing-story-lead">{t.storyLead}</p>
            <ul className="landing-story-list">
              <li>{t.storyBullet1}</li>
              <li>{t.storyBullet2}</li>
              <li>{t.storyBullet3}</li>
            </ul>
            <button type="button" className="landing-story-cta" onClick={() => showAuth("register")}>
              {t.storyCta}
            </button>
          </div>
          <div className="landing-story-panel">
            <h3>{t.previewTitle}</h3>
            <div className="landing-story-kpis">
              <div>
                <span>{t.kpiIncome}</span>
                <strong>USD 4,560</strong>
              </div>
              <div>
                <span>{t.kpiExpenses}</span>
                <strong>USD 2,910</strong>
              </div>
              <div>
                <span>{t.kpiBalance}</span>
                <strong>USD 1,650</strong>
              </div>
              <div>
                <span>{t.kpiNetWorth}</span>
                <strong>USD 38,440</strong>
              </div>
            </div>
          </div>
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
              <button type="button" className="landing-price-cta-btn" onClick={() => showAuth("register")}>{t.earlyStageCta}</button>
            </p>
            <ul className="landing-price-features">
              <li>{t.earlyStage1}</li>
              <li>{t.earlyStage2}</li>
              <li>{t.earlyStage3}</li>
            </ul>
          </div>
          <div className="landing-price-card landing-price-card-muted landing-price-card-pro">
            <span className="landing-price-badge landing-price-badge-muted">{t.proBadge}</span>
            <h3 className="landing-price-name">{t.pro}</h3>
            <p className="landing-price-trial">{t.proPriceTrial}</p>
            <p className="landing-price-amount">{t.proPriceAmount}</p>
            <p className="landing-price-note">{t.proPriceNote}</p>
            <p className="landing-price-exclusive">{t.proExclusive}</p>
            <ul className="landing-price-features">
              <li>{t.pro1}</li>
              <li>{t.pro2}</li>
              <li>{t.pro3}</li>
            </ul>
          </div>
          <div className="landing-price-card landing-price-card-muted landing-price-card-standard">
            <span className="landing-price-badge landing-price-badge-muted landing-price-spacer" aria-hidden>{t.proBadge}</span>
            <h3 className="landing-price-name">{t.proStandard}</h3>
            <p className="landing-price-trial landing-price-spacer" aria-hidden>{t.proPriceTrial}</p>
            <p className="landing-price-amount">{t.proStandardPrice}</p>
            <ul className="landing-price-features">
              <li>{t.proStandard1}</li>
              <li>{t.proStandard2}</li>
              <li>{t.proStandard3}</li>
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
        className={`landing-section landing-section-testimonial ${visibleSections.has("testimonial") ? "landing-reveal" : ""}`}
      >
        <div className="landing-testimonials-grid">
          <article className="landing-testimonial">
            <blockquote className="landing-testimonial-quote">
              &ldquo;{t.testimonial}&rdquo;
            </blockquote>
            <cite className="landing-testimonial-author">— {t.testimonialAuthor}</cite>
          </article>
          <article className="landing-testimonial">
            <blockquote className="landing-testimonial-quote">
              &ldquo;{t.testimonial2}&rdquo;
            </blockquote>
            <cite className="landing-testimonial-author">— {t.testimonial2Author}</cite>
          </article>
        </div>
      </section>

      {/* Final CTA */}
      <section
        data-landing-section="final"
        className={`landing-final-cta ${visibleSections.has("final") ? "landing-reveal" : ""}`}
      >
        <h2 className="landing-final-headline">{t.finalHeadline}</h2>
        <button type="button" className="landing-final-btn" onClick={() => showAuth()}>
          {t.finalCta}
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <Link to="/" className="landing-footer-brand">ground</Link>
        <div className="landing-footer-links">
          <button type="button" className="landing-footer-link" onClick={() => showAuth()}>{t.footerLogin}</button>
          <button type="button" className="landing-footer-link" onClick={() => showAuth("register")}>{t.footerCreate}</button>
          <a href={CONTACT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="landing-footer-link">{t.footerContact}</a>
          <Link to="/terms">{t.footerTerms}</Link>
          <Link to="/privacy">{t.footerPrivacy}</Link>
        </div>
        <span className="landing-footer-year">© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
