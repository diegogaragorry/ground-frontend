import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { api } from "../api";

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

  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t && t.trim()) nav("/", { replace: true });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await tryLogin(email.trim().toLowerCase(), password);
      localStorage.setItem("token", token);
      nav("/", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em) return setError("Email is required");
    setLoading(true);
    try {
      await api("/auth/forgot-password/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setForgotStep("code");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const em = forgotEmail.trim().toLowerCase();
    if (!em || !forgotCode.trim()) return setError("Email and code are required");
    if (forgotNewPassword.length < 8) return setError("Password must be at least 8 characters");
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
      setError(err?.message ?? "Failed to reset password");
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
    setError("");
  }

  function backToLogin() {
    setForgotStep(null);
    setForgotSuccess(false);
    setError("");
  }

  return (
    <div className="login-root">
      <div className="login-grid">
        {/* IZQUIERDA: copy limpio, mucho blanco (estilo Trustly) */}
        <div className="brand-panel">
          <div className="brand-panel-inner">
            <div className="brand-wordmark-block">
              <span className="brand-wordmark">{t("brand.name")}</span>
            </div>
            <h1 className="brand-headline">{t("brand.headline")}</h1>
            <p className="brand-subline">{t("brand.subline")}</p>
            <div className="brand-cta">
              <a href="/register" className="brand-cta-link">{t("brand.createAccount")}</a>
            </div>
            <div className="brand-lang" style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="lang-btn-auth" style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: i18n.language === "en" ? "var(--text)" : "var(--muted)", cursor: "pointer" }} onClick={() => i18n.changeLanguage("en")}>EN</button>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>·</span>
              <button type="button" className="lang-btn-auth" style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: i18n.language === "es" ? "var(--text)" : "var(--muted)", cursor: "pointer" }} onClick={() => i18n.changeLanguage("es")}>ES</button>
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
                    <input
                      className="input"
                      type="password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder={t("login.placeholderPassword")}
                      minLength={8}
                      required
                    />
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
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("login.placeholderPassword")}
                      required
                    />
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