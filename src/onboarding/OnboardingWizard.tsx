// New onboarding: welcome + questions to build template, then tour.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAppShell } from "../layout/AppShell";
import { getFxDefault } from "../utils/fx";

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
  const { updatePreferredDisplayCurrency, preferredDisplayCurrencyId } = useAppShell();

  const [step, setStep] = useState(0);
  const [wizardDisplayCurrency, setWizardDisplayCurrency] = useState<"USD" | "UYU">(
    () => preferredDisplayCurrencyId
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const selectedTemplateIdsRef = useRef<string[]>([]);

  // Moneda y tipo de cambio por ítem (key ej. "housing.rent", "transport.vehicle")
  const [wizardItemCurrency, setWizardItemCurrency] = useState<Record<string, "UYU" | "USD">>({});
  const [wizardItemRate, setWizardItemRate] = useState<Record<string, number>>({});

  function getItemCurrency(key: string): "UYU" | "USD" {
    return wizardItemCurrency[key] ?? "USD";
  }
  function setItemCurrency(key: string, v: "UYU" | "USD") {
    setWizardItemCurrency((prev) => ({ ...prev, [key]: v }));
  }
  function getItemRate(key: string): number {
    return wizardItemRate[key] ?? getFxDefault();
  }
  function setItemRate(key: string, v: number) {
    setWizardItemRate((prev) => ({ ...prev, [key]: v }));
  }

  // Housing
  const [housingRent, setHousingRent] = useState(false);
  const [housingMortgage, setHousingMortgage] = useState(false);
  const [housingFees, setHousingFees] = useState(false);
  const [housingTaxes, setHousingTaxes] = useState(false);
  const [housingRentUsd, setHousingRentUsd] = useState("");
  const [housingMortgageUsd, setHousingMortgageUsd] = useState("");
  const [housingFeesUsd, setHousingFeesUsd] = useState("");
  const [housingTaxesUsd, setHousingTaxesUsd] = useState("");

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
  const [incomeWorkType, setIncomeWorkType] = useState<"nominal" | "liquid">("liquid");
  const [incomeWorkTaxes, setIncomeWorkTaxes] = useState("");
  const [incomeSavings, setIncomeSavings] = useState(false);
  const [incomeSavingsUsd, setIncomeSavingsUsd] = useState("");
  const [incomeInvestments, setIncomeInvestments] = useState(false);
  const [investmentsList, setInvestmentsList] = useState<Array<{ name: string; returnPct: string; amountUsd: string; currencyId: "UYU" | "USD" }>>([{ name: "", returnPct: "0", amountUsd: "", currencyId: "USD" }]);

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

  function toUsdAmount(amountStr: string, currencyId: "UYU" | "USD", usdUyuRate: number): number | null {
    const n = parseUsd(amountStr);
    if (n == null) return null;
    if (currencyId === "USD") return n;
    if (!Number.isFinite(usdUyuRate) || usdUyuRate <= 0) return null;
    return n / usdUyuRate;
  }

  async function createTemplate(
    categoryId: string,
    description: string,
    amountUsd: number | null,
    defaultCurrencyId: "UYU" | "USD"
  ): Promise<{ id: string } | undefined> {
    try {
      const template = await api<{ id: string }>("/admin/expenseTemplates", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          description,
          defaultAmountUsd: amountUsd,
          defaultCurrencyId,
        }),
      });
      if (template?.id) selectedTemplateIdsRef.current.push(template.id);
      return template;
    } catch (e: any) {
      if (e?.message?.includes("409") || String(e?.message).toLowerCase().includes("unique")) {
        try {
          const { rows } = await api<{ rows: Array<{ id: string; categoryId: string; description: string }> }>("/admin/expenseTemplates");
          const existing = Array.isArray(rows) ? rows.find((r) => r.categoryId === categoryId && r.description === description) : null;
          if (existing?.id) {
            if (!selectedTemplateIdsRef.current.includes(existing.id)) selectedTemplateIdsRef.current.push(existing.id);
            return { id: existing.id };
          }
        } catch {
          // ignore
        }
        return undefined;
      }
      throw e;
    }
  }

  async function saveHousing() {
    setError("");
    setLoading(true);
    selectedTemplateIdsRef.current = [];
    try {
      const housingId = await ensureCategory("Housing", "FIXED");
      if (housingRent) {
        const cur = getItemCurrency("housing.rent");
        await createTemplate(housingId, "Rent", toUsdAmount(housingRentUsd, cur, getItemRate("housing.rent")), cur);
      }
      if (housingMortgage) {
        const cur = getItemCurrency("housing.mortgage");
        await createTemplate(housingId, "Mortgage", toUsdAmount(housingMortgageUsd, cur, getItemRate("housing.mortgage")), cur);
      }
      if (housingFees) {
        const cur = getItemCurrency("housing.fees");
        await createTemplate(housingId, "Building Fees", toUsdAmount(housingFeesUsd, cur, getItemRate("housing.fees")), cur);
      }
      if (housingTaxes) {
        const cur = getItemCurrency("housing.taxes");
        await createTemplate(housingId, "Property Taxes", toUsdAmount(housingTaxesUsd, cur, getItemRate("housing.taxes")), cur);
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
    } finally {
      setLoading(false);
    }
  }

  async function saveTransport() {
    setError("");
    setLoading(true);
    try {
      const transportId = await ensureCategory("Transport", "VARIABLE");
      if (transportVehicle) {
        const cur = getItemCurrency("transport.vehicle");
        await createTemplate(transportId, "Fuel", toUsdAmount(transportVehicleUsd, cur, getItemRate("transport.vehicle")), cur);
      }
      if (transportPublic) {
        const cur = getItemCurrency("transport.public");
        await createTemplate(transportId, "Public Transport", toUsdAmount(transportPublicUsd, cur, getItemRate("transport.public")), cur);
      }
      if (transportTaxi) {
        const cur = getItemCurrency("transport.taxi");
        await createTemplate(transportId, "Ride Sharing / Taxis", toUsdAmount(transportTaxiUsd, cur, getItemRate("transport.taxi")), cur);
      }
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
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
        if (svcElectricity) {
          const cur = getItemCurrency("svc.electricity");
          await createTemplate(utilitiesCat.id, "Electricity", toUsdAmount(svcUsd.electricity ?? "", cur, getItemRate("svc.electricity")), cur);
        }
        if (svcWater) {
          const cur = getItemCurrency("svc.water");
          await createTemplate(utilitiesCat.id, "Water", toUsdAmount(svcUsd.water ?? "", cur, getItemRate("svc.water")), cur);
        }
        if (svcGas) {
          const cur = getItemCurrency("svc.gas");
          await createTemplate(utilitiesCat.id, "Gas", toUsdAmount(svcUsd.gas ?? "", cur, getItemRate("svc.gas")), cur);
        }
      }
      if (connectivityCat) {
        if (svcInternet) {
          const cur = getItemCurrency("svc.internet");
          await createTemplate(connectivityCat.id, "Internet / Fiber", toUsdAmount(svcUsd.internet ?? "", cur, getItemRate("svc.internet")), cur);
        }
        if (svcMobile) {
          const cur = getItemCurrency("svc.mobile");
          await createTemplate(connectivityCat.id, "Mobile Phone", toUsdAmount(svcUsd.mobile ?? "", cur, getItemRate("svc.mobile")), cur);
        }
        if (svcTV) {
          const cur = getItemCurrency("svc.tv");
          await createTemplate(connectivityCat.id, "TV / Cable", toUsdAmount(svcUsd.tv ?? "", cur, getItemRate("svc.tv")), cur);
        }
        if (svcStreaming) {
          const cur = getItemCurrency("svc.streaming");
          await createTemplate(connectivityCat.id, "Streaming Services", toUsdAmount(svcUsd.streaming ?? "", cur, getItemRate("svc.streaming")), cur);
        }
        if (svcOtherOnline) {
          const cur = getItemCurrency("svc.otherOnline");
          await createTemplate(connectivityCat.id, "Other online (Spotify, etc.)", toUsdAmount(svcUsd.otherOnline ?? "", cur, getItemRate("svc.otherOnline")), cur);
        }
      }
      setStep(4);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
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
        if (healthInsurance) {
          const cur = getItemCurrency("health.insurance");
          await createTemplate(healthCat.id, "Private Health Insurance", toUsdAmount(healthUsd.insurance ?? "", cur, getItemRate("health.insurance")), cur);
        }
        if (healthGym) {
          const cur = getItemCurrency("health.gym");
          await createTemplate(healthCat.id, "Gym Membership", toUsdAmount(healthUsd.gym ?? "", cur, getItemRate("health.gym")), cur);
        }
      }
      if (wellnessCat) {
        if (healthPharmacy) {
          const cur = getItemCurrency("health.pharmacy");
          await createTemplate(wellnessCat.id, "Pharmacy", toUsdAmount(healthUsd.pharmacy ?? "", cur, getItemRate("health.pharmacy")), cur);
        }
        if (healthPersonal) {
          const cur = getItemCurrency("health.personal");
          await createTemplate(wellnessCat.id, "Personal Care", toUsdAmount(healthUsd.personal ?? "", cur, getItemRate("health.personal")), cur);
        }
        if (healthDental) {
          const cur = getItemCurrency("health.dental");
          await createTemplate(wellnessCat.id, "Psychologist", toUsdAmount(healthUsd.dental ?? "", cur, getItemRate("health.dental")), cur);
        }
      }
      setStep(5);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
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
    const recurrentVisibleIds: string[] = [];
    // Consider selected if checkbox is checked OR user entered an amount (so "completed" = visible)
    const has = (rec: boolean, key: string) => rec || String(recUsd[key] ?? "").trim() !== "";
    try {
      if (has(recGroceries, "groceries") && foodCat) {
        const cur = getItemCurrency("rec.groceries");
        const t = await createTemplate(foodCat.id, "Groceries", toUsdAmount(recUsd.groceries ?? "", cur, getItemRate("rec.groceries")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recGifts, "gifts") && giftsCat) {
        const cur = getItemCurrency("rec.gifts");
        const t = await createTemplate(giftsCat.id, "Holiday Gifts", toUsdAmount(recUsd.gifts ?? "", cur, getItemRate("rec.gifts")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recDonations, "donations") && giftsCat) {
        const cur = getItemCurrency("rec.donations");
        const t = await createTemplate(giftsCat.id, "Donations / Raffles", toUsdAmount(recUsd.donations ?? "", cur, getItemRate("rec.donations")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recSports, "sports") && sportsCat) {
        const cur = getItemCurrency("rec.sports");
        const t = await createTemplate(sportsCat.id, "Tenis, Surf, Football / Others", toUsdAmount(recUsd.sports ?? "", cur, getItemRate("rec.sports")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recRestaurants, "restaurants") && diningCat) {
        const cur = getItemCurrency("rec.restaurants");
        const t = await createTemplate(diningCat.id, "Restaurants", toUsdAmount(recUsd.restaurants ?? "", cur, getItemRate("rec.restaurants")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recCafes, "cafes") && diningCat) {
        const cur = getItemCurrency("rec.cafes");
        const t = await createTemplate(diningCat.id, "Coffee & Snacks", toUsdAmount(recUsd.cafes ?? "", cur, getItemRate("rec.cafes")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recDelivery, "delivery") && diningCat) {
        const cur = getItemCurrency("rec.delivery");
        const t = await createTemplate(diningCat.id, "Delivery", toUsdAmount(recUsd.delivery ?? "", cur, getItemRate("rec.delivery")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      if (has(recEvents, "events") && diningCat) {
        const cur = getItemCurrency("rec.events");
        const t = await createTemplate(diningCat.id, "Events & Concerts", toUsdAmount(recUsd.events ?? "", cur, getItemRate("rec.events")), cur);
        if (t?.id) recurrentVisibleIds.push(t.id);
      }
      // Visibility: only templates selected in THIS step (recurrent). First time → only these; re-run → keep already visible + these
      const { rows } = await api<{ rows: Array<{ id: string; categoryId: string; description: string; showInExpenses?: boolean }> }>("/admin/expenseTemplates");
      const allRows = Array.isArray(rows) ? rows : [];
      // Fallback: add any recurrent template we selected but didn't get an id for (e.g. 409 path returned undefined)
      const recurrentDescs: Array<{ categoryId: string; description: string }> = [];
      if (foodCat && has(recGroceries, "groceries")) recurrentDescs.push({ categoryId: foodCat.id, description: "Groceries" });
      if (giftsCat && has(recGifts, "gifts")) recurrentDescs.push({ categoryId: giftsCat.id, description: "Holiday Gifts" });
      if (giftsCat && has(recDonations, "donations")) recurrentDescs.push({ categoryId: giftsCat.id, description: "Donations / Raffles" });
      if (sportsCat && has(recSports, "sports")) recurrentDescs.push({ categoryId: sportsCat.id, description: "Tenis, Surf, Football / Others" });
      if (diningCat && has(recRestaurants, "restaurants")) recurrentDescs.push({ categoryId: diningCat.id, description: "Restaurants" });
      if (diningCat && has(recCafes, "cafes")) recurrentDescs.push({ categoryId: diningCat.id, description: "Coffee & Snacks" });
      if (diningCat && has(recDelivery, "delivery")) recurrentDescs.push({ categoryId: diningCat.id, description: "Delivery" });
      if (diningCat && has(recEvents, "events")) recurrentDescs.push({ categoryId: diningCat.id, description: "Events & Concerts" });
      const idsSet = new Set(recurrentVisibleIds);
      for (const { categoryId, description } of recurrentDescs) {
        const row = allRows.find((r) => r.categoryId === categoryId && (r.description ?? "").trim() === description);
        if (row?.id && !idsSet.has(row.id)) {
          idsSet.add(row.id);
          recurrentVisibleIds.push(row.id);
        }
      }
      // Use ALL templates the user selected in the entire wizard (housing, transport, services, recurrent)
      const allSelectedIds = [...new Set([...selectedTemplateIdsRef.current, ...recurrentVisibleIds])];
      const alreadyVisible = allRows.filter((r) => r.showInExpenses !== false).map((r) => r.id);
      const isFirstTimeOrAllDefault = allRows.length > 0 && alreadyVisible.length === allRows.length;
      const visibleTemplateIds = isFirstTimeOrAllDefault
        ? allSelectedIds
        : [...new Set([...alreadyVisible, ...allSelectedIds])];
      await api("/admin/expenseTemplates/set-visibility", {
        method: "POST",
        body: JSON.stringify({ visibleTemplateIds }),
      });
      setStep(6);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
    } finally {
      setLoading(false);
    }
  }

  async function saveIncomeAndFinish() {
    setError("");
    setLoading(true);
    const year = new Date().getFullYear();
    try {
      if (incomeWork) {
        const workCur = getItemCurrency("income.work");
        const workRate = getItemRate("income.work");
        const nominalUsd = toUsdAmount(incomeWorkUsd, workCur, workRate);
        if (nominalUsd !== null && nominalUsd >= 0) {
          if (incomeWorkType === "nominal") {
            const taxesUsd = toUsdAmount(incomeWorkTaxes, workCur, workRate) ?? 0;
            for (let m = 1; m <= 12; m++) {
              await api("/income", { method: "POST", body: JSON.stringify({ year, month: m, nominalUsd, taxesUsd }) });
            }
          } else {
            for (let m = 1; m <= 12; m++) {
              await api("/income", { method: "POST", body: JSON.stringify({ year, month: m, amountUsd: nominalUsd }) });
            }
          }
        }
      }
      let bankAccountId: string | null = null;
      if (incomeSavings) {
        const savingsCur = getItemCurrency("income.savings");
        const savingsRate = getItemRate("income.savings");
        const savingsUsd = toUsdAmount(incomeSavingsUsd, savingsCur, savingsRate);
        const existingInvs = await api<Array<{ id: string; type: string; currencyId?: string }>>("/investments").catch(() => []);
        const account = Array.isArray(existingInvs) ? existingInvs.find((i) => i.type === "ACCOUNT") : null;
        if (account) {
          bankAccountId = account.id;
          // Always set account currency to what user chose for savings (account may have been created at register with USD)
          await api(`/investments/${account.id}`, {
            method: "PUT",
            body: JSON.stringify({ currencyId: String(savingsCur).trim().toUpperCase() }),
          });
        } else {
          const created = await api<{ id: string }>("/investments", {
            method: "POST",
            body: JSON.stringify({
              name: t("investments.defaultBankAccountName"),
              type: "ACCOUNT",
              currencyId: savingsCur,
              targetAnnualReturn: 0,
              yieldStartYear: year,
              yieldStartMonth: 1,
            }),
          });
          bankAccountId = created.id;
        }
        // Snapshot: value in the account currency (so Investments shows UYU when user chose UYU)
        const capitalInCurrency = savingsCur === "UYU" ? Number(incomeSavingsUsd) || 0 : (savingsUsd ?? 0);
        if (bankAccountId && Number.isFinite(capitalInCurrency) && capitalInCurrency >= 0) {
          const month = new Date().getMonth() + 1;
          const body: { closingCapital: number; usdUyuRate?: number } = { closingCapital: capitalInCurrency };
          if (savingsCur === "UYU" && Number.isFinite(savingsRate) && savingsRate > 0) body.usdUyuRate = savingsRate;
          await api(`/investments/${bankAccountId}/snapshots/${year}/${month}`, {
            method: "PUT",
            body: JSON.stringify(body),
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
            currencyId: inv.currencyId,
            targetAnnualReturn: (Number(inv.returnPct) || 0) / 100,
            yieldStartYear: year,
            yieldStartMonth: 1,
          }),
        });
        const amount = Number(inv.amountUsd);
        if (Number.isFinite(amount) && amount >= 0) {
          const month = new Date().getMonth() + 1;
          const snapshotBody: { closingCapital: number; usdUyuRate?: number } = { closingCapital: amount };
          if (inv.currencyId === "UYU") snapshotBody.usdUyuRate = getItemRate("income.savings");
          await api(`/investments/${created.id}/snapshots/${year}/${month}`, {
            method: "PUT",
            body: JSON.stringify(snapshotBody),
          });
        }
      }
      setStep(7);
    } catch (e: any) {
      setError(e?.message ?? t("common.errorSaving"));
    } finally {
      setLoading(false);
    }
  }

  function next() {
    if (step === 0) {
      updatePreferredDisplayCurrency(wizardDisplayCurrency).catch(() => {});
      setStep(1);
    } else if (step === 7) onComplete();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 640, width: "100%" }}>
      <style>{`.onboarding-amount-input::placeholder { font-size: 11px; }`}</style>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      {/* Step 0: Welcome */}
      {step === 0 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 8 }}>{t("onboarding.wizardWelcomeTitle")}</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 16 }}>
            {t("onboarding.wizardWelcomeSub")}
          </div>
          <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 24 }}>
            <span className="muted" style={{ fontSize: 13 }}>{t("admin.displayCurrency")}</span>
            <select
              className="select"
              value={wizardDisplayCurrency}
              onChange={(e) => setWizardDisplayCurrency(e.target.value as "USD" | "UYU")}
              style={{ width: 80, height: 36 }}
              aria-label={t("admin.displayCurrency")}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
          </div>
        </>
      )}

      {/* Step 1: Housing */}
      {step === 1 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardHousingTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardHousingSub")}</div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { key: "housing.rent", checked: housingRent, set: setHousingRent, usd: housingRentUsd, setUsd: setHousingRentUsd, label: "wizardHousingRent" },
              { key: "housing.mortgage", checked: housingMortgage, set: setHousingMortgage, usd: housingMortgageUsd, setUsd: setHousingMortgageUsd, label: "wizardHousingMortgage" },
              { key: "housing.fees", checked: housingFees, set: setHousingFees, usd: housingFeesUsd, setUsd: setHousingFeesUsd, label: "wizardHousingFees" },
              { key: "housing.taxes", checked: housingTaxes, set: setHousingTaxes, usd: housingTaxesUsd, setUsd: setHousingTaxesUsd, label: "wizardHousingTaxes" },
            ].map(({ key, checked, set, usd, setUsd, label }) => (
              <label key={key} className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                <span>{t(`onboarding.${label}`)}</span>
                {checked && (
                  <>
                    <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 64, height: 36, fontSize: 11 }}>
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 130 }} />
                    {getItemCurrency(key) === "UYU" && (
                      <span className="row" style={{ alignItems: "center", gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                        <input type="number" step="0.001" className="input" value={getItemRate(key)} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
                      </span>
                    )}
                  </>
                )}
              </label>
            ))}
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
              { key: "transport.vehicle", checked: transportVehicle, set: setTransportVehicle, usd: transportVehicleUsd, setUsd: setTransportVehicleUsd, labelKey: "wizardTransportVehicle" },
              { key: "transport.public", checked: transportPublic, set: setTransportPublic, usd: transportPublicUsd, setUsd: setTransportPublicUsd, labelKey: "wizardTransportPublic" },
              { key: "transport.taxi", checked: transportTaxi, set: setTransportTaxi, usd: transportTaxiUsd, setUsd: setTransportTaxiUsd, labelKey: "wizardTransportTaxi" },
            ].map(({ key, checked, set, usd, setUsd, labelKey }) => (
              <label key={key} className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                <span>{t(`onboarding.${labelKey}`)}</span>
                {checked && (
                  <>
                    <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 64, height: 36, fontSize: 11 }}>
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 130 }} />
                    {getItemCurrency(key) === "UYU" && (
                      <span className="row" style={{ alignItems: "center", gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                        <input type="number" step="0.001" className="input" value={getItemRate(key)} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
                      </span>
                    )}
                  </>
                )}
              </label>
            ))}
            {transportVehicle && (
              <div className="muted" style={{ fontSize: 12 }}>{t("onboarding.wizardTransportFuelNote", { category: t("categories.transport") })}</div>
            )}
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
            ].map(({ id, c, setC, label }) => {
              const key = `svc.${id}`;
              return (
                <label key={id} className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                  <span>{t(`onboarding.${label}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 64, height: 36, fontSize: 11 }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={svcUsd[id] ?? ""} onChange={(e) => setSvcUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 130 }} />
                      {getItemCurrency(key) === "UYU" && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={getItemRate(key)} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
                        </span>
                      )}
                    </>
                  )}
                </label>
              );
            })}
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
            ].map(({ id, c, setC, label }) => {
              const key = `health.${id}`;
              return (
                <label key={id} className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                  <span>{t(`onboarding.${label}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 64, height: 36, fontSize: 11 }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={healthUsd[id] ?? ""} onChange={(e) => setHealthUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 130 }} />
                      {getItemCurrency(key) === "UYU" && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={getItemRate(key)} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
                        </span>
                      )}
                    </>
                  )}
                </label>
              );
            })}
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
            ].map(({ id, c, set, key }) => {
              const itemKey = `rec.${id}`;
              return (
                <label key={key} className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => set(e.target.checked)} />
                  <span>{t(`onboarding.${key}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(itemKey)} onChange={(e) => setItemCurrency(itemKey, e.target.value as "UYU" | "USD")} style={{ width: 64, height: 36, fontSize: 11 }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={recUsd[id] ?? ""} onChange={(e) => setRecUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 130 }} />
                      {getItemCurrency(itemKey) === "UYU" && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={getItemRate(itemKey)} onChange={(e) => setItemRate(itemKey, Number(e.target.value))} style={{ width: 90 }} />
                        </span>
                      )}
                    </>
                  )}
                </label>
              );
            })}
          </div>
        </>
      )}

      {/* Step 6: Income */}
      {step === 6 && (
        <>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{t("onboarding.wizardIncomeTitle")}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{t("onboarding.wizardIncomeSub")}</div>
          <div style={{ display: "grid", gap: 14 }}>
            <label className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
              <input type="checkbox" checked={incomeWork} onChange={(e) => setIncomeWork(e.target.checked)} />
              <span style={{ flexShrink: 0 }}>{t("onboarding.wizardIncomeWork")}</span>
              {incomeWork && (
                <>
                  <select className="select" value={getItemCurrency("income.work")} onChange={(e) => setItemCurrency("income.work", e.target.value as "UYU" | "USD")} style={{ width: 56, height: 36, fontSize: 11 }}>
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    className="input onboarding-amount-input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={incomeWorkUsd}
                    onChange={(e) => setIncomeWorkUsd(e.target.value)}
                    style={{ width: 100, minWidth: 80 }}
                  />
                  {getItemCurrency("income.work") === "UYU" && (
                    <span className="row" style={{ alignItems: "center", gap: 4 }}>
                      <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                      <input type="number" step="0.001" className="input" value={getItemRate("income.work")} onChange={(e) => setItemRate("income.work", Number(e.target.value))} style={{ width: 72, height: 36, fontSize: 11 }} min={0} />
                    </span>
                  )}
                  <select className="select" value={incomeWorkType} onChange={(e) => setIncomeWorkType(e.target.value as "nominal" | "liquid")} style={{ width: 88, height: 36, fontSize: 11, textAlign: "center" }}>
                    <option value="nominal">{t("onboarding.wizardIncomeWorkTypeNominal")}</option>
                    <option value="liquid">{t("onboarding.wizardIncomeWorkTypeLiquid")}</option>
                  </select>
                  {incomeWorkType === "nominal" && (
                    <span className="row" style={{ alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardIncomeWorkTaxes")}</span>
                      <input type="number" className="input onboarding-amount-input" placeholder="0" value={incomeWorkTaxes} onChange={(e) => setIncomeWorkTaxes(e.target.value)} style={{ width: 80, fontSize: 11 }} min={0} />
                    </span>
                  )}
                </>
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 8, cursor: "pointer", flexWrap: "wrap" }}>
              <input type="checkbox" checked={incomeSavings} onChange={(e) => setIncomeSavings(e.target.checked)} />
              <span>{t("onboarding.wizardIncomeSavings")}</span>
              {incomeSavings && (
                <>
                  <select className="select" value={getItemCurrency("income.savings")} onChange={(e) => setItemCurrency("income.savings", e.target.value as "UYU" | "USD")} style={{ width: 56, height: 36, fontSize: 11 }}>
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    className="input onboarding-amount-input"
                    placeholder={t("onboarding.wizardIncomeSavingsPlaceholder")}
                    value={incomeSavingsUsd}
                    onChange={(e) => setIncomeSavingsUsd(e.target.value)}
                    style={{ width: 120, fontSize: 11 }}
                  />
                  {getItemCurrency("income.savings") === "UYU" && (
                    <span className="row" style={{ alignItems: "center", gap: 4 }}>
                      <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                      <input type="number" step="0.001" className="input" value={getItemRate("income.savings")} onChange={(e) => setItemRate("income.savings", Number(e.target.value))} style={{ width: 72, height: 36, fontSize: 11 }} min={0} />
                    </span>
                  )}
                </>
              )}
            </label>
            <label className="row" style={{ alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={incomeInvestments} onChange={(e) => setIncomeInvestments(e.target.checked)} />
              <span>{t("onboarding.wizardIncomeInvestments")}</span>
            </label>
            {incomeInvestments && (
              <div style={{ paddingLeft: 28, display: "grid", gap: 10 }}>
                {investmentsList.map((inv, idx) => (
                  <div key={idx} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto 120px auto", alignItems: "center" }} className="wizard-investment-row">
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
                    <select
                      className="select"
                      value={inv.currencyId}
                      onChange={(e) =>
                        setInvestmentsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], currencyId: e.target.value as "UYU" | "USD" };
                          return next;
                        })
                      }
                      style={{ width: 56, height: 36, fontSize: 11 }}
                      title={t("onboarding.wizardCurrencyLabel")}
                    >
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      className="input"
                      placeholder={inv.currencyId === "UYU" ? t("onboarding.wizardIncomeInvestAmountUyu") : t("onboarding.wizardIncomeInvestAmount")}
                      value={inv.amountUsd}
                      onChange={(e) =>
                        setInvestmentsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], amountUsd: e.target.value };
                          return next;
                        })
                      }
                      style={{ width: "100%", minWidth: 0 }}
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
                  onClick={() => setInvestmentsList((prev) => [...prev, { name: "", returnPct: "0", amountUsd: "", currencyId: "USD" }])}
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
      <div className="row" style={{ marginTop: 24, gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
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
          <button type="button" className="btn primary" onClick={saveHousing} disabled={loading}>
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
