import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppShell } from "../layout/AppShell";
import { useEncryption } from "../context/EncryptionContext";
import { api } from "../api";
import { APP_BASE } from "../constants";
import { runKeyRotation } from "../utils/keyRotation";
import { exportKeyToBase64 } from "../utils/crypto";
import { getMigrationStatus, runMigration, type MigrationStatus as MigrationStatusType, type MigrationResult } from "../utils/migrateToE2EE";
import { buildCountryOptions, isValidCountryCode } from "../utils/countries";

type DLocalCardField = {
  mount: (element: HTMLElement | string) => void;
  destroy?: () => void;
  unmount?: () => void;
};

type DLocalFieldsFactory = {
  create: (fieldType: "card", options?: Record<string, unknown>) => DLocalCardField;
};

type DLocalSdkInstance = {
  fields: (options?: Record<string, unknown>) => DLocalFieldsFactory;
  createToken: (field: DLocalCardField, data?: Record<string, unknown>) => Promise<{ token?: string }>;
};

declare global {
  interface Window {
    dlocal?: (key: string) => DLocalSdkInstance;
  }
}

let dlocalScriptPromise: Promise<void> | null = null;

function getDLocalScriptSrc(environment: "sandbox" | "production") {
  return environment === "sandbox" ? "https://js-sandbox.dlocal.com/" : "https://js.dlocal.com/";
}

function ensureDLocalScript(environment: "sandbox" | "production") {
  const src = getDLocalScriptSrc(environment);
  if (window.dlocal) return Promise.resolve();
  if (dlocalScriptPromise) return dlocalScriptPromise;
  dlocalScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-dlocal-sdk=\"${environment}\"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load dLocal SDK")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dlocalSdk = environment;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load dLocal SDK"));
    document.head.appendChild(script);
  });
  return dlocalScriptPromise;
}

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
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  role: string;
  phone?: string | null;
  phoneVerifiedAt?: string | null;
  recoveryEnabled?: boolean;
  encryptionSalt?: string | null;
};

type BillingSummary = {
  provider: "DLOCAL";
  billingEnabled: boolean;
  integrationReady: boolean;
  checkoutReady: boolean;
  customerPortalReady: boolean;
  smartFields: {
    ready: boolean;
    key: string | null;
    environment: "sandbox" | "production";
  };
  planCode: "EARLY_STAGE" | "PRO_EARLY_ANNUAL" | "LEGACY_FREE" | "PRO_MONTHLY";
  subscriptionStatus:
    | "active"
    | "past_due"
    | "canceled"
    | "expired"
    | "paused"
    | "incomplete"
    | "payment_required";
  accessLevel: "full" | "read_only";
  nextAction: "none" | "start_checkout" | "manage_subscription" | "update_payment_method" | "contact_support";
  isSuperAdminBypass: boolean;
  planEndsAt: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canCancelCurrentSubscription: boolean;
  canReactivateCurrentSubscription: boolean;
  reactivationRequiresCard: boolean;
  price: {
    amountMinor: number;
    currencyCode: "USD";
  };
  offers: Array<{
    planCode: "PRO_EARLY_ANNUAL" | "PRO_MONTHLY";
    amountMinor: number;
    monthlyEquivalentMinor: number;
    currencyCode: "USD";
    durationMonths: number;
    billingInterval: "monthly" | "annual";
    enabled: boolean;
    cancelAnytime: boolean;
  }>;
  commercialPolicy: {
    earlyStageMonths: number;
    graceDays: number;
    proEarlyMonthlyUsdMinor: number;
    proEarlyAnnualUsdMinor: number;
    proStandardMonthlyUsdMinor: number;
    proMonthlyUsdMinor: number;
  };
  notes: string[];
};

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { setHeader } = useAppShell();
  const { encryptionKey, encryptPayload, decryptPayload, setEncryptionKey } = useEncryption();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState("");
  const [billingCheckoutLoading, setBillingCheckoutLoading] = useState<null | "PRO_EARLY_ANNUAL" | "PRO_MONTHLY">(null);
  const [billingCheckoutError, setBillingCheckoutError] = useState("");
  const [billingCardholderName, setBillingCardholderName] = useState("");
  const [billingCardReady, setBillingCardReady] = useState(false);
  const [billingCancelLoading, setBillingCancelLoading] = useState(false);
  const billingCardHostRef = useRef<HTMLDivElement | null>(null);
  const billingCardFieldRef = useRef<DLocalCardField | null>(null);
  const billingDLocalRef = useRef<DLocalSdkInstance | null>(null);

  const [migrationStatus, setMigrationStatus] = useState<MigrationStatusType | null>(null);
  const [migrationStatusLoading, setMigrationStatusLoading] = useState(false);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationPhase, setMigrationPhase] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "sent" | "verified">("idle");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [rotationPhase, setRotationPhase] = useState<string | null>(null);
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || "es"), [i18n.language]);

  useEffect(() => {
    setHeader({ title: t("account.title"), subtitle: t("account.subtitle") });
  }, [setHeader, t]);

  useEffect(() => {
    setLoading(true);
    setBillingLoading(true);
    setBillingError("");
    Promise.all([
      api<Me>("/auth/me"),
      api<BillingSummary>("/billing/summary").catch((err) => {
        setBillingError(err?.message ?? t("account.billingLoadError"));
        return null;
      }),
    ])
      .then(([meResp, billingResp]) => {
        setMe(meResp);
        setBilling(billingResp);
      })
      .catch((err) => setError(err?.message ?? "Error loading account"))
      .finally(() => {
        setLoading(false);
        setBillingLoading(false);
      });
  }, [phoneStep, location.search, t]);

  const formatBillingDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(i18n.language || "es");
  };

  const formatBillingAmount = (amountMinor: number, currencyCode: "USD" = "USD") => {
    const amount = amountMinor / 100;
    return new Intl.NumberFormat(i18n.language?.startsWith("es") ? "es-UY" : "en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  };
  const billingIsSuperAdminBypass = !!billing?.isSuperAdminBypass;
  const billingPrice = useMemo(
    () => formatBillingAmount(billing?.price.amountMinor ?? 0, billing?.price.currencyCode ?? "USD"),
    [billing?.price.amountMinor, billing?.price.currencyCode, i18n.language]
  );
  const billingPlanLabel = billingIsSuperAdminBypass
    ? t("account.billingPlanNotApplicable")
    : billing
      ? t(`account.billingPlan_${billing.planCode}`)
      : "—";
  const billingOffers = billing?.offers ?? [];
  const billingMonthlyOffer = billingOffers.find((offer) => offer.planCode === "PRO_MONTHLY") ?? null;
  const hasPaidPlan = billing?.planCode === "PRO_EARLY_ANNUAL" || billing?.planCode === "PRO_MONTHLY";
  const billingResult = useMemo(() => new URLSearchParams(location.search).get("billingResult"), [location.search]);
  const billingResultMessage = useMemo(() => {
    if (!billingResult) return "";
    const normalized = billingResult.toLowerCase();
    if (normalized === "paid" || normalized === "authorized") return t("account.billingResult_paid");
    if (normalized === "pending" || normalized === "verified") return t("account.billingResult_pending");
    if (normalized === "invalid-signature") return t("account.billingResult_invalidSignature");
    return t("account.billingResult_error", { status: billingResult });
  }, [billingResult, t]);
  const billingSummaryText = billingIsSuperAdminBypass
    ? t("account.billingSummarySuperAdmin")
    : billing?.planEndsAt
      ? t("account.billingSummaryExplicit", { plan: billingPlanLabel, date: formatBillingDate(billing.planEndsAt) })
      : t("account.billingSummaryExplicitNoEnd", { plan: billingPlanLabel });
  const billingMonthlyPitch = !billingIsSuperAdminBypass && !hasPaidPlan && billing
    ? t(billingMonthlyOffer?.enabled ? "account.billingMonthlyPitchLive" : "account.billingMonthlyPitchSoon", {
        price: formatBillingAmount(
          billingMonthlyOffer?.amountMinor ?? billing.commercialPolicy.proMonthlyUsdMinor,
          billingMonthlyOffer?.currencyCode ?? "USD"
        ),
      })
    : "";
  const billingCurrentPlanNote = billingIsSuperAdminBypass || !billing
    ? ""
    : billing.planCode === "PRO_MONTHLY"
      ? billing.cancelAtPeriodEnd
        ? t("account.billingMonthlyCancellationScheduled", { date: formatBillingDate(billing.planEndsAt) })
        : t("account.billingMonthlyCurrentNote", { price: billingPrice })
      : billing.planCode === "PRO_EARLY_ANNUAL"
        ? t("account.billingAnnualCurrentNote", { price: billingPrice })
        : "";
  const shouldRenderMonthlyCardForm =
    !!billing &&
    !billingIsSuperAdminBypass &&
    ((!hasPaidPlan && !!billingMonthlyOffer) || billing.canReactivateCurrentSubscription) &&
    (!hasPaidPlan || billing.reactivationRequiresCard) &&
    !!billing.smartFields.ready &&
    !!billing.smartFields.key;
  const billingMonthlyActionLabel = billing?.canReactivateCurrentSubscription
    ? t("account.billingReactivateCta")
    : t("account.billingMonthlyCta");

  useEffect(() => {
    setPhone(me?.phone ?? "");
    setFirstName(me?.firstName ?? "");
    setLastName(me?.lastName ?? "");
    const nextCardholder = [String(me?.firstName ?? "").trim(), String(me?.lastName ?? "").trim()].filter(Boolean).join(" ");
    setBillingCardholderName(nextCardholder || String(me?.email ?? ""));
    const nextCountry = String(me?.country ?? "").toUpperCase();
    setCountry(isValidCountryCode(nextCountry) ? nextCountry : "");
  }, [me?.phone, me?.firstName, me?.lastName, me?.email, me?.country]);

  useEffect(() => {
    if (!shouldRenderMonthlyCardForm || !billingCardHostRef.current || !billing?.smartFields.key) {
      billingCardFieldRef.current?.destroy?.();
      billingCardFieldRef.current?.unmount?.();
      billingCardFieldRef.current = null;
      billingDLocalRef.current = null;
      setBillingCardReady(false);
      return;
    }

    let cancelled = false;
    setBillingCardReady(false);

    ensureDLocalScript(billing.smartFields.environment)
      .then(() => {
        if (cancelled || !window.dlocal || !billingCardHostRef.current || !billing?.smartFields.key) return;
        const sdk = window.dlocal(billing.smartFields.key);
        const fields = sdk.fields({
          locale: (i18n.language || "es").startsWith("es") ? "es" : "en",
          country: country || (isValidCountryCode(String(me?.country ?? "").toUpperCase()) ? String(me?.country).toUpperCase() : "UY"),
        });
        const field = fields.create("card", {
          style: {
            base: {
              fontSize: "16px",
              color: "#0f172a",
              fontFamily: "inherit",
            },
          },
        });
        billingCardHostRef.current.innerHTML = "";
        field.mount(billingCardHostRef.current);
        billingDLocalRef.current = sdk;
        billingCardFieldRef.current = field;
        setBillingCardReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setBillingCheckoutError(err instanceof Error ? err.message : t("account.billingSmartFieldsUnavailable"));
        }
      });

    return () => {
      cancelled = true;
      billingCardFieldRef.current?.destroy?.();
      billingCardFieldRef.current?.unmount?.();
      billingCardFieldRef.current = null;
      billingDLocalRef.current = null;
      if (billingCardHostRef.current) {
        billingCardHostRef.current.innerHTML = "";
      }
    };
  }, [
    shouldRenderMonthlyCardForm,
    billing?.smartFields.key,
    billing?.smartFields.environment,
    i18n.language,
    country,
    me?.country,
    t,
  ]);

  async function onProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileMessage("");
    const nextFirstName = firstName.trim();
    const nextLastName = lastName.trim();
    const nextCountry = country.trim().toUpperCase();
    if (!nextFirstName) return setProfileError(t("account.firstNameRequired"));
    if (!nextLastName) return setProfileError(t("account.lastNameRequired"));
    if (!nextCountry || !isValidCountryCode(nextCountry)) return setProfileError(t("account.countryRequired"));
    setProfileLoading(true);
    try {
      await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: nextFirstName,
          lastName: nextLastName,
          country: nextCountry,
        }),
      });
      const updated = await api<Me>("/auth/me");
      setMe(updated);
      setProfileMessage(t("account.profileSaved"));
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : t("account.profileSaveFailed"));
    } finally {
      setProfileLoading(false);
    }
  }

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
          const recoveryPackage = await exportKeyToBase64(encryptionKey);
          await api("/auth/recovery/setup", {
            method: "POST",
            body: JSON.stringify({ recoveryPackage }),
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
      const recoveryPackage = await exportKeyToBase64(encryptionKey);
      await api("/auth/recovery/setup", {
        method: "POST",
        body: JSON.stringify({ recoveryPackage }),
      });
      setMe((prev) => (prev ? { ...prev, recoveryEnabled: true } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("account.recoverySetupFailed"));
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function onStartMonthlySubscription() {
    if (!billingCardFieldRef.current || !billingDLocalRef.current) {
      setBillingCheckoutError(t("account.billingSmartFieldsUnavailable"));
      return;
    }
    if (!billingCardholderName.trim()) {
      setBillingCheckoutError(t("account.billingCardholderRequired"));
      return;
    }

    setBillingCheckoutError("");
    setBillingCheckoutLoading("PRO_MONTHLY");
    try {
      const tokenResult = await billingDLocalRef.current.createToken(billingCardFieldRef.current, {
        name: billingCardholderName.trim(),
        currency: "USD",
      });
      const cardToken = String(tokenResult?.token ?? "").trim();
      if (!cardToken) {
        throw new Error(t("account.billingTokenizeFailed"));
      }

      const resp = await api<{ ok: true; paymentStatus: string; billing: BillingSummary }>("/billing/subscribe", {
        method: "POST",
        body: JSON.stringify({
          planCode: "PRO_MONTHLY",
          cardToken,
        }),
      });

      setBilling(resp.billing);
    } catch (err: unknown) {
      setBillingCheckoutError(err instanceof Error ? err.message : t("account.billingCheckoutUnavailable"));
    } finally {
      setBillingCheckoutLoading(null);
    }
  }

  async function onReactivateSubscription() {
    if (!billing) return;

    const requiresCard = billing.reactivationRequiresCard;
    if (requiresCard) {
      if (!billingCardFieldRef.current || !billingDLocalRef.current) {
        setBillingCheckoutError(t("account.billingSmartFieldsUnavailable"));
        return;
      }
      if (!billingCardholderName.trim()) {
        setBillingCheckoutError(t("account.billingCardholderRequired"));
        return;
      }
    }

    setBillingCheckoutError("");
    setBillingCheckoutLoading("PRO_MONTHLY");
    try {
      let cardToken = "";
      if (requiresCard) {
        const tokenResult = await billingDLocalRef.current!.createToken(billingCardFieldRef.current!, {
          name: billingCardholderName.trim(),
          currency: "USD",
        });
        cardToken = String(tokenResult?.token ?? "").trim();
        if (!cardToken) {
          throw new Error(t("account.billingTokenizeFailed"));
        }
      }

      const resp = await api<{ ok: true; billing: BillingSummary }>("/billing/reactivate", {
        method: "POST",
        body: JSON.stringify(cardToken ? { cardToken } : {}),
      });
      setBilling(resp.billing);
    } catch (err: unknown) {
      setBillingCheckoutError(err instanceof Error ? err.message : t("account.billingReactivateFailed"));
    } finally {
      setBillingCheckoutLoading(null);
    }
  }

  async function onCancelSubscription() {
    setBillingCheckoutError("");
    setBillingCancelLoading(true);
    try {
      const resp = await api<{ ok: true; billing: BillingSummary }>("/billing/cancel", {
        method: "POST",
      });
      setBilling(resp.billing);
    } catch (err: unknown) {
      setBillingCheckoutError(err instanceof Error ? err.message : t("account.billingCancelFailed"));
    } finally {
      setBillingCancelLoading(false);
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
        <form onSubmit={onProfileSave} className="account-form">
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">{t("account.firstName")}</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">{t("account.lastName")}</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div>
            <label className="label">{t("account.email")}</label>
            <input className="input" value={me.email} disabled />
          </div>
          <div>
            <label className="label">{t("account.country")}</label>
            <select className="select" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t("account.selectCountry")}</option>
              {countryOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {profileError && <div className="error" style={{ marginTop: 8 }}>{profileError}</div>}
          {profileMessage && <div className="muted" style={{ marginTop: 8 }}>{profileMessage}</div>}
          <button type="submit" className="btn primary" disabled={profileLoading} style={{ marginTop: 4 }}>
            {profileLoading ? t("account.savingProfile") : t("account.saveProfile")}
          </button>
        </form>
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
        <h3 className="account-section-title">{t("account.billingTitle")}</h3>
        {billingLoading ? (
          <p className="muted" style={{ margin: 0 }}>{t("account.loading")}</p>
        ) : billingError ? (
          <p className="error" style={{ margin: 0 }}>{billingError}</p>
        ) : billing ? (
          <>
            {billingResultMessage && (
              <p
                style={{
                  marginTop: 0,
                  marginBottom: 14,
                  color:
                    billingResult?.toLowerCase() === "paid" || billingResult?.toLowerCase() === "authorized"
                      ? "rgba(15,23,42,0.75)"
                      : "var(--warning, #b45309)",
                }}
              >
                {billingResultMessage}
              </p>
            )}
            <div
              style={{
                borderRadius: 20,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.98))",
                padding: 18,
                boxShadow: "0 16px 36px rgba(15,23,42,0.05)",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.05 }}>{billingPlanLabel}</div>
              <p style={{ marginTop: 10, marginBottom: 0, lineHeight: 1.55 }}>{billingSummaryText}</p>
              {billingCurrentPlanNote && <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{billingCurrentPlanNote}</p>}
              {!billingIsSuperAdminBypass && !hasPaidPlan && billingMonthlyPitch && (
                <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>{billingMonthlyPitch}</p>
              )}
              {!billingIsSuperAdminBypass && ((!hasPaidPlan && billingMonthlyOffer) || billing.canReactivateCurrentSubscription) && (
                <div style={{ marginTop: 16 }}>
                  {shouldRenderMonthlyCardForm ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t("account.billingCardholderLabel")}</div>
                      <input
                        className="input"
                        value={billingCardholderName}
                        onChange={(e) => setBillingCardholderName(e.target.value)}
                        placeholder={t("account.billingCardholderPlaceholder")}
                        autoComplete="cc-name"
                      />
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 12, marginBottom: 8 }}>{t("account.billingCardLabel")}</div>
                      <div
                        ref={billingCardHostRef}
                        style={{
                          minHeight: 52,
                          borderRadius: 14,
                          border: "1px solid rgba(15,23,42,0.12)",
                          background: "rgba(255,255,255,0.95)",
                          padding: "14px 16px",
                        }}
                      />
                      <p className="muted" style={{ marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                        {t("account.billingRecurringConsent", {
                          price: formatBillingAmount(
                            billingMonthlyOffer?.amountMinor ?? billing.commercialPolicy.proMonthlyUsdMinor,
                            billingMonthlyOffer?.currencyCode ?? "USD"
                          ),
                        })}
                      </p>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={billing.canReactivateCurrentSubscription ? onReactivateSubscription : onStartMonthlySubscription}
                        disabled={billingCheckoutLoading === "PRO_MONTHLY" || !billingCardReady}
                        style={{ marginTop: 14, width: "100%" }}
                      >
                        {billingCheckoutLoading === "PRO_MONTHLY" ? t("account.billingOfferLoading") : billingMonthlyActionLabel}
                      </button>
                    </>
                  ) : billing.canReactivateCurrentSubscription && !billing.reactivationRequiresCard ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={onReactivateSubscription}
                      disabled={billingCheckoutLoading === "PRO_MONTHLY"}
                      style={{ marginTop: 0, width: "100%" }}
                    >
                      {billingCheckoutLoading === "PRO_MONTHLY" ? t("account.billingOfferLoading") : billingMonthlyActionLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn primary"
                      disabled
                      style={{
                        marginTop: 0,
                        width: "100%",
                        background: "rgba(148,163,184,0.22)",
                        borderColor: "rgba(148,163,184,0.34)",
                        color: "rgba(51,65,85,0.9)",
                        cursor: "not-allowed",
                      }}
                    >
                      {billingMonthlyActionLabel}
                    </button>
                  )}
                </div>
              )}
              {!billingIsSuperAdminBypass && billing.canCancelCurrentSubscription && (
                <button
                  type="button"
                  className="btn"
                  onClick={onCancelSubscription}
                  disabled={billingCancelLoading}
                  style={{ marginTop: 14, width: "100%" }}
                >
                  {billingCancelLoading ? t("account.billingCancelLoading") : t("account.billingCancelCta")}
                </button>
              )}
              {billing.subscriptionStatus === "past_due" && billing.graceEndsAt && (
                <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>{t("account.billingGraceNotice", { date: formatBillingDate(billing.graceEndsAt) })}</p>
              )}
            </div>
            {billing.accessLevel === "read_only" && (
              <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>{t("account.billingReadOnlyNote")}</p>
            )}
            {billingCheckoutError && <div className="error" style={{ marginTop: 10 }}>{billingCheckoutError}</div>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{t("account.billingLoadError")}</p>
        )}
      </div>

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
