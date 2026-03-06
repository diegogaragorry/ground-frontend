import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { APP_BASE } from "../constants";
import "../styles/auth.css";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { buildCountryOptions, isValidCountryCode } from "../utils/countries";
import { generateEncryptionSalt, deriveEncryptionKey, exportKeyToBase64 } from "../utils/crypto";

type Step = "request" | "verify";

function normalizeEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

function normalizePhone(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export default function RegisterPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { setEncryptionKey } = useEncryption();

  const [step, setStep] = useState<Step>("request");
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [code, setCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const countryOptions = buildCountryOptions(i18n.language || "es");

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const em = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedCountry = country.trim().toUpperCase();
    if (!em) {
      setError("Email is required");
      return;
    }
    if (!firstName.trim()) return setError(t("register.firstNameRequired"));
    if (!lastName.trim()) return setError(t("register.lastNameRequired"));
    if (!normalizedPhone || normalizedPhone.length < 10) return setError(t("register.phoneRequired"));
    if (!normalizedCountry || !isValidCountryCode(normalizedCountry)) return setError(t("register.countryRequired"));

    setLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({
          email: em,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          country: normalizedCountry,
        }),
      });
      setStep("verify");
      setCode("");
      setPhoneCode("");
      setPassword("");
      setInfo(res.alreadySent
        ? "Codes were already sent by email and SMS. Check your inbox (and spam)."
        : "We sent one 6-digit code by email and another by SMS. The email may take a few minutes to arrive.");
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
    const smsCode = String(phoneCode || "").trim();
    const pw = String(password || "");
    const normalizedPhone = normalizePhone(phone);
    const normalizedCountry = country.trim().toUpperCase();

    if (!em) return setError("Email is required");
    if (!firstName.trim()) return setError(t("register.firstNameRequired"));
    if (!lastName.trim()) return setError(t("register.lastNameRequired"));
    if (!normalizedPhone || normalizedPhone.length < 10) return setError(t("register.phoneRequired"));
    if (!normalizedCountry || !isValidCountryCode(normalizedCountry)) return setError(t("register.countryRequired"));
    if (!c) return setError("Code is required");
    if (!smsCode) return setError(t("account.codeRequired"));
    if (!pw) return setError("Password is required");
    if (pw.length < 8) return setError("Password must be at least 8 characters");

    setLoading(true);
    try {
      const encryptionSalt = generateEncryptionSalt();
      const k = await deriveEncryptionKey(pw, encryptionSalt);
      const recoveryPackage = await exportKeyToBase64(k);
      const r = await api<{ token: string }>("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({
          email: em,
          emailCode: c,
          phoneCode: smsCode,
          password: pw,
          encryptionSalt,
          recoveryPackage,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          country: normalizedCountry,
        }),
      });

      setEncryptionKey(k);
      localStorage.setItem("token", r.token);
      nav(APP_BASE);
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
    const normalizedPhone = normalizePhone(phone);
    const normalizedCountry = country.trim().toUpperCase();
    if (!em) return setError("Email is required");
    if (!firstName.trim()) return setError(t("register.firstNameRequired"));
    if (!lastName.trim()) return setError(t("register.lastNameRequired"));
    if (!normalizedPhone || normalizedPhone.length < 10) return setError(t("register.phoneRequired"));
    if (!normalizedCountry || !isValidCountryCode(normalizedCountry)) return setError(t("register.countryRequired"));

    setLoading(true);
    try {
      const res = await api<{ ok: boolean; alreadySent?: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({
          email: em,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: normalizedPhone,
          country: normalizedCountry,
        }),
      });
      setInfo(res.alreadySent
        ? "Codes were already sent by email and SMS. Check your inbox (and spam)."
        : "Codes sent again by email and SMS.");
    } catch (err: any) {
      setError(err?.message ?? "Error resending code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell register-root">
      <div className="register-grid">
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
              <a href="/" className="brand-cta-link">{t("brand.signIn")}</a>
              <Link to="/" className="brand-cta-secondary">{i18n.language === "es" ? "Ir al inicio" : "Back to home"}</Link>
            </div>
            <div className="brand-lang">
              <button type="button" className={i18n.language === "en" ? "active" : ""} onClick={() => i18n.changeLanguage("en")} aria-label="English">EN</button>
              <span className="brand-lang-sep">·</span>
              <button type="button" className={i18n.language === "es" ? "active" : ""} onClick={() => i18n.changeLanguage("es")} aria-label="Español">ES</button>
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
                  <label className="label">{t("register.firstName")}</label>
                  <input
                    className="input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                    placeholder={t("register.placeholderFirstName")}
                  />
                </div>
                <div>
                  <label className="label">{t("register.lastName")}</label>
                  <input
                    className="input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                    placeholder={t("register.placeholderLastName")}
                  />
                </div>
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
                <div>
                  <label className="label">{t("register.phone")}</label>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder={t("register.placeholderPhone")}
                  />
                </div>
                <div>
                  <label className="label">{t("register.country")}</label>
                  <select
                    className="select"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                  >
                    <option value="">{t("register.selectCountry")}</option>
                    {countryOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                <div className="muted" style={{ fontSize: "0.875rem", marginTop: -4 }}>
                  {firstName.trim()} {lastName.trim()} · {(countryOptions.find((c) => c.code === country)?.label ?? country.trim())} · {phone.trim()}
                </div>
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
                  <label className="label">{t("register.phoneVerificationCode")}</label>
                  <input
                    className="input"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    placeholder={t("register.placeholderCode")}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("register.password")}</label>
                  <div className="auth-input-wrap">
                    <input
                      className="input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder={t("login.placeholderPassword")}
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
                      setPhoneCode("");
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
              <a href="/" className="link">{t("register.signIn")}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
