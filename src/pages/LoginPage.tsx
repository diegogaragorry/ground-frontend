import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
              <span className="brand-wordmark">Ground</span>
            </div>
            <h1 className="brand-headline">
              Get good with your money.
            </h1>
            <p className="brand-subline">
              Budgets, spending, and net worth in one place. No spreadsheets, no stress.
            </p>
            <div className="brand-cta">
              <a href="/register" className="brand-cta-link">Create your account →</a>
            </div>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="login-panel">
          <div className="login-card">
            {forgotSuccess ? (
              <>
                <h2>Password reset</h2>
                <p className="muted" style={{ marginBottom: 24 }}>
                  Your password has been updated. You can sign in with your new password.
                </p>
                <button type="button" className="btn primary" onClick={backToLogin}>
                  Back to sign in
                </button>
              </>
            ) : forgotStep === "email" ? (
              <>
                <h2>Forgot password</h2>
                <p className="muted" style={{ marginBottom: 24 }}>
                  Enter your email and we’ll send you a code to reset your password.
                </p>
                <form onSubmit={onForgotSendCode} className="login-form">
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  {error && <div className="error">{error}</div>}
                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? "Sending…" : "Send reset code"}
                  </button>
                </form>
                <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                  <button type="button" className="link-btn" onClick={backToLogin}>
                    Back to sign in
                  </button>
                </p>
              </>
            ) : forgotStep === "code" ? (
              <>
                <h2>Reset password</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  Enter the code we sent to <strong>{forgotEmail}</strong> and your new password.
                </p>
                <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
                  The email may take a few minutes to arrive. Check your spam folder if you don’t see it.
                </p>
                <form onSubmit={onForgotReset} className="login-form">
                  <div>
                    <label className="label">Code</label>
                    <input
                      className="input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label className="label">New password</label>
                    <input
                      className="input"
                      type="password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                  {error && <div className="error">{error}</div>}
                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? "Resetting…" : "Reset password"}
                  </button>
                </form>
                <p className="muted center" style={{ marginTop: 20, marginBottom: 0 }}>
                  <button type="button" className="link-btn" onClick={startForgot}>
                    Use a different email
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2>Sign in to Ground</h2>
                <p className="muted" style={{ marginBottom: 24 }}>
                  Use your email and password to continue.
                </p>
                <form onSubmit={onSubmit} className="login-form">
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
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
                      placeholder="••••••••"
                      required
                    />
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="link-btn"
                        style={{ fontSize: 13, padding: 0 }}
                        onClick={startForgot}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {error && <div className="error">{error}</div>}

                  <button className="btn primary" type="submit" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </button>
                </form>

                <p className="muted center" style={{ marginTop: 24, marginBottom: 0 }}>
                  New to Ground?{" "}
                  <a href="/register" className="link">
                    Create your account
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