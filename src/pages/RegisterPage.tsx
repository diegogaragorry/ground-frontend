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
      setInfo("We sent you a 6-digit code. Check your inbox (and spam).");
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
      setInfo("New code sent.");
    } catch (err: any) {
      setError(err?.message ?? "Error resending code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 6 }}>
        Create account
      </div>

      {step === "request" ? (
        <form onSubmit={requestCode} className="grid" style={{ gap: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Email
            </div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
          {info && <div style={{ color: "rgba(15,23,42,0.75)" }}>{info}</div>}

          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send verification code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyAndCreate} className="grid" style={{ gap: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Code sent to <b>{normalizeEmail(email)}</b>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Verification code
            </div>
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
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Password
            </div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Minimum 8 characters.
            </div>
          </div>

          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
          {info && <div style={{ color: "rgba(15,23,42,0.75)" }}>{info}</div>}

          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>

          <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
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

      <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Already have an account?{" "}
        <a href="/login">Log in</a>
      </div>
    </div>
  );
}