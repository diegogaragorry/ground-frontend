import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

import logo from "../assets/ground-logo.jpg";

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
  const payload = { email, password };
  const endpoints = ["/auth/login", "/login", "/auth/signin"] as const;

  let lastErr: any = null;
  for (const ep of endpoints) {
    try {
      const resp = await api<LoginResp>(ep, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const token = pickToken(resp);
      if (!token) throw new Error("Login succeeded but token missing");
      return token;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw new Error(lastErr?.message ?? "Login failed");
}

export default function LoginPage() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="login-root">
      <div className="login-grid">
        {/* BRAND SIDE */}
        <div className="brand-panel">
          <img src={logo} alt="Ground logo" className="brand-logo" />

          <h1 className="brand-title">Ground</h1>

          <p className="brand-tagline">
            Order your finances, ground your spending, grow your dreams.
          </p>

          <p className="brand-description">
            Ground helps you bring structure to your personal finances.
            Plan your year, understand your spending, and track your net worth
            with clarity and calm.
          </p>

          <ul className="brand-list">
            <li><b>Templates</b> to define your real monthly baseline</li>
            <li><b>Budgets</b> that project your year without losing reality</li>
            <li><b>Investments</b> to see your net worth evolve month by month</li>
          </ul>

          <p className="brand-footnote">
            Designed for people who want order — not spreadsheets.
          </p>
        </div>

        {/* LOGIN CARD */}
        <div className="login-panel">
          <div className="card login-card">
            <h2 style={{ fontWeight: 900, marginBottom: 6 }}>
              Sign in to Ground
            </h2>

            <p className="muted" style={{ marginBottom: 18 }}>
              Use your email and password to continue.
            </p>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
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
              </div>

              {error && <div className="error">{error}</div>}

              <button className="btn primary" style={{ height: 44 }} disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="muted center" style={{ marginTop: 16 }}>
              New to Ground?{" "}
              <a href="/register" className="link">
                Create your account
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
        }

        .login-grid {
          width: min(1100px, 100%);
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 32px;
        }

        .brand-panel {
          padding: 24px 32px;
          display: grid;
          align-content: center;
        }

        .brand-logo {
          width: 96px;
          height: 96px;
          object-fit: contain;
          margin-bottom: 18px;
        }

        .brand-title {
          font-size: 42px;
          font-weight: 950;
          margin-bottom: 8px;
        }

        .brand-tagline {
          font-size: 18px;
          color: var(--muted);
          margin-bottom: 18px;
          max-width: 520px;
        }

        .brand-description {
          font-size: 15px;
          line-height: 1.45;
          max-width: 560px;
          margin-bottom: 18px;
        }

        .brand-list {
          padding-left: 18px;
          margin-bottom: 18px;
          font-size: 14px;
        }

        .brand-list li {
          margin: 8px 0;
        }

        .brand-footnote {
          font-size: 13px;
          color: var(--muted);
        }

        .login-panel {
          display: grid;
          align-content: center;
        }

        .login-card {
          padding: 24px;
          border-radius: 18px;
        }

        .label {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 6px;
          display: block;
        }

        .error {
          font-size: 13px;
          color: var(--danger);
        }

        .center {
          text-align: center;
        }

        .link {
          font-weight: 800;
          text-decoration: underline;
        }

        @media (max-width: 900px) {
          .login-grid {
            grid-template-columns: 1fr;
          }
          .brand-panel {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}