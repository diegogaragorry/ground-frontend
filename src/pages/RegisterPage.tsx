import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

type Step = "request" | "verify";

function normalizeEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

export default function RegisterPage() {
  const nav = useNavigate();

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
      await api<{ ok: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setStep("verify");
      setInfo("We sent you a 6-digit code. It may take a few minutes to arrive. Check your inbox (and spam).");
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
      await api<{ ok: boolean }>("/auth/register/request-code", {
        method: "POST",
        body: JSON.stringify({ email: em }),
      });
      setInfo("New code sent. It may take a few minutes to arrive.");
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
              <span className="brand-wordmark">Ground</span>
            </div>
            <h1 className="brand-headline">
              Get good with your money.
            </h1>
            <p className="brand-subline">
              Budgets, spending, and net worth in one place. No spreadsheets, no stress.
            </p>
            <div className="brand-cta">
              <a href="/login" className="brand-cta-link">Sign in →</a>
            </div>
          </div>
        </div>

        <div className="register-panel">
          <div className="register-card">
            <h2>Create your account</h2>
            <p className="muted" style={{ marginBottom: 24 }}>
              {step === "request"
                ? "Enter your email and we’ll send you a verification code."
                : "The email may take a few minutes to arrive. Check your spam folder if you don’t see it."}
            </p>

            {step === "request" ? (
              <form onSubmit={requestCode} className="register-form">
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <div className="error">{error}</div>}
                {info && <div className="muted" style={{ fontSize: "0.875rem" }}>{info}</div>}
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? "Sending…" : "Send verification code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyAndCreate} className="register-form">
                <p className="muted" style={{ marginBottom: 8 }}>
                  Code sent to <strong>{normalizeEmail(email)}</strong>
                </p>
                <div>
                  <label className="label">Verification code</label>
                  <input
                    className="input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6 digits"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                  <p className="muted" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                    Minimum 8 characters.
                  </p>
                </div>
                {error && <div className="error">{error}</div>}
                {info && <div className="muted" style={{ fontSize: "0.875rem" }}>{info}</div>}
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? "Creating…" : "Create account"}
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
                    Change email
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={loading}
                    onClick={resendCode}
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}

            <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
              Already have an account?{" "}
              <a href="/login" className="link">Sign in</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
