import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

type Step = "request" | "verify";

function normalizeEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

export default function RegisterPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();

  const [step, setStep] = useState<Step>("request");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const em = normalizeEmail(email);
    if (!em) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setStep("verify");
      setInfo(res.alreadySent
        ? "A code was already sent. Check your inbox (and spam)."
        : "We sent you a 6-digit code. It may take a few minutes to arrive. Check your inbox (and spam).");
    } catch (err: any) {
      setError(err?.message ?? "Error sending code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const em = normalizeEmail(email);
    const c = String(code || "").trim();
    const pw = String(password || "");

    if (!em) return setError("Email is required");
    if (!c) return setError("Code is required");
    if (!pw) return setError("Password is required");
    if (pw.length < 8) return setError("Password must be at least 8 characters");

    setLoading(true);
    try {
      const r = await api<{ token: string }>("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email: em, code: c, password: pw }),
      });

      localStorage.setItem("token", r.token);
      nav("/");
    } catch (err: any) {
      setError(err?.message ?? "Error creating account");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setInfo("");

    const em = normalizeEmail(email);
    if (!em) return setError("Email is required");

    setLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setInfo(res.alreadySent
        ? "A code was already sent. Check your inbox (and spam)."
        : "New code sent. It may take a few minutes to arrive.");
    } catch (err: any) {
      setError(err?.message ?? "Error resending code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-root">
      <div className="register-grid">
        <div className="brand-panel">
          <div className="brand-panel-inner">
            <div className="brand-wordmark-block">
              <span className="brand-wordmark">{t("brand.name")}</span>
            </div>
            <h1 className="brand-headline">{t("brand.headline")}</h1>
            <p className="brand-subline">{t("brand.subline")}</p>
            <div className="brand-cta">
              <a href="/login" className="brand-cta-link">{t("brand.signIn")}</a>
            </div>
            <div className="brand-lang" style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: i18n.language === "en" ? "var(--text)" : "var(--muted)", cursor: "pointer" }} onClick={() => i18n.changeLanguage("en")}>EN</button>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>·</span>
              <button type="button" style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: i18n.language === "es" ? "var(--text)" : "var(--muted)", cursor: "pointer" }} onClick={() => i18n.changeLanguage("es")}>ES</button>
            </div>
          </div>
        </div>

        <div className="register-panel">
          <div className="register-card">
            <h2>{t("register.title")}</h2>
            <p className="muted" style={{ marginBottom: 24 }}>
              {step === "request" ? t("register.requestSubtitle") : t("register.verifySubtitle")}
            </p>

            {step === "request" ? (
              <form onSubmit={requestCode} className="register-form">
                <div>
                  <label className="label">{t("register.email")}</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder={t("login.placeholderEmail")}
                  />
                </div>
                {error && <div className="error">{error}</div>}
                {info && <div className="muted" style={{ fontSize: "0.875rem" }}>{info}</div>}
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? t("register.sending") : t("register.sendCode")}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyAndCreate} className="register-form">
                <p className="muted" style={{ marginBottom: 8 }}>
                  {t("register.codeSentTo")} <strong>{normalizeEmail(email)}</strong>
                </p>
                <div>
                  <label className="label">{t("register.verificationCode")}</label>
                  <input
                    className="input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("register.placeholderCode")}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("register.password")}</label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t("login.placeholderPassword")}
                  />
                  <p className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                    {t("register.minChars")}
                  </p>
                </div>
                {error && <div className="error">{error}</div>}
                {info && <div className="muted" style={{ fontSize: "0.875rem" }}>{info}</div>}
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? t("register.creating") : t("register.createAccount")}
                </button>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setStep("request");
                      setCode("");
                      setPassword("");
                      setError("");
                      setInfo("");
                    }}
                  >
                    {t("register.changeEmail")}
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={loading}
                    onClick={resendCode}
                  >
                    {t("register.resendCode")}
                  </button>
                </div>
              </form>
            )}

            <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
              {t("register.alreadyHave")}{" "}
              <a href="/login" className="link">{t("register.signIn")}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
