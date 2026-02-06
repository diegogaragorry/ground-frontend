// New onboarding: welcome + questions to build template, then tour.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

type ExpenseType = "FIXED" | "VARIABLE";
type Category = { id: string; name: string; expenseType: ExpenseType };

function findCategory(cats: Category[], name: string, type: ExpenseType): Category | undefined {
  return cats.find((c) => c.name === name && c.expenseType === type);
}

export function OnboardingWizard(props: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const { onComplete, onSkip } = props;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Housing
  const [housingRent, setHousingRent] = useState(false);
  const [housingMortgage, setHousingMortgage] = useState(false);
  const [housingFees, setHousingFees] = useState(false);
  const [housingRentUsd, setHousingRentUsd] = useState("");
  const [housingMortgageUsd, setHousingMortgageUsd] = useState("");
  const [housingFeesUsd, setHousingFeesUsd] = useState("");

  // Transport
  const [transportVehicle, setTransportVehicle] = useState(false);
  const [transportVehicleUsd, setTransportVehicleUsd] = useState("");
  const [transportPublic, setTransportPublic] = useState(false);
  const [transportTaxi, setTransportTaxi] = useState(false);
  const [transportPublicUsd, setTransportPublicUsd] = useState("");
  const [transportTaxiUsd, setTransportTaxiUsd] = useState("");

  // Services (home)
  const [svcElectricity, setSvcElectricity] = useState(false);
  const [svcWater, setSvcWater] = useState(false);
  const [svcInternet, setSvcInternet] = useState(false);
  const [svcMobile, setSvcMobile] = useState(false);
  const [svcGas, setSvcGas] = useState(false);
  const [svcTV, setSvcTV] = useState(false);
  const [svcStreaming, setSvcStreaming] = useState(false);
  const [svcOtherOnline, setSvcOtherOnline] = useState(false);
  const [svcUsd, setSvcUsd] = useState<Record<string, string>>({});

  // Health
  const [healthInsurance, setHealthInsurance] = useState(false);
  const [healthGym, setHealthGym] = useState(false);
  const [healthPharmacy, setHealthPharmacy] = useState(false);
  const [healthPersonal, setHealthPersonal] = useState(false);
  const [healthDental, setHealthDental] = useState(false);
  const [healthUsd, setHealthUsd] = useState<Record<string, string>>({});

  // Recurrent
  const [recGroceries, setRecGroceries] = useState(false);
  const [recGifts, setRecGifts] = useState(false);
  const [recDonations, setRecDonations] = useState(false);
  const [recSports, setRecSports] = useState(false);
  const [recRestaurants, setRecRestaurants] = useState(false);
  const [recCafes, setRecCafes] = useState(false);
  const [recDelivery, setRecDelivery] = useState(false);
  const [recEvents, setRecEvents] = useState(false);
  const [recUsd, setRecUsd] = useState<Record<string, string>>({});

  // Income
  const [incomeWork, setIncomeWork] = useState(false);
  const [incomeWorkUsd, setIncomeWorkUsd] = useState("");
  const [incomeSavings, setIncomeSavings] = useState(false);
  const [incomeSavingsUsd, setIncomeSavingsUsd] = useState("");
  const [incomeInvestments, setIncomeInvestments] = useState(false);
  const [investmentsList, setInvestmentsList] = useState<Array<{ name: string; returnPct: string; amountUsd: string }>>([{ name: "", returnPct: "0", amountUsd: "" }]);

  useEffect(() => {
    api<Category[]>("/categories")
      .then(setCategories)
      .catch((e) => setError(e?.message ?? "Failed to load categories"));
  }, []);

  function parseUsd(s: string): number | null {
    const v = String(s ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  async function ensureCategory(name: string, expenseType: ExpenseType): Promise<string> {
    let cat = findCategory(categories, name, expenseType);
    if (cat) return cat.id;
    const created = await api<Category>("/categories", {
      method: "POST",
      body: JSON.stringify({ name, expenseType }),
    });
    setCategories((prev) => [...prev, created]);
    return created.id;
  }

  async function createTemplate(categoryId: string, description: string, amountUsd: number | null) {
    try {
      await api("/admin/expenseTemplates", {
        method: "POST",
        body: JSON.stringify({ categoryId, description, defaultAmountUsd: amountUsd }),
      });
    } catch (e: any) {
      if (e?.message?.includes("409") || String(e?.message).toLowerCase().includes("unique")) return;
      throw e;
    }
  }

  async function saveHousing() {
    setError("");
    setLoading(true);
    try {
      const housingId = await ensureCategory("Housing", "FIXED");
      if (housingRent) await createTemplate(housingId, "Rent", parseUsd(housingRentUsd));
      if (housingMortgage) await createTemplate(housingId, "Mortgage", parseUsd(housingMortgageUsd));
      if (housingFees) await createTemplate(housingId, "Building Fees", parseUsd(housingFeesUsd));
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  async function saveTransport() {
    setError("");
    setLoading(true);
    try {
      const transportId = await ensureCategory("Transport", "VARIABLE");
      if (transportVehicle) await createTemplate(transportId, "Fuel", parseUsd(transportVehicleUsd));
      if (transportPublic) await createTemplate(transportId, "Public Transport", parseUsd(transportPublicUsd));
      if (transportTaxi) await createTemplate(transportId, "Ride Sharing / Taxis", parseUsd(transportTaxiUsd));
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  async function saveServices() {
    setError("");
    setLoading(true);
    try {
      const utilitiesCat = findCategory(categories, "Utilities", "FIXED");
      const connectivityCat = findCategory(categories, "Connectivity", "FIXED");
      if (utilitiesCat) {
        if (svcElectricity) await createTemplate(utilitiesCat.id, "Electricity", parseUsd(svcUsd.electricity));
        if (svcWater) await createTemplate(utilitiesCat.id, "Water", parseUsd(svcUsd.water));
        if (svcGas) await createTemplate(utilitiesCat.id, "Gas", parseUsd(svcUsd.gas));
      }
      if (connectivityCat) {
        if (svcInternet) await createTemplate(connectivityCat.id, "Internet / Fiber", parseUsd(svcUsd.internet));
        if (svcMobile) await createTemplate(connectivityCat.id, "Mobile Phone", parseUsd(svcUsd.mobile));
        if (svcTV) await createTemplate(connectivityCat.id, "TV / Cable", parseUsd(svcUsd.tv));
        if (svcStreaming) await createTemplate(connectivityCat.id, "Streaming Services", parseUsd(svcUsd.streaming));
        if (svcOtherOnline) await createTemplate(connectivityCat.id, "Other online (Spotify, etc.)", parseUsd(svcUsd.otherOnline));
      }
      setStep(4);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  async function saveHealth() {
    const healthCat = findCategory(categories, "Health & Wellness", "FIXED");
    const wellnessCat = findCategory(categories, "Wellness", "VARIABLE");
    if (!healthCat && !wellnessCat) {
      setError("Health category not found.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (healthCat) {
        if (healthInsurance) await createTemplate(healthCat.id, "Private Health Insurance", parseUsd(healthUsd.insurance));
        if (healthGym) await createTemplate(healthCat.id, "Gym Membership", parseUsd(healthUsd.gym));
      }
      if (wellnessCat) {
        if (healthPharmacy) await createTemplate(wellnessCat.id, "Pharmacy", parseUsd(healthUsd.pharmacy));
        if (healthPersonal) await createTemplate(wellnessCat.id, "Personal Care", parseUsd(healthUsd.personal));
        if (healthDental) await createTemplate(wellnessCat.id, "Medical / Dental", parseUsd(healthUsd.dental));
      }
      setStep(5);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecurrent() {
    const foodCat = findCategory(categories, "Food & Grocery", "VARIABLE");
    const diningCat = findCategory(categories, "Dining & Leisure", "VARIABLE");
    const sportsCat = findCategory(categories, "Sports", "VARIABLE");
    const giftsCat = findCategory(categories, "Gifts & Social", "VARIABLE");
    setError("");
    setLoading(true);
    try {
      if (recGroceries && foodCat) await createTemplate(foodCat.id, "Groceries", parseUsd(recUsd.groceries));
      if (recGifts && giftsCat) await createTemplate(giftsCat.id, "Holiday Gifts", parseUsd(recUsd.gifts));
      if (recDonations && giftsCat) await createTemplate(giftsCat.id, "Donations / Raffles", parseUsd(recUsd.donations));
      if (recSports && sportsCat) await createTemplate(sportsCat.id, "Tenis, Surf, Football / Others", parseUsd(recUsd.sports));
      if (recRestaurants && diningCat) await createTemplate(diningCat.id, "Restaurants", parseUsd(recUsd.restaurants));
      if (recCafes && diningCat) await createTemplate(diningCat.id, "Coffee & Snacks", parseUsd(recUsd.cafes));
      if (recDelivery && diningCat) await createTemplate(diningCat.id, "Delivery", parseUsd(recUsd.delivery));
      if (recEvents && diningCat) await createTemplate(diningCat.id, "Events & Concerts", parseUsd(recUsd.events));
      setStep(6);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  async function saveIncomeAndFinish() {
    setError("");
    setLoading(true);
    const year = new Date().getFullYear();
    try {
      if (incomeWork && Number.isFinite(Number(incomeWorkUsd))) {
        const usd = Number(incomeWorkUsd);
        for (let m = 1; m <= 12; m++) {
          await api("/income", { method: "POST", body: JSON.stringify({ year, month: m, amountUsd: usd }) });
        }
      }
      let bankAccountId: string | null = null;
      if (incomeSavings) {
        const existingInvs = await api<Array<{ id: string; type: string }>>("/investments").catch(() => []);
        const account = Array.isArray(existingInvs) ? existingInvs.find((i) => i.type === "ACCOUNT") : null;
        if (account) {
          bankAccountId = account.id;
        } else {
          const created = await api<{ id: string }>("/investments", {
            method: "POST",
            body: JSON.stringify({
              name: "Bank account",
              type: "ACCOUNT",
              currencyId: "USD",
              targetAnnualReturn: 0,
              yieldStartYear: year,
              yieldStartMonth: 1,
            }),
          });
          bankAccountId = created.id;
        }
        const savingsUsd = Number(incomeSavingsUsd);
        if (bankAccountId && Number.isFinite(savingsUsd) && savingsUsd >= 0) {
          const month = new Date().getMonth() + 1;
          await api(`/investments/${bankAccountId}/snapshots/${year}/${month}`, {
            method: "PUT",
            body: JSON.stringify({ closingCapital: savingsUsd }),
          });
        }
      }
      const validInvs = investmentsList.filter((i) => i.name.trim());
      for (const inv of validInvs) {
        const created = await api<{ id: string }>("/investments", {
          method: "POST",
          body: JSON.stringify({
            name: inv.name.trim(),
            type: "PORTFOLIO",
            currencyId: "USD",
            targetAnnualReturn: (Number(inv.returnPct) || 0) / 100,
            yieldStartYear: year,
            yieldStartMonth: 1,
          }),
        });
        const amountUsd = Number(inv.amountUsd);
        if (Number.isFinite(amountUsd) && amountUsd >= 0) {
          const month = new Date().getMonth() + 1;
          await api(`/investments/${created.id}/snapshots/${year}/${month}`, {
            method: "PUT",
            body: JSON.stringify({ closingCapital: amountUsd }),
          });
        }
      }
      setStep(7);
    } catch (e: any) {
      setError(e?.message ?? "Error saving");
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step === 0) setStep(1);
    else if (step === 7) onComplete();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 560 }}>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      {/* Step 0: Welcome */}
      {step === 0 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 8 }}>{t("onboarding.wizardWelcomeTitle")}</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 24 }}>
            {t("onboarding.wizardWelcomeSub")}
          </div>
        </>
      )}

      {/* Step 1: Housing */}
      {step === 1 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardHousingTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardHousingSub")}</div>
          <div style={{ display: "grid", gap: 12 }}>
            <label className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={housingRent} onChange={(e) => setHousingRent(e.target.checked)} />
              <span>{t("onboarding.wizardHousingRent")}</span>
              <span className="muted" style={{ fontSize: 12 }}>({t("onboarding.wizardHousingRentDesc")})</span>
              {housingRent && (
                <input
                  type="number"
                  className="input"
                  placeholder={t("onboarding.wizardOptionalUsd")}
                  value={housingRentUsd}
                  onChange={(e) => setHousingRentUsd(e.target.value)}
                  style={{ width: 240 }}
                />
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={housingMortgage} onChange={(e) => setHousingMortgage(e.target.checked)} />
              <span>{t("onboarding.wizardHousingMortgage")}</span>
              <span className="muted" style={{ fontSize: 12 }}>({t("onboarding.wizardHousingMortgageDesc")})</span>
              {housingMortgage && (
                <input
                  type="number"
                  className="input"
                  placeholder={t("onboarding.wizardOptionalUsd")}
                  value={housingMortgageUsd}
                  onChange={(e) => setHousingMortgageUsd(e.target.value)}
                  style={{ width: 240 }}
                />
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={housingFees} onChange={(e) => setHousingFees(e.target.checked)} />
              <span>{t("onboarding.wizardHousingFees")}</span>
              <span className="muted" style={{ fontSize: 12 }}>({t("onboarding.wizardHousingFeesDesc")})</span>
              {housingFees && (
                <input
                  type="number"
                  className="input"
                  placeholder={t("onboarding.wizardOptionalUsd")}
                  value={housingFeesUsd}
                  onChange={(e) => setHousingFeesUsd(e.target.value)}
                  style={{ width: 240 }}
                />
              )}
            </label>
          </div>
        </>
      )}

      {/* Step 2: Transport */}
      {step === 2 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardTransportTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardTransportSub")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { key: "vehicle", checked: transportVehicle, set: setTransportVehicle, usd: transportVehicleUsd, setUsd: setTransportVehicleUsd, labelKey: "wizardTransportVehicle" },
              { key: "public", checked: transportPublic, set: setTransportPublic, usd: transportPublicUsd, setUsd: setTransportPublicUsd, labelKey: "wizardTransportPublic" },
              { key: "taxi", checked: transportTaxi, set: setTransportTaxi, usd: transportTaxiUsd, setUsd: setTransportTaxiUsd, labelKey: "wizardTransportTaxi" },
            ].map(({ key, checked, set, usd, setUsd, labelKey }) => (
              <label key={key} className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                <span>{t(`onboarding.${labelKey}`)}</span>
                {checked && (
                  <input
                    type="number"
                    className="input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={usd}
                    onChange={(e) => setUsd(e.target.value)}
                    style={{ width: 240 }}
                  />
                )}
              </label>
            ))}
            <div className="muted" style={{ fontSize: 12 }}>{t("onboarding.wizardTransportFuelNote")}</div>
          </div>
        </>
      )}

      {/* Step 3: Home services - abbreviated for length, same pattern */}
      {step === 3 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardServicesTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardServicesSub")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { id: "electricity", c: svcElectricity, setC: setSvcElectricity, label: "wizardServicesElectricity" },
              { id: "water", c: svcWater, setC: setSvcWater, label: "wizardServicesWater" },
              { id: "internet", c: svcInternet, setC: setSvcInternet, label: "wizardServicesInternet" },
              { id: "mobile", c: svcMobile, setC: setSvcMobile, label: "wizardServicesMobile" },
              { id: "gas", c: svcGas, setC: setSvcGas, label: "wizardServicesGas" },
              { id: "tv", c: svcTV, setC: setSvcTV, label: "wizardServicesTV" },
              { id: "streaming", c: svcStreaming, setC: setSvcStreaming, label: "wizardServicesStreaming" },
              { id: "otherOnline", c: svcOtherOnline, setC: setSvcOtherOnline, label: "wizardServicesOtherOnline" },
            ].map(({ id, c, setC, label }) => (
              <label key={id} className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                <span>{t(`onboarding.${label}`)}</span>
                {c && (
                  <input
                    type="number"
                    className="input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={svcUsd[id] ?? ""}
                    onChange={(e) => setSvcUsd((prev) => ({ ...prev, [id]: e.target.value }))}
                    style={{ width: 240 }}
                  />
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Step 4: Health */}
      {step === 4 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardHealthTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardHealthSub")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { id: "insurance", c: healthInsurance, setC: setHealthInsurance, label: "wizardHealthInsurance" },
              { id: "gym", c: healthGym, setC: setHealthGym, label: "wizardHealthGym" },
              { id: "pharmacy", c: healthPharmacy, setC: setHealthPharmacy, label: "wizardHealthPharmacy" },
              { id: "personal", c: healthPersonal, setC: setHealthPersonal, label: "wizardHealthPersonal" },
              { id: "dental", c: healthDental, setC: setHealthDental, label: "wizardHealthDental" },
            ].map(({ id, c, setC, label }) => (
              <label key={id} className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                <span>{t(`onboarding.${label}`)}</span>
                {c && (
                  <input
                    type="number"
                    className="input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={healthUsd[id] ?? ""}
                    onChange={(e) => setHealthUsd((prev) => ({ ...prev, [id]: e.target.value }))}
                    style={{ width: 240 }}
                  />
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Step 5: Recurrent */}
      {step === 5 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardRecurrentTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardRecurrentSub")}</div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { id: "groceries", c: recGroceries, set: setRecGroceries, key: "wizardRecurrentGroceries" },
              { id: "gifts", c: recGifts, set: setRecGifts, key: "wizardRecurrentGifts" },
              { id: "donations", c: recDonations, set: setRecDonations, key: "wizardRecurrentDonations" },
              { id: "sports", c: recSports, set: setRecSports, key: "wizardRecurrentSports" },
              { id: "restaurants", c: recRestaurants, set: setRecRestaurants, key: "wizardRecurrentRestaurants" },
              { id: "cafes", c: recCafes, set: setRecCafes, key: "wizardRecurrentCafes" },
              { id: "delivery", c: recDelivery, set: setRecDelivery, key: "wizardRecurrentDelivery" },
              { id: "events", c: recEvents, set: setRecEvents, key: "wizardRecurrentEvents" },
            ].map(({ id, c, set, key }) => (
              <label key={key} className="row" style={{ alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={c} onChange={(e) => set(e.target.checked)} />
                <span>{t(`onboarding.${key}`)}</span>
                {c && (
                  <input
                    type="number"
                    className="input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={recUsd[id] ?? ""}
                    onChange={(e) => setRecUsd((prev) => ({ ...prev, [id]: e.target.value }))}
                    style={{ width: 240 }}
                  />
                )}
              </label>
            ))}
          </div>
        </>
      )}

      {/* Step 6: Income */}
      {step === 6 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardIncomeTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardIncomeSub")}</div>
          <div style={{ display: "grid", gap: 14 }}>
            <label className="row" style={{ alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={incomeWork} onChange={(e) => setIncomeWork(e.target.checked)} />
              <span>{t("onboarding.wizardIncomeWork")}</span>
              {incomeWork && (
                <input
                  type="number"
                  className="input"
                  placeholder={t("onboarding.wizardIncomeWorkPlaceholder")}
                  value={incomeWorkUsd}
                  onChange={(e) => setIncomeWorkUsd(e.target.value)}
                  style={{ width: 240 }}
                />
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={incomeSavings} onChange={(e) => setIncomeSavings(e.target.checked)} />
              <span>{t("onboarding.wizardIncomeSavings")}</span>
              {incomeSavings && (
                <input
                  type="number"
                  className="input"
                  placeholder={t("onboarding.wizardIncomeSavingsPlaceholder")}
                  value={incomeSavingsUsd}
                  onChange={(e) => setIncomeSavingsUsd(e.target.value)}
                  style={{ width: 240 }}
                />
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={incomeInvestments} onChange={(e) => setIncomeInvestments(e.target.checked)} />
              <span>{t("onboarding.wizardIncomeInvestments")}</span>
            </label>
            {incomeInvestments && (
              <div style={{ paddingLeft: 28, display: "grid", gap: 10 }}>
                {investmentsList.map((inv, idx) => (
                  <div key={idx} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto auto" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder={t("onboarding.wizardIncomeInvestWhere")}
                      value={inv.name}
                      onChange={(e) =>
                        setInvestmentsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return next;
                        })
                      }
                      style={{ minWidth: 0 }}
                    />
                    <input
                      type="number"
                      className="input"
                      placeholder={t("onboarding.wizardIncomeInvestAmount")}
                      value={inv.amountUsd}
                      onChange={(e) =>
                        setInvestmentsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], amountUsd: e.target.value };
                          return next;
                        })
                      }
                      style={{ width: 160 }}
                      min={0}
                    />
                    <div className="row" style={{ alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        className="input"
                        placeholder={t("onboarding.wizardIncomeInvestReturn")}
                        value={inv.returnPct}
                        onChange={(e) =>
                          setInvestmentsList((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], returnPct: e.target.value };
                            return next;
                          })
                        }
                        style={{ width: 200 }}
                        title={t("onboarding.wizardIncomeInvestReturn")}
                      />
                      <span className="muted" style={{ fontSize: 14 }}>%</span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setInvestmentsList((prev) => [...prev, { name: "", returnPct: "0", amountUsd: "" }])}
                >
                  {t("onboarding.wizardAddInvestment")}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Step 7: Done */}
      {step === 7 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{t("onboarding.wizardDoneTitle")}</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.4 }}>{t("onboarding.wizardDoneSub")}</div>
        </>
      )}

      {/* Footer */}
      <div className="row" style={{ marginTop: 24, gap: 10, flexWrap: "wrap" }}>
        {step > 0 && step < 7 && (
          <button type="button" className="btn" onClick={back} disabled={loading}>
            {t("onboarding.wizardBack")}
          </button>
        )}
        {step === 0 && (
          <button type="button" className="btn primary" onClick={next}>
            {t("onboarding.wizardNext")}
          </button>
        )}
        {step === 1 && (
          <button type="button" className="btn primary" onClick={saveHousing} disabled={loading || !(housingRent || housingMortgage || housingFees)}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 2 && (
          <button type="button" className="btn primary" onClick={saveTransport} disabled={loading}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 3 && (
          <button type="button" className="btn primary" onClick={saveServices} disabled={loading}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 4 && (
          <button type="button" className="btn primary" onClick={saveHealth} disabled={loading}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 5 && (
          <button type="button" className="btn primary" onClick={saveRecurrent} disabled={loading}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 6 && (
          <button type="button" className="btn primary" onClick={saveIncomeAndFinish} disabled={loading}>
            {loading ? t("common.loading") : t("onboarding.wizardNext")}
          </button>
        )}
        {step === 7 && (
          <button type="button" className="btn primary" onClick={onComplete}>
            {t("onboarding.wizardGoToExpenses")}
          </button>
        )}
        <button type="button" className="btn" onClick={onSkip} style={{ marginLeft: "auto" }}>
          {t("onboarding.wizardSkip")}
        </button>
      </div>
    </div>
  );
}
