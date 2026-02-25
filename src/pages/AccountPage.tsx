import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppShell } from "../layout/AppShell";
import { useEncryption } from "../context/EncryptionContext";
import { api } from "../api";
import { APP_BASE } from "../constants";
import { runKeyRotation } from "../utils/keyRotation";
import { getMigrationStatus, runMigration, type MigrationStatus as MigrationStatusType, type MigrationResult } from "../utils/migrateToE2EE";

function ChangePasswordCard({
  showTitle = true,
  onSuccess,
}: {
  showTitle?: boolean;
  onSuccess?: (newPassword: string) => Promise<string | undefined>;
}) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [msgType, setMsgType] = useState<"success" | "warning" | "error">("success");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/admin/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      let warning: string | undefined;
      if (onSuccess) {
        warning = await onSuccess(newPassword);
      }
      setCurrentPassword("");
      setNewPassword("");
      if (warning) {
        setMsgType("warning");
        setMsg(`${t("account.passwordUpdated")} ${warning}`);
      } else {
        setMsgType("success");
        setMsg(t("account.passwordUpdated"));
      }
    } catch (err: unknown) {
      setMsgType("error");
      setMsg(err instanceof Error ? err.message : String(t("common.error")));
    }
  }

  return (
    <div>
      {showTitle && <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("account.changePassword")}</div>}
      <form onSubmit={submit} className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }} aria-label={t("account.changePassword")}>
        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("account.currentPassword")}</div>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("account.newPassword")}</div>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <button className="btn primary" type="submit" style={{ height: 42 }}>{t("account.update")}</button>
      </form>
      {msg && (
        <div
          style={{
            marginTop: 10,
            color: msgType === "success" ? "rgba(15,23,42,0.75)" : msgType === "warning" ? "var(--warning, #b45309)" : "var(--danger)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function DisplayCurrencyCard({ showTitle = true }: { showTitle?: boolean }) {
  const { t } = useTranslation();
  const { preferredDisplayCurrencyId, updatePreferredDisplayCurrency } = useAppShell();
  const [saving, setSaving] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as "USD" | "UYU";
    setSaving(true);
    try {
      await updatePreferredDisplayCurrency(v);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div style={{ marginTop: showTitle ? 4 : 0 }}>
      {showTitle && <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("account.displayCurrency")}</div>}
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t("account.displayCurrencyDesc")}</div>
      <select className="select" value={preferredDisplayCurrencyId} onChange={onChange} disabled={saving} style={{ width: 120, height: 40, fontSize: 11 }} aria-label={t("account.displayCurrency")}>
        <option value="USD">USD</option>
        <option value="UYU">UYU</option>
      </select>
    </div>
  );
}

type Me = {
  id: string;
  email: string;
  role: string;
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  recoveryEnabled?: boolean;
  encryptionSalt?: string | null;
};

export default function AccountPage() {
  const { t } = useTranslation();
  const { setHeader } = useAppShell();
  const { encryptionKey, encryptPayload, decryptPayload, setEncryptionKey } = useEncryption();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatusType | null>(null);
  const [migrationStatusLoading, setMigrationStatusLoading] = useState(false);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationPhase, setMigrationPhase] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "sent" | "verified">("idle");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [rotationPhase, setRotationPhase] = useState<string | null>(null);

  useEffect(() => {
    setHeader({ title: t("account.title"), subtitle: t("account.subtitle") });
  }, [setHeader, t]);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(setMe)
      .catch((err) => setError(err?.message ?? "Error loading account"))
      .finally(() => setLoading(false));
  }, [phoneStep]);

  useEffect(() => {
    if (!encryptionKey || !me?.encryptionSalt) {
      setMigrationStatus(null);
      return;
    }
    setMigrationStatusLoading(true);
    getMigrationStatus(api)
      .then(setMigrationStatus)
      .catch(() => setMigrationStatus(null))
      .finally(() => setMigrationStatusLoading(false));
  }, [encryptionKey, me?.encryptionSalt, migrationResult]);

  async function onPhoneRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const raw = phone.replace(/\s/g, "");
    if (!raw || raw.length < 10) {
      setError(t("account.phoneRequired"));
      return;
    }
    setPhoneLoading(true);
    try {
      await api("/auth/me/phone/request", {
        method: "POST",
        body: JSON.stringify({ phone: raw }),
      });
      setPhoneStep("sent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("account.phoneSendFailed"));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function onPhoneVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phoneCode.trim() || phoneCode.length < 6) {
      setError(t("account.codeRequired"));
      return;
    }
    setPhoneLoading(true);
    try {
      await api("/auth/me/phone/verify", {
        method: "POST",
        body: JSON.stringify({ code: phoneCode.trim() }),
      });
      setPhoneStep("verified");
      setPhoneCode("");
      const updated = await api<Me>("/auth/me");
      setMe(updated);
      if (encryptionKey) {
        try {
          await api("/auth/recovery/setup", {
            method: "POST",
            body: JSON.stringify({ recoveryPackage: encryptionKey }),
          });
          setMe((prev) => (prev ? { ...prev, recoveryEnabled: true } : null));
        } catch {
          setError(t("account.recoverySetupFailed"));
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("account.phoneVerifyFailed"));
    } finally {
      setPhoneLoading(false);
    }
  }

  async function onEnableRecovery() {
    if (!encryptionKey) return;
    setError("");
    setRecoveryLoading(true);
    try {
      await api("/auth/recovery/setup", {
        method: "POST",
        body: JSON.stringify({ recoveryPackage: encryptionKey }),
      });
      setMe((prev) => (prev ? { ...prev, recoveryEnabled: true } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("account.recoverySetupFailed"));
    } finally {
      setRecoveryLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p className="muted">{t("account.loading")}</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p className="error">{error || t("account.loadError")}</p>
      </div>
    );
  }

  const phoneVerified = !!me.phoneVerifiedAt;
  const canEnableRecovery = phoneVerified && !me.recoveryEnabled;

  async function runMigrationNow() {
    setMigrationRunning(true);
    setMigrationPhase(null);
    setMigrationResult(null);
    const phaseLabels: Record<string, string> = {
      income: t("account.keyRotationPhase_income"),
      expenses: t("account.keyRotationPhase_expenses"),
      investments: t("account.keyRotationPhase_investments"),
      budgets: t("account.keyRotationPhase_budgets"),
      templates: t("account.keyRotationPhase_templates"),
      planned: t("account.keyRotationPhase_planned"),
      other: t("account.keyRotationPhase_other"),
      monthCloses: t("account.keyRotationPhase_monthCloses"),
    };
    try {
      const result = await runMigration(api, encryptPayload, (phase) =>
        setMigrationPhase(phaseLabels[phase] ?? phase)
      );
      setMigrationResult(result);
    } finally {
      setMigrationRunning(false);
      setMigrationPhase(null);
    }
  }

  async function onPasswordChangeSuccess(newPassword: string): Promise<string | undefined> {
    const updated = await api<Me>("/auth/me");
    if (encryptionKey && updated?.encryptionSalt) {
      const phaseLabels: Record<string, string> = {
        income: t("account.keyRotationPhase_income"),
        expenses: t("account.keyRotationPhase_expenses"),
        investments: t("account.keyRotationPhase_investments"),
        budgets: t("account.keyRotationPhase_budgets"),
        templates: t("account.keyRotationPhase_templates"),
        planned: t("account.keyRotationPhase_planned"),
        other: t("account.keyRotationPhase_other"),
        monthCloses: t("account.keyRotationPhase_monthCloses"),
      };
      const result = await runKeyRotation(
        api,
        decryptPayload,
        setEncryptionKey,
        newPassword,
        updated.encryptionSalt,
        (phase) => setRotationPhase(t("account.keyRotationProgress", { phase: phaseLabels[phase] ?? phase }))
      );
      setRotationPhase(null);
      if (!result.ok) {
        return (
          t("account.keyRotationPartialFailure", { count: result.errorCount }) +
          (result.errors.length > 0 ? ` ${result.errors.slice(0, 2).join("; ")}` : "")
        );
      }
    }
    return undefined;
  }

  return (
    <div className="account-page" style={{ maxWidth: 480 }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="account-section-title">{t("account.profile")}</h3>
        <p className="muted" style={{ marginBottom: 8 }}>
          {t("account.email")}: <strong>{me.email}</strong>
        </p>
      </div>

      {encryptionKey && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 className="account-section-title">{t("account.e2eeTitle")}</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            {t("account.e2eeActiveShort")}{" "}
            <Link to={`${APP_BASE}/help`} className="link">{t("help.title")}</Link>.
          </p>
          <h4 style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t("account.migrationTitle")}</h4>
          {migrationStatusLoading ? (
            <p className="muted" style={{ margin: 0 }}>{t("account.migrationChecking")}</p>
          ) : migrationRunning ? (
            <p className="muted" style={{ margin: 0 }}>{t("account.migrationProgress", { phase: migrationPhase ?? "…" })}</p>
          ) : migrationStatus?.total === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{t("account.migrationStatusNone")}</p>
          ) : migrationStatus && migrationStatus.total > 0 ? (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>{t("account.migrationStatusCount", { count: migrationStatus.total })}</p>
              {(() => {
                const parts: string[] = [];
                if (migrationStatus.income) parts.push(`${migrationStatus.income} ${t("account.keyRotationPhase_income")}`);
                if (migrationStatus.expenses) parts.push(`${migrationStatus.expenses} ${t("account.keyRotationPhase_expenses")}`);
                if (migrationStatus.investmentSnapshots) parts.push(`${migrationStatus.investmentSnapshots} ${t("account.keyRotationPhase_snapshots")}`);
                if (migrationStatus.investmentMovements) parts.push(`${migrationStatus.investmentMovements} ${t("account.keyRotationPhase_movements")}`);
                if (migrationStatus.budgets) parts.push(`${migrationStatus.budgets} ${t("account.keyRotationPhase_budgets")}`);
                if (migrationStatus.templates) parts.push(`${migrationStatus.templates} ${t("account.keyRotationPhase_templates")}`);
                if (migrationStatus.planned) parts.push(`${migrationStatus.planned} ${t("account.keyRotationPhase_planned")}`);
                if (migrationStatus.otherExpenses) parts.push(`${migrationStatus.otherExpenses} ${t("account.keyRotationPhase_other")}`);
                if (migrationStatus.monthCloses) parts.push(`${migrationStatus.monthCloses} ${t("account.keyRotationPhase_monthCloses")}`);
                return parts.length > 0 ? (
                  <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{t("account.migrationBreakdown", { detail: parts.join(", ") })}</p>
                ) : null;
              })()}
              <button type="button" className="btn primary" onClick={runMigrationNow} disabled={migrationRunning}>
                {t("account.migrationRun")}
              </button>
            </>
          ) : null}
          {migrationResult && !migrationRunning && (
            <p style={{ marginTop: 12, marginBottom: 0, color: migrationResult.ok ? "var(--muted)" : "var(--warning, #b45309)" }}>
              {migrationResult.ok
                ? t("account.migrationDone")
                : t("account.migrationPartialFailure", { count: migrationResult.errorCount })}
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="account-section-title">{t("account.displayCurrency")}</h3>
        <DisplayCurrencyCard showTitle={false} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="account-section-title">{t("account.changePassword")}</h3>
        {rotationPhase && <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>{rotationPhase}</p>}
        <ChangePasswordCard showTitle={false} onSuccess={onPasswordChangeSuccess} />
      </div>

      <div className="card">
        <h3 className="account-section-title">{t("account.phoneAndRecovery")}</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>{t("account.phoneAndRecoveryIntro")}</p>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t("account.phone")}</div>
          {phoneVerified ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("account.phoneVerified")}
              {me.phone ? ` · ${String(me.phone).replace(/(\d{3})\d+(\d{3})/, "$1***$2")}` : ""}
            </p>
          ) : phoneStep === "sent" ? (
            <form onSubmit={onPhoneVerify} className="account-form">
              <label className="label">{t("account.enterCode")}</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{ maxWidth: 120 }}
              />
              {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
              <button type="submit" className="btn primary" disabled={phoneLoading} style={{ marginTop: 12 }}>
                {phoneLoading ? t("account.verifying") : t("account.verify")}
              </button>
            </form>
          ) : (
            <form onSubmit={onPhoneRequest} className="account-form">
              <label className="label">{t("account.phoneLabel")}</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+598 99 123 456"
                style={{ maxWidth: 220 }}
              />
              {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
              <button type="submit" className="btn primary" disabled={phoneLoading} style={{ marginTop: 12 }}>
                {phoneLoading ? t("account.sending") : t("account.sendCode")}
              </button>
            </form>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t("account.recovery")}</div>
          {me.recoveryEnabled ? (
            <>
              <p className="muted" style={{ margin: 0 }}>{t("account.recoveryEnabled")}</p>
              <p className="muted" style={{ margin: 0, marginTop: 8, fontSize: 13 }}>{t("account.recoveryE2EEInfo")}</p>
            </>
          ) : canEnableRecovery ? (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>{t("account.recoveryDescription")}</p>
              {!encryptionKey && (
                <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>{t("account.recoveryRequiresRelogin")}</p>
              )}
              {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
              <button
                type="button"
                className="btn primary"
                onClick={onEnableRecovery}
                disabled={recoveryLoading || !encryptionKey}
              >
                {recoveryLoading ? t("account.enabling") : t("account.enableRecovery")}
              </button>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>{t("account.recoveryRequiresPhone")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
