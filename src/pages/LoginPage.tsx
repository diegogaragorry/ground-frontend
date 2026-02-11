import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { APP_BASE } from "../constants";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";
import "../styles/auth.css";

type LoginResp = {
  token?: string;
  accessToken?: string;
  jwt?: string;
  data?: { token?: string; accessToken?: string; jwt?: string };
};

function pickToken(r: LoginResp | any): string | null {
  const t = r?.token ?? r?.accessToken ?? r?.jwt ?? r?.data?.token ?? r?.data?.accessToken ?? r?.data?.jwt;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

async function tryLogin(email: string, password: string): Promise<string> {
  const resp = await api<LoginResp>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const token = pickToken(resp);
  if (!token) throw new Error("Login succeeded but token missing");
  return token;
}

type ForgotStep = null | "email" | "code";

export default function LoginPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotInfo, setForgotInfo] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t && t.trim()) nav(APP_BASE, { replace: true });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await tryLogin(email.trim().toLowerCase(), password);
      localStorage.setItem("token", token);
      nav(APP_BASE, { replace: true });
    } catch (e: any) {
      const msg = e?.message ?? "";
      setError(msg === "Invalid credentials" ? t("login.invalidCredentials") : msg || t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  async function onForgotSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em) return setError(t("login.emailRequired"));
    setLoading(true);
    try {
      const res = await api<{ ok?: boolean; alreadySent?: boolean }>("/auth/forgot-password/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setForgotStep("code");
      if (res.alreadySent) {
        setError("");
        setForgotInfo("A code was already sent. Check your inbox (and spam).");
      } else {
        setForgotInfo("");
      }
    } catch (err: any) {
      setError(err?.message ?? t("login.failedToSendCode"));
    } finally {
      setLoading(false);
    }
  }

  async function onForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em || !forgotCode.trim()) return setError(t("login.emailAndCodeRequired"));
    if (forgotNewPassword.length < 8) return setError(t("login.passwordMinLength"));
    setLoading(true);
    try {
      await api("/auth/forgot-password/verify", {
        method: "POST",
        body: JSON.stringify({
          email: em,
          code: forgotCode.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      setForgotSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? t("login.failedToResetPassword"));
    } finally {
      setLoading(false);
    }
  }

  function startForgot() {
    setForgotStep("email");
    setForgotEmail("");
    setForgotCode("");
    setForgotNewPassword("");
    setForgotSuccess(false);
    setForgotInfo("");
    setError("");
  }

  function backToLogin() {
    setForgotStep(null);
    setForgotSuccess(false);
    setError("");
  }

  return (
    <div className="auth-shell login-root">
      <div className="login-grid">
        {/* Hero left — copy + badges + CTAs */}
        <div className="brand-panel">
          <div className="brand-panel-inner">
            <div className="brand-wordmark-block">
              <span className="brand-wordmark">{t("brand.name")}</span>
            </div>
            <h1 className="brand-headline">{t("brand.headline")}</h1>
            <p className="brand-subline">{t("brand.subline")}</p>
            <div className="brand-badges">
              <span className="brand-badge">{t("brand.badgeUsdBase")}</span>
              <span className="brand-badge">{t("brand.badgeMultiCurrency")}</span>
              <span className="brand-badge">{t("brand.badgeSetup")}</span>
              <span className="brand-badge">{t("brand.badgePrivate")}</span>
            </div>
            <div className="brand-cta">
              <a href="/register" className="brand-cta-link">{t("brand.createAccount")}</a>
              <Link to="/" className="brand-cta-secondary">{i18n.language === "es" ? "Ir al inicio" : "Back to home"}</Link>
            </div>
            <div className="brand-lang">
              <button type="button" className={i18n.language === "en" ? "active" : ""} onClick={() => i18n.changeLanguage("en")} aria-label="English">EN</button>
              <span className="brand-lang-sep">·</span>
              <button type="button" className={i18n.language === "es" ? "active" : ""} onClick={() => i18n.changeLanguage("es")} aria-label="Español">ES</button>
            </div>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="login-panel">
          <div className="login-card">
            {forgotSuccess ? (
              <>
                <h2>{t("login.passwordResetTitle")}</h2>
                <p className="muted" style={{ marginBottom: 24 }}>{t("login.passwordResetDone")}</p>
                <button type="button" className="btn primary" onClick={backToLogin}>
                  {t("login.backToSignIn")}
                </button>
              </>
            ) : forgotStep === "email" ? (
              <>
                <h2>{t("login.forgotTitle")}</h2>
                <p className="muted" style={{ marginBottom: 24 }}>
                  {t("login.forgotSubtitle")}
                </p>
                <form onSubmit={onForgotSendCode} className="login-form">
                  <div>
                    <label className="label">{t("login.email")}</label>
                    <input
                      className="input"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={t("login.placeholderEmail")}
                      required
                    />
                  </div>
                  {error && <div className="error">{error}</div>}
                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? t("login.sending") : t("login.sendResetCode")}
                  </button>
                </form>
                <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                  <button type="button" className="link-btn" onClick={backToLogin}>
                    {t("login.backToSignIn")}
                  </button>
                </p>
              </>
            ) : forgotStep === "code" ? (
              <>
                <h2>{t("login.resetTitle")}</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  <Trans i18nKey="login.resetSubtitle" values={{ email: forgotEmail }} components={{ 1: <strong /> }} />
                </p>
                <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
                  {t("login.resetEmailNote")}
                </p>
                {forgotInfo && (
                  <div className="toast-success" style={{ marginBottom: 16 }}>
                    {forgotInfo}
                  </div>
                )}
                <form onSubmit={onForgotReset} className="login-form">
                  <div>
                    <label className="label">{t("login.code")}</label>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("login.placeholderCode")}
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label className="label">{t("login.newPassword")}</label>
                    <div className="auth-input-wrap">
                      <input
                        className="input"
                        type={showPassword ? "text" : "password"}
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder={t("login.placeholderPassword")}
                        minLength={8}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? (i18n.language === "es" ? "Ocultar contraseña" : "Hide password") : (i18n.language === "es" ? "Mostrar contraseña" : "Show password")}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {error && <div className="error">{error}</div>}
                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? t("login.resetting") : t("login.resetPassword")}
                  </button>
                </form>
                <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                  <button type="button" className="link-btn" onClick={startForgot}>
                    {t("login.useDifferentEmail")}
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2>{t("login.title")}</h2>
                <p className="muted" style={{ marginBottom: 24 }}>{t("login.subtitle")}</p>
                <form onSubmit={onSubmit} className="login-form">
                  <div>
                    <label className="label">{t("login.email")}</label>
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("login.placeholderEmail")}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">{t("login.password")}</label>
                    <div className="auth-input-wrap">
                      <input
                        className="input"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("login.placeholderPassword")}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? (i18n.language === "es" ? "Ocultar contraseña" : "Hide password") : (i18n.language === "es" ? "Mostrar contraseña" : "Show password")}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: 13, padding: 0 }}
                        onClick={startForgot}
                      >
                        {t("login.forgotPassword")}
                      </button>
                    </div>
                  </div>

                  {error && <div className="error">{error}</div>}

                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? t("login.signingIn") : t("login.signIn")}
                  </button>
                </form>

                <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
                  {t("login.newToGround")}{" "}
                  <a href="/register" className="link">
                    {t("login.createAccountLink")}
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}