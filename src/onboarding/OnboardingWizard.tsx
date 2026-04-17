// New onboarding: welcome + questions to build template, then tour.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useEncryption } from "../context/EncryptionContext";
import { useAppShell } from "../layout/AppShell";
import { getFxDefault } from "../utils/fx";

type ExpenseType = "FIXED" | "VARIABLE";
type Category = { id: string; name: string; expenseType: ExpenseType };
type CurrencyId = "UYU" | "USD";
type SavingsAccountDraft = {
  sourceKey: string;
  investmentId?: string | null;
  name: string;
  capital: string;
  currencyId: CurrencyId;
};
type InvestmentDraft = {
  sourceKey: string;
  investmentId?: string | null;
  name: string;
  returnPct: string;
  amountUsd: string;
  currencyId: CurrencyId;
};
type OnboardingContextResponse = {
  year: number;
  month: number;
  incomeWork: {
    amountUsd?: number | null;
    nominalUsd?: number | null;
    taxesUsd?: number | null;
    currencyId?: string | null;
    encryptedPayload?: string | null;
  } | null;
  savingsAccounts: Array<{
    sourceKey: string;
    investmentId?: string | null;
    name: string;
    capital: number;
    capitalUsd?: number | null;
    currencyId: string;
    encryptedPayload?: string | null;
    snapshotYear?: number | null;
    snapshotMonth?: number | null;
  }>;
  investments: Array<{
    sourceKey: string;
    investmentId?: string | null;
    name: string;
    capital: number;
    capitalUsd?: number | null;
    currencyId: string;
    encryptedPayload?: string | null;
    snapshotYear?: number | null;
    snapshotMonth?: number | null;
    targetAnnualReturn: number;
  }>;
  templates: Array<{
    id: string;
    description: string;
    categoryId: string;
    defaultAmountUsd?: number | null;
    defaultCurrencyId?: string | null;
    encryptedPayload?: string | null;
    expenseType: ExpenseType;
    showInExpenses?: boolean;
    onboardingSourceKey?: string | null;
  }>;
};

const WIZARD_TOTAL_STEPS = 8; // 0: welcome, 1: housing, 2: transport, 3: services, 4: health, 5: recurrent, 6: income, 7: done
const WIZARD_TEMPLATE_DESCRIPTIONS = new Set([
  "Rent",
  "Mortgage",
  "Building Fees",
  "Property Taxes",
  "Fuel",
  "Public Transport",
  "Ride Sharing / Taxis",
  "Electricity",
  "Water",
  "Gas",
  "Internet / Fiber",
  "Mobile Phone",
  "TV / Cable",
  "Streaming Services",
  "Other online (Spotify, etc.)",
  "Private Health Insurance",
  "Gym Membership",
  "Pharmacy",
  "Personal Care",
  "Psychologist",
  "Groceries",
  "Holiday Gifts",
  "Donations / Raffles",
  "Tenis, Surf, Football / Others",
  "Restaurants",
  "Coffee & Snacks",
  "Delivery",
  "Events & Concerts",
]);

function findCategory(cats: Category[], name: string, type: ExpenseType): Category | undefined {
  return cats.find((c) => c.name === name && c.expenseType === type);
}

function createSavingsAccountDraft(sourceKey: string, seed?: Partial<SavingsAccountDraft>): SavingsAccountDraft {
  return {
    sourceKey,
    investmentId: seed?.investmentId ?? null,
    name: seed?.name ?? "",
    capital: seed?.capital ?? "",
    currencyId: seed?.currencyId ?? "USD",
  };
}

function createInvestmentDraft(sourceKey: string, seed?: Partial<InvestmentDraft>): InvestmentDraft {
  return {
    sourceKey,
    investmentId: seed?.investmentId ?? null,
    name: seed?.name ?? "",
    returnPct: seed?.returnPct ?? "",
    amountUsd: seed?.amountUsd ?? "",
    currencyId: seed?.currencyId ?? "USD",
  };
}

function nextOnboardingSourceKey(prefix: string, keys: string[]) {
  const max = keys.reduce((acc, key) => {
    if (!key.startsWith(prefix)) return acc;
    const parsed = Number(key.slice(prefix.length));
    return Number.isInteger(parsed) && parsed > acc ? parsed : acc;
  }, -1);
  return `${prefix}${max + 1}`;
}

function formatOnboardingAmount(value: number | null | undefined, currencyId: CurrencyId, fx: number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  const raw = currencyId === "UYU" ? n * fx : n;
  if (currencyId === "UYU") return String(Math.round(raw));
  const rounded = Math.round(raw * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatEditableAmount(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function monthDiff(fromYear: number | null | undefined, fromMonth: number | null | undefined, toYear: number, toMonth: number) {
  if (!Number.isInteger(fromYear) || !Number.isInteger(fromMonth)) return 0;
  return Math.max(0, (toYear - Number(fromYear)) * 12 + (toMonth - Number(fromMonth)));
}

export function OnboardingWizard(props: {
  onGoToDashboard: () => void;
  onStartTour: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const { onGoToDashboard, onStartTour, onSkip } = props;
  const { updatePreferredDisplayCurrency, preferredDisplayCurrencyId } = useAppShell();
  const { decryptPayload, encryptPayload, hasEncryptionSupport } = useEncryption();

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
    return wizardItemCurrency[key] ?? wizardDisplayCurrency;
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
  const [savingsAccountsList, setSavingsAccountsList] = useState<SavingsAccountDraft[]>([
    createSavingsAccountDraft("onboarding:savings:0"),
  ]);
  const [incomeInvestments, setIncomeInvestments] = useState(false);
  const [investmentsList, setInvestmentsList] = useState<InvestmentDraft[]>([
    createInvestmentDraft("onboarding:investment:0"),
  ]);

  useEffect(() => {
    let active = true;

    async function loadInitialContext() {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const [cats, context] = await Promise.all([
          api<Category[]>("/categories"),
          api<OnboardingContextResponse>(`/auth/me/onboarding/context?year=${currentYear}&month=${currentMonth}`).catch(() => ({
            year: currentYear,
            month: currentMonth,
            incomeWork: null,
            savingsAccounts: [],
            investments: [],
            templates: [],
          })),
        ]);

        if (!active) return;
        setCategories(cats);

        const resolvedIncome = context.incomeWork?.encryptedPayload
          ? await decryptPayload<{
              amountUsd?: number | string | null;
              nominalUsd?: number | string | null;
              taxesUsd?: number | string | null;
              amount?: number | string | null;
              taxes?: number | string | null;
              currencyId?: string | null;
              incomeType?: "nominal" | "liquid" | string | null;
              usdUyuRate?: number | string | null;
            }>(
              context.incomeWork.encryptedPayload
            )
          : null;
        const incomeAmountUsd = Number(context.incomeWork?.amountUsd ?? resolvedIncome?.amountUsd ?? 0);
        const incomeNominalUsd = Number(context.incomeWork?.nominalUsd ?? resolvedIncome?.nominalUsd ?? 0);
        const incomeTaxesUsd = Number(context.incomeWork?.taxesUsd ?? resolvedIncome?.taxesUsd ?? 0);
        const incomeCurrency: CurrencyId =
          resolvedIncome?.currencyId === "UYU"
            ? "UYU"
            : context.incomeWork?.currencyId === "UYU"
              ? "UYU"
              : "USD";
        const incomeRate = Number(resolvedIncome?.usdUyuRate ?? getFxDefault());
        const hasRichIncomePayload =
          resolvedIncome != null &&
          (resolvedIncome.amount != null ||
            resolvedIncome.taxes != null ||
            resolvedIncome.currencyId != null ||
            resolvedIncome.incomeType != null ||
            resolvedIncome.usdUyuRate != null);
        if ((Number.isFinite(incomeAmountUsd) && incomeAmountUsd > 0) || (Number.isFinite(incomeNominalUsd) && incomeNominalUsd > 0)) {
          setIncomeWork(true);
          setItemCurrency("income.work", incomeCurrency);
          if (incomeCurrency === "UYU" && Number.isFinite(incomeRate) && incomeRate > 0) {
            setItemRate("income.work", incomeRate);
          }
          const savedIncomeType =
            resolvedIncome?.incomeType === "nominal" || resolvedIncome?.incomeType === "liquid"
              ? resolvedIncome.incomeType
              : Number.isFinite(incomeTaxesUsd) && incomeTaxesUsd > 0
                ? "nominal"
                : "liquid";
          if (savedIncomeType === "nominal") {
            setIncomeWorkType("nominal");
            setIncomeWorkUsd(
              hasRichIncomePayload && resolvedIncome?.amount != null
                ? formatEditableAmount(Number(resolvedIncome.amount))
                : formatOnboardingAmount(incomeNominalUsd, incomeCurrency, incomeRate)
            );
            setIncomeWorkTaxes(
              hasRichIncomePayload && resolvedIncome?.taxes != null
                ? formatEditableAmount(Number(resolvedIncome.taxes))
                : formatOnboardingAmount(incomeTaxesUsd, incomeCurrency, incomeRate)
            );
          } else {
            setIncomeWorkType("liquid");
            setIncomeWorkUsd(
              hasRichIncomePayload && resolvedIncome?.amount != null
                ? formatEditableAmount(Number(resolvedIncome.amount))
                : formatOnboardingAmount(incomeAmountUsd, incomeCurrency, incomeRate)
            );
            setIncomeWorkTaxes("");
          }
        }

        if (context.savingsAccounts.length > 0) {
          setIncomeSavings(true);
          const resolvedSavingsAccounts = await Promise.all(
            context.savingsAccounts.map(async (row, idx) => {
              const currencyId: CurrencyId = row.currencyId === "UYU" ? "UYU" : "USD";
              const decrypted = row.encryptedPayload
                ? await decryptPayload<{ closingCapital?: number | string | null; closingCapitalUsd?: number | string | null }>(row.encryptedPayload)
                : null;
              const capital = Number(
                decrypted?.closingCapital ??
                  row.capital ??
                  (currencyId === "USD" ? row.capitalUsd ?? 0 : 0)
              );
              return createSavingsAccountDraft(row.sourceKey || `onboarding:savings:${idx}`, {
                investmentId: row.investmentId ?? null,
                name: row.name ?? "",
                capital: formatEditableAmount(capital),
                currencyId,
              });
            })
          );
          setSavingsAccountsList(resolvedSavingsAccounts);
        }

        const resolvedTemplates = await Promise.all(
          (context.templates ?? []).map(async (row) => {
            const decrypted = row.encryptedPayload
              ? await decryptPayload<{ description?: string; defaultAmountUsd?: number | string | null }>(row.encryptedPayload)
              : null;
            const description = String(decrypted?.description ?? row.description ?? "").trim();
            const amountUsd = Number(decrypted?.defaultAmountUsd ?? row.defaultAmountUsd ?? 0);
            const defaultCurrencyId: CurrencyId = row.defaultCurrencyId === "UYU" ? "UYU" : "USD";
            return {
              ...row,
              description,
              defaultAmountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
              defaultCurrencyId,
            };
          })
        );

        for (const row of resolvedTemplates) {
          if (row.showInExpenses === false) continue;
          const amount = formatOnboardingAmount(row.defaultAmountUsd, row.defaultCurrencyId, getFxDefault());
          const key = row.onboardingSourceKey || row.description;
          switch (key) {
            case "onboarding:template:housing.rent":
            case "Rent":
              setHousingRent(true);
              setItemCurrency("housing.rent", row.defaultCurrencyId);
              setHousingRentUsd(amount);
              break;
            case "onboarding:template:housing.mortgage":
            case "Mortgage":
              setHousingMortgage(true);
              setItemCurrency("housing.mortgage", row.defaultCurrencyId);
              setHousingMortgageUsd(amount);
              break;
            case "onboarding:template:housing.fees":
            case "Building Fees":
              setHousingFees(true);
              setItemCurrency("housing.fees", row.defaultCurrencyId);
              setHousingFeesUsd(amount);
              break;
            case "onboarding:template:housing.taxes":
            case "Property Taxes":
              setHousingTaxes(true);
              setItemCurrency("housing.taxes", row.defaultCurrencyId);
              setHousingTaxesUsd(amount);
              break;
            case "onboarding:template:transport.fuel":
            case "Fuel":
              setTransportVehicle(true);
              setItemCurrency("transport.vehicle", row.defaultCurrencyId);
              setTransportVehicleUsd(amount);
              break;
            case "onboarding:template:transport.public":
            case "Public Transport":
              setTransportPublic(true);
              setItemCurrency("transport.public", row.defaultCurrencyId);
              setTransportPublicUsd(amount);
              break;
            case "onboarding:template:transport.taxi":
            case "Ride Sharing / Taxis":
              setTransportTaxi(true);
              setItemCurrency("transport.taxi", row.defaultCurrencyId);
              setTransportTaxiUsd(amount);
              break;
            case "onboarding:template:services.electricity":
            case "Electricity":
              setSvcElectricity(true);
              setItemCurrency("svc.electricity", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, electricity: amount }));
              break;
            case "onboarding:template:services.water":
            case "Water":
              setSvcWater(true);
              setItemCurrency("svc.water", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, water: amount }));
              break;
            case "onboarding:template:services.gas":
            case "Gas":
              setSvcGas(true);
              setItemCurrency("svc.gas", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, gas: amount }));
              break;
            case "onboarding:template:services.internet":
            case "Internet / Fiber":
              setSvcInternet(true);
              setItemCurrency("svc.internet", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, internet: amount }));
              break;
            case "onboarding:template:services.mobile":
            case "Mobile Phone":
              setSvcMobile(true);
              setItemCurrency("svc.mobile", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, mobile: amount }));
              break;
            case "onboarding:template:services.tv":
            case "TV / Cable":
              setSvcTV(true);
              setItemCurrency("svc.tv", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, tv: amount }));
              break;
            case "onboarding:template:services.streaming":
            case "Streaming Services":
              setSvcStreaming(true);
              setItemCurrency("svc.streaming", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, streaming: amount }));
              break;
            case "onboarding:template:services.other-online":
            case "Other online (Spotify, etc.)":
              setSvcOtherOnline(true);
              setItemCurrency("svc.otherOnline", row.defaultCurrencyId);
              setSvcUsd((prev) => ({ ...prev, otherOnline: amount }));
              break;
            case "onboarding:template:health.insurance":
            case "Private Health Insurance":
              setHealthInsurance(true);
              setItemCurrency("health.insurance", row.defaultCurrencyId);
              setHealthUsd((prev) => ({ ...prev, insurance: amount }));
              break;
            case "onboarding:template:health.gym":
            case "Gym Membership":
              setHealthGym(true);
              setItemCurrency("health.gym", row.defaultCurrencyId);
              setHealthUsd((prev) => ({ ...prev, gym: amount }));
              break;
            case "onboarding:template:health.pharmacy":
            case "Pharmacy":
              setHealthPharmacy(true);
              setItemCurrency("health.pharmacy", row.defaultCurrencyId);
              setHealthUsd((prev) => ({ ...prev, pharmacy: amount }));
              break;
            case "onboarding:template:health.personal":
            case "Personal Care":
              setHealthPersonal(true);
              setItemCurrency("health.personal", row.defaultCurrencyId);
              setHealthUsd((prev) => ({ ...prev, personal: amount }));
              break;
            case "onboarding:template:health.dental":
            case "Psychologist":
              setHealthDental(true);
              setItemCurrency("health.dental", row.defaultCurrencyId);
              setHealthUsd((prev) => ({ ...prev, dental: amount }));
              break;
            case "onboarding:template:recurrent.groceries":
            case "Groceries":
              setRecGroceries(true);
              setItemCurrency("rec.groceries", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, groceries: amount }));
              break;
            case "onboarding:template:recurrent.gifts":
            case "Holiday Gifts":
              setRecGifts(true);
              setItemCurrency("rec.gifts", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, gifts: amount }));
              break;
            case "onboarding:template:recurrent.donations":
            case "Donations / Raffles":
              setRecDonations(true);
              setItemCurrency("rec.donations", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, donations: amount }));
              break;
            case "onboarding:template:recurrent.sports":
            case "Tenis, Surf, Football / Others":
              setRecSports(true);
              setItemCurrency("rec.sports", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, sports: amount }));
              break;
            case "onboarding:template:recurrent.restaurants":
            case "Restaurants":
              setRecRestaurants(true);
              setItemCurrency("rec.restaurants", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, restaurants: amount }));
              break;
            case "onboarding:template:recurrent.cafes":
            case "Coffee & Snacks":
              setRecCafes(true);
              setItemCurrency("rec.cafes", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, cafes: amount }));
              break;
            case "onboarding:template:recurrent.delivery":
            case "Delivery":
              setRecDelivery(true);
              setItemCurrency("rec.delivery", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, delivery: amount }));
              break;
            case "onboarding:template:recurrent.events":
            case "Events & Concerts":
              setRecEvents(true);
              setItemCurrency("rec.events", row.defaultCurrencyId);
              setRecUsd((prev) => ({ ...prev, events: amount }));
              break;
            default:
              break;
          }
        }

        if (context.investments.length > 0) {
          setIncomeInvestments(true);
          const resolvedInvestments = await Promise.all(
            context.investments.map(async (row, idx) => {
              const currencyId: CurrencyId = row.currencyId === "UYU" ? "UYU" : "USD";
              const decrypted = row.encryptedPayload
                ? await decryptPayload<{ closingCapital?: number | string | null; closingCapitalUsd?: number | string | null }>(row.encryptedPayload)
                : null;
              const capital = Number(
                decrypted?.closingCapital ??
                  row.capital ??
                  (currencyId === "USD" ? row.capitalUsd ?? 0 : 0)
              );
              const projectedCapital =
                monthDiff(row.snapshotYear, row.snapshotMonth, context.year, context.month) > 0 && Number(row.targetAnnualReturn ?? 0) > 0
                  ? capital *
                    Math.pow(
                      1 + Number(row.targetAnnualReturn ?? 0) / 12,
                      monthDiff(row.snapshotYear, row.snapshotMonth, context.year, context.month)
                    )
                  : capital;
              return createInvestmentDraft(row.sourceKey || `onboarding:investment:${idx}`, {
                investmentId: row.investmentId ?? null,
                name: row.name ?? "",
                amountUsd: formatEditableAmount(projectedCapital),
                currencyId,
                returnPct: Number(row.targetAnnualReturn ?? 0) > 0 ? String(Math.round(Number(row.targetAnnualReturn) * 10000) / 100) : "",
              });
            })
          );
          setInvestmentsList(resolvedInvestments);
        }
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Failed to load categories");
      }
    }

    loadInitialContext();
    return () => {
      active = false;
    };
  }, [decryptPayload, hasEncryptionSupport, preferredDisplayCurrencyId]);

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

  async function getCategoryId(name: string, expenseType: ExpenseType): Promise<string> {
    return findCategory(categories, name, expenseType)?.id ?? ensureCategory(name, expenseType);
  }

  function toUsdAmount(amountStr: string, currencyId: "UYU" | "USD", usdUyuRate: number): number | null {
    const n = parseUsd(amountStr);
    if (n == null) return null;
    if (currencyId === "USD") return n;
    if (!Number.isFinite(usdUyuRate) || usdUyuRate <= 0) return null;
    return n / usdUyuRate;
  }

  async function upsertTemplatesBatch(
    templates: Array<{
      onboardingSourceKey: string;
      categoryId: string;
      description: string;
      amountUsd: number | null;
      defaultCurrencyId: "UYU" | "USD";
    }>
  ): Promise<Array<{ id: string; categoryId: string; description: string; showInExpenses?: boolean; onboardingSourceKey?: string | null }>> {
    if (templates.length === 0) return [];
    const startMonth = new Date().getMonth() + 1;
    const { rows } = await api<{ rows: Array<{ id: string; categoryId: string; description: string; showInExpenses?: boolean }> }>("/admin/expenseTemplates/batch", {
      method: "POST",
      body: JSON.stringify({
        startMonth,
        templates: templates.map((template) => ({
          onboardingSourceKey: template.onboardingSourceKey,
          categoryId: template.categoryId,
          description: template.description,
          defaultAmountUsd: template.amountUsd,
          defaultCurrencyId: template.defaultCurrencyId,
          showInExpenses: true,
        })),
      }),
    });
    for (const row of rows ?? []) {
      if (!selectedTemplateIdsRef.current.includes(row.id)) selectedTemplateIdsRef.current.push(row.id);
    }
    return rows ?? [];
  }

  async function saveHousing() {
    setError("");
    setLoading(true);
    selectedTemplateIdsRef.current = [];
    try {
      const housingId = await getCategoryId("Housing", "FIXED");
      const templates: Array<{ onboardingSourceKey: string; categoryId: string; description: string; amountUsd: number | null; defaultCurrencyId: "UYU" | "USD" }> = [];
      if (housingRent) {
        const cur = getItemCurrency("housing.rent");
        templates.push({ onboardingSourceKey: "onboarding:template:housing.rent", categoryId: housingId, description: "Rent", amountUsd: toUsdAmount(housingRentUsd, cur, getItemRate("housing.rent")), defaultCurrencyId: cur });
      }
      if (housingMortgage) {
        const cur = getItemCurrency("housing.mortgage");
        templates.push({ onboardingSourceKey: "onboarding:template:housing.mortgage", categoryId: housingId, description: "Mortgage", amountUsd: toUsdAmount(housingMortgageUsd, cur, getItemRate("housing.mortgage")), defaultCurrencyId: cur });
      }
      if (housingFees) {
        const cur = getItemCurrency("housing.fees");
        templates.push({ onboardingSourceKey: "onboarding:template:housing.fees", categoryId: housingId, description: "Building Fees", amountUsd: toUsdAmount(housingFeesUsd, cur, getItemRate("housing.fees")), defaultCurrencyId: cur });
      }
      if (housingTaxes) {
        const cur = getItemCurrency("housing.taxes");
        templates.push({ onboardingSourceKey: "onboarding:template:housing.taxes", categoryId: housingId, description: "Property Taxes", amountUsd: toUsdAmount(housingTaxesUsd, cur, getItemRate("housing.taxes")), defaultCurrencyId: cur });
      }
      await upsertTemplatesBatch(templates);
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
      const transportId = await getCategoryId("Transport", "VARIABLE");
      const templates: Array<{ onboardingSourceKey: string; categoryId: string; description: string; amountUsd: number | null; defaultCurrencyId: "UYU" | "USD" }> = [];
      if (transportVehicle) {
        const cur = getItemCurrency("transport.vehicle");
        templates.push({ onboardingSourceKey: "onboarding:template:transport.fuel", categoryId: transportId, description: "Fuel", amountUsd: toUsdAmount(transportVehicleUsd, cur, getItemRate("transport.vehicle")), defaultCurrencyId: cur });
      }
      if (transportPublic) {
        const cur = getItemCurrency("transport.public");
        templates.push({ onboardingSourceKey: "onboarding:template:transport.public", categoryId: transportId, description: "Public Transport", amountUsd: toUsdAmount(transportPublicUsd, cur, getItemRate("transport.public")), defaultCurrencyId: cur });
      }
      if (transportTaxi) {
        const cur = getItemCurrency("transport.taxi");
        templates.push({ onboardingSourceKey: "onboarding:template:transport.taxi", categoryId: transportId, description: "Ride Sharing / Taxis", amountUsd: toUsdAmount(transportTaxiUsd, cur, getItemRate("transport.taxi")), defaultCurrencyId: cur });
      }
      await upsertTemplatesBatch(templates);
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
      const templates: Array<{ onboardingSourceKey: string; categoryId: string; description: string; amountUsd: number | null; defaultCurrencyId: "UYU" | "USD" }> = [];
      if (utilitiesCat) {
        if (svcElectricity) {
          const cur = getItemCurrency("svc.electricity");
          templates.push({ onboardingSourceKey: "onboarding:template:services.electricity", categoryId: utilitiesCat.id, description: "Electricity", amountUsd: toUsdAmount(svcUsd.electricity ?? "", cur, getItemRate("svc.electricity")), defaultCurrencyId: cur });
        }
        if (svcWater) {
          const cur = getItemCurrency("svc.water");
          templates.push({ onboardingSourceKey: "onboarding:template:services.water", categoryId: utilitiesCat.id, description: "Water", amountUsd: toUsdAmount(svcUsd.water ?? "", cur, getItemRate("svc.water")), defaultCurrencyId: cur });
        }
        if (svcGas) {
          const cur = getItemCurrency("svc.gas");
          templates.push({ onboardingSourceKey: "onboarding:template:services.gas", categoryId: utilitiesCat.id, description: "Gas", amountUsd: toUsdAmount(svcUsd.gas ?? "", cur, getItemRate("svc.gas")), defaultCurrencyId: cur });
        }
      }
      if (connectivityCat) {
        if (svcInternet) {
          const cur = getItemCurrency("svc.internet");
          templates.push({ onboardingSourceKey: "onboarding:template:services.internet", categoryId: connectivityCat.id, description: "Internet / Fiber", amountUsd: toUsdAmount(svcUsd.internet ?? "", cur, getItemRate("svc.internet")), defaultCurrencyId: cur });
        }
        if (svcMobile) {
          const cur = getItemCurrency("svc.mobile");
          templates.push({ onboardingSourceKey: "onboarding:template:services.mobile", categoryId: connectivityCat.id, description: "Mobile Phone", amountUsd: toUsdAmount(svcUsd.mobile ?? "", cur, getItemRate("svc.mobile")), defaultCurrencyId: cur });
        }
        if (svcTV) {
          const cur = getItemCurrency("svc.tv");
          templates.push({ onboardingSourceKey: "onboarding:template:services.tv", categoryId: connectivityCat.id, description: "TV / Cable", amountUsd: toUsdAmount(svcUsd.tv ?? "", cur, getItemRate("svc.tv")), defaultCurrencyId: cur });
        }
        if (svcStreaming) {
          const cur = getItemCurrency("svc.streaming");
          templates.push({ onboardingSourceKey: "onboarding:template:services.streaming", categoryId: connectivityCat.id, description: "Streaming Services", amountUsd: toUsdAmount(svcUsd.streaming ?? "", cur, getItemRate("svc.streaming")), defaultCurrencyId: cur });
        }
        if (svcOtherOnline) {
          const cur = getItemCurrency("svc.otherOnline");
          templates.push({ onboardingSourceKey: "onboarding:template:services.other-online", categoryId: connectivityCat.id, description: "Other online (Spotify, etc.)", amountUsd: toUsdAmount(svcUsd.otherOnline ?? "", cur, getItemRate("svc.otherOnline")), defaultCurrencyId: cur });
        }
      }
      await upsertTemplatesBatch(templates);
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
      const templates: Array<{ onboardingSourceKey: string; categoryId: string; description: string; amountUsd: number | null; defaultCurrencyId: "UYU" | "USD" }> = [];
      if (healthCat) {
        if (healthInsurance) {
          const cur = getItemCurrency("health.insurance");
          templates.push({ onboardingSourceKey: "onboarding:template:health.insurance", categoryId: healthCat.id, description: "Private Health Insurance", amountUsd: toUsdAmount(healthUsd.insurance ?? "", cur, getItemRate("health.insurance")), defaultCurrencyId: cur });
        }
        if (healthGym) {
          const cur = getItemCurrency("health.gym");
          templates.push({ onboardingSourceKey: "onboarding:template:health.gym", categoryId: healthCat.id, description: "Gym Membership", amountUsd: toUsdAmount(healthUsd.gym ?? "", cur, getItemRate("health.gym")), defaultCurrencyId: cur });
        }
      }
      if (wellnessCat) {
        if (healthPharmacy) {
          const cur = getItemCurrency("health.pharmacy");
          templates.push({ onboardingSourceKey: "onboarding:template:health.pharmacy", categoryId: wellnessCat.id, description: "Pharmacy", amountUsd: toUsdAmount(healthUsd.pharmacy ?? "", cur, getItemRate("health.pharmacy")), defaultCurrencyId: cur });
        }
        if (healthPersonal) {
          const cur = getItemCurrency("health.personal");
          templates.push({ onboardingSourceKey: "onboarding:template:health.personal", categoryId: wellnessCat.id, description: "Personal Care", amountUsd: toUsdAmount(healthUsd.personal ?? "", cur, getItemRate("health.personal")), defaultCurrencyId: cur });
        }
        if (healthDental) {
          const cur = getItemCurrency("health.dental");
          templates.push({ onboardingSourceKey: "onboarding:template:health.dental", categoryId: wellnessCat.id, description: "Psychologist", amountUsd: toUsdAmount(healthUsd.dental ?? "", cur, getItemRate("health.dental")), defaultCurrencyId: cur });
        }
      }
      await upsertTemplatesBatch(templates);
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
      const recurrentSelections: Array<{ onboardingSourceKey: string; categoryId: string; description: string; amountUsd: number | null; defaultCurrencyId: "UYU" | "USD" }> = [];
      if (has(recGroceries, "groceries") && foodCat) {
        const cur = getItemCurrency("rec.groceries");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.groceries", categoryId: foodCat.id, description: "Groceries", amountUsd: toUsdAmount(recUsd.groceries ?? "", cur, getItemRate("rec.groceries")), defaultCurrencyId: cur });
      }
      if (has(recGifts, "gifts") && giftsCat) {
        const cur = getItemCurrency("rec.gifts");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.gifts", categoryId: giftsCat.id, description: "Holiday Gifts", amountUsd: toUsdAmount(recUsd.gifts ?? "", cur, getItemRate("rec.gifts")), defaultCurrencyId: cur });
      }
      if (has(recDonations, "donations") && giftsCat) {
        const cur = getItemCurrency("rec.donations");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.donations", categoryId: giftsCat.id, description: "Donations / Raffles", amountUsd: toUsdAmount(recUsd.donations ?? "", cur, getItemRate("rec.donations")), defaultCurrencyId: cur });
      }
      if (has(recSports, "sports") && sportsCat) {
        const cur = getItemCurrency("rec.sports");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.sports", categoryId: sportsCat.id, description: "Tenis, Surf, Football / Others", amountUsd: toUsdAmount(recUsd.sports ?? "", cur, getItemRate("rec.sports")), defaultCurrencyId: cur });
      }
      if (has(recRestaurants, "restaurants") && diningCat) {
        const cur = getItemCurrency("rec.restaurants");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.restaurants", categoryId: diningCat.id, description: "Restaurants", amountUsd: toUsdAmount(recUsd.restaurants ?? "", cur, getItemRate("rec.restaurants")), defaultCurrencyId: cur });
      }
      if (has(recCafes, "cafes") && diningCat) {
        const cur = getItemCurrency("rec.cafes");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.cafes", categoryId: diningCat.id, description: "Coffee & Snacks", amountUsd: toUsdAmount(recUsd.cafes ?? "", cur, getItemRate("rec.cafes")), defaultCurrencyId: cur });
      }
      if (has(recDelivery, "delivery") && diningCat) {
        const cur = getItemCurrency("rec.delivery");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.delivery", categoryId: diningCat.id, description: "Delivery", amountUsd: toUsdAmount(recUsd.delivery ?? "", cur, getItemRate("rec.delivery")), defaultCurrencyId: cur });
      }
      if (has(recEvents, "events") && diningCat) {
        const cur = getItemCurrency("rec.events");
        recurrentSelections.push({ onboardingSourceKey: "onboarding:template:recurrent.events", categoryId: diningCat.id, description: "Events & Concerts", amountUsd: toUsdAmount(recUsd.events ?? "", cur, getItemRate("rec.events")), defaultCurrencyId: cur });
      }
      const recurrentResults = await upsertTemplatesBatch(recurrentSelections);
      for (const template of recurrentResults) if (template?.id) recurrentVisibleIds.push(template.id);
      // Visibility: only templates selected in THIS step (recurrent). First time → only these; re-run → keep already visible + these
      const { rows } = await api<{ rows: Array<{ id: string; categoryId: string; description: string; showInExpenses?: boolean; onboardingSourceKey?: string | null }> }>("/admin/expenseTemplates");
      const allRows = Array.isArray(rows) ? rows : [];
      // Use ALL templates the user selected in the entire wizard (housing, transport, services, recurrent)
      const allSelectedIds = [...new Set([...selectedTemplateIdsRef.current, ...recurrentVisibleIds])];
      const visibleNonWizardIds = allRows
        .filter(
          (r) =>
            r.showInExpenses !== false &&
            !String(r.onboardingSourceKey ?? "").startsWith("onboarding:template:") &&
            !WIZARD_TEMPLATE_DESCRIPTIONS.has(r.description)
        )
        .map((r) => r.id);
      const visibleTemplateIds = [...new Set([...visibleNonWizardIds, ...allSelectedIds])];
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
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    try {
      const workCur = getItemCurrency("income.work");
      const workRate = getItemRate("income.work");
      const savingsCur = getItemCurrency("income.savings");
      const savingsRate = getItemRate("income.savings");
      const incomeWorkAmountUsd = toUsdAmount(incomeWorkUsd, workCur, workRate);
      const incomeWorkTaxesUsd =
        incomeWorkType === "nominal" ? (toUsdAmount(incomeWorkTaxes, workCur, workRate) ?? 0) : 0;
      const incomeWorkEncryptedPayload =
        incomeWork && incomeWorkAmountUsd != null
          ? await encryptPayload({
              amount: Number(incomeWorkUsd) || 0,
              taxes: incomeWorkType === "nominal" ? Number(incomeWorkTaxes) || 0 : 0,
              amountUsd: incomeWorkAmountUsd,
              nominalUsd: incomeWorkAmountUsd,
              taxesUsd: incomeWorkTaxesUsd,
              currencyId: workCur,
              incomeType: incomeWorkType,
              usdUyuRate: workCur === "UYU" ? workRate : undefined,
            })
          : null;
      await api("/auth/me/onboarding/finalize", {
        method: "POST",
        body: JSON.stringify({
          year,
          currentMonth,
          incomeWork: {
            enabled: incomeWork,
            type: incomeWorkType,
            amountUsd: incomeWorkAmountUsd,
            taxesUsd: incomeWorkTaxesUsd,
            currencyId: workCur,
            usdUyuRate: workCur === "UYU" ? workRate : undefined,
            encryptedPayload: incomeWorkEncryptedPayload,
          },
          savings: {
            enabled: incomeSavings,
            accountName: t("investments.defaultBankAccountName"),
            currencyId: savingsCur,
            capital: 0,
            usdUyuRate: savingsCur === "UYU" ? savingsRate : undefined,
          },
          savingsAccounts: incomeSavings
            ? savingsAccountsList
                .filter((account) => account.name.trim() || String(account.capital ?? "").trim())
                .map((account, idx) => ({
                  sourceKey: account.sourceKey || `onboarding:savings:${idx}`,
                  investmentId: account.investmentId ?? undefined,
                  name: account.name.trim() || `${t("investments.defaultBankAccountName")} ${idx + 1}`,
                  currencyId: account.currencyId,
                  capital: Number(account.capital) || 0,
                  usdUyuRate: account.currencyId === "UYU" ? savingsRate : undefined,
                }))
            : [],
          investments: investmentsList
            .filter((i) => i.name.trim())
            .map((inv, idx) => ({
              sourceKey: inv.sourceKey || `onboarding:investment:${idx}`,
              investmentId: inv.investmentId ?? undefined,
              name: inv.name.trim(),
              currencyId: inv.currencyId,
              capital: Number(inv.amountUsd) || 0,
              targetAnnualReturn: (Number(inv.returnPct) || 0) / 100,
              usdUyuRate: inv.currencyId === "UYU" ? getItemRate("income.savings") : undefined,
            })),
        }),
      });
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
    } else if (step === 7) onStartTour();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  const shouldShowSavingsFx =
    (incomeSavings && savingsAccountsList.some((account) => account.currencyId !== wizardDisplayCurrency)) ||
    (incomeInvestments && investmentsList.some((inv) => inv.currencyId !== wizardDisplayCurrency));

  return (
    <div className="card onboarding-wizard" style={{ padding: 20, maxWidth: 760, width: "100%" }}>
      <style>{`
        .onboarding-wizard .onboarding-amount-input::placeholder { font-size: 11px; }
        .onboarding-wizard .onboarding-amount-input { min-width: 165px; }
        .onboarding-wizard .onboarding-investment-text-input::placeholder { font-size: 11px; }
        .onboarding-wizard .onboarding-investment-text-input { font-size: 12px; }
        .onboarding-wizard .onboarding-option {
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .onboarding-wizard .onboarding-footer {
          margin-top: 24px;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }
        @media (max-width: 900px) {
          .onboarding-wizard {
            padding: 16px !important;
            max-width: 100% !important;
            border-radius: 18px !important;
          }
          .onboarding-wizard .onboarding-option {
            display: grid !important;
            grid-template-columns: 22px minmax(0, 1fr);
            align-items: start !important;
            gap: 10px !important;
          }
          .onboarding-wizard .onboarding-option > input[type="checkbox"] {
            margin-top: 2px;
          }
          .onboarding-wizard .onboarding-option > span,
          .onboarding-wizard .onboarding-option > .muted,
          .onboarding-wizard .onboarding-option > .row,
          .onboarding-wizard .onboarding-option > .input,
          .onboarding-wizard .onboarding-option > .select {
            grid-column: 2;
            min-width: 0;
          }
          .onboarding-wizard .onboarding-option > .row {
            display: grid !important;
            gap: 8px;
          }
          .onboarding-wizard .onboarding-option .input,
          .onboarding-wizard .onboarding-option .select,
          .onboarding-wizard .onboarding-amount-input {
            width: 100% !important;
            min-width: 0 !important;
          }
          .onboarding-wizard .onboarding-option .row span.muted {
            white-space: normal !important;
          }
          .onboarding-wizard .wizard-investment-row {
            grid-template-columns: 1fr !important;
          }
          .onboarding-wizard .onboarding-footer {
            display: grid !important;
          }
          .onboarding-wizard .onboarding-footer .btn {
            width: 100%;
            margin-left: 0 !important;
          }
        }
      `}</style>
      {error && <div style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</div>}

      {step < 7 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {t("onboarding.wizardProgress", { current: step + 1, total: WIZARD_TOTAL_STEPS })}
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${((step + 1) / WIZARD_TOTAL_STEPS) * 100}%`,
                background: "var(--brand-green)",
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Step 0: Welcome + display currency */}
      {step === 0 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 950, marginBottom: 8 }}>{t("onboarding.wizardWelcomeTitle")}</div>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 20 }}>
            {t("onboarding.wizardWelcomeSub")}
          </div>
          <div style={{ padding: "14px 16px", background: "rgba(15,23,42,0.04)", borderRadius: 10, marginBottom: 24, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{t("onboarding.wizardDisplayCurrencyQuestion")}</div>
            <select
              className="select"
              value={wizardDisplayCurrency}
              onChange={(e) => setWizardDisplayCurrency(e.target.value as "USD" | "UYU")}
              style={{ width: 88, height: 38, fontSize: 13 }}
              aria-label={t("admin.displayCurrency")}
            >
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t("onboarding.wizardDisplayCurrencyDesc")}</div>
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
              <label key={key} className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                <span style={{ minWidth: 0 }}>{t(`onboarding.${label}`)}</span>
                {checked && (
                  <>
                    <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px", flexShrink: 0 }}>
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 165, minWidth: 165, flexShrink: 0 }} />
                    {getItemCurrency(key) !== wizardDisplayCurrency && (
                      <span className="row" style={{ alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                        <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate(key)) ? getItemRate(key).toFixed(2) : ""} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
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
            {/* Auto/Moto con nota debajo */}
            <div>
              <label className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                <input type="checkbox" checked={transportVehicle} onChange={(e) => setTransportVehicle(e.target.checked)} />
                <span>{t("onboarding.wizardTransportVehicle")}</span>
                {transportVehicle && (
                  <>
                    <select className="select" value={getItemCurrency("transport.vehicle")} onChange={(e) => setItemCurrency("transport.vehicle", e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={transportVehicleUsd} onChange={(e) => setTransportVehicleUsd(e.target.value)} style={{ width: 165, minWidth: 165 }} />
                    {getItemCurrency("transport.vehicle") !== wizardDisplayCurrency && (
                      <span className="row" style={{ alignItems: "center", gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                        <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate("transport.vehicle")) ? getItemRate("transport.vehicle").toFixed(2) : ""} onChange={(e) => setItemRate("transport.vehicle", Number(e.target.value))} style={{ width: 90 }} />
                      </span>
                    )}
                  </>
                )}
              </label>
              <div className="muted" style={{ fontSize: 12, marginTop: 4, marginLeft: 28 }}>{t("onboarding.wizardTransportFuelNote", { category: t("categories.transport") })}</div>
            </div>
            {[
              { key: "transport.public", checked: transportPublic, set: setTransportPublic, usd: transportPublicUsd, setUsd: setTransportPublicUsd, labelKey: "wizardTransportPublic" },
              { key: "transport.taxi", checked: transportTaxi, set: setTransportTaxi, usd: transportTaxiUsd, setUsd: setTransportTaxiUsd, labelKey: "wizardTransportTaxi" },
            ].map(({ key, checked, set, usd, setUsd, labelKey }) => (
              <label key={key} className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} />
                <span>{t(`onboarding.${labelKey}`)}</span>
                {checked && (
                  <>
                    <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 165, minWidth: 165 }} />
                    {getItemCurrency(key) !== wizardDisplayCurrency && (
                      <span className="row" style={{ alignItems: "center", gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                        <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate(key)) ? getItemRate(key).toFixed(2) : ""} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
                      </span>
                    )}
                  </>
                )}
              </label>
            ))}
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
                <label key={id} className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                  <span>{t(`onboarding.${label}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={svcUsd[id] ?? ""} onChange={(e) => setSvcUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 165, minWidth: 165 }} />
                      {getItemCurrency(key) !== wizardDisplayCurrency && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate(key)) ? getItemRate(key).toFixed(2) : ""} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
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
                <label key={id} className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => setC(e.target.checked)} />
                  <span>{t(`onboarding.${label}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(key)} onChange={(e) => setItemCurrency(key, e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={healthUsd[id] ?? ""} onChange={(e) => setHealthUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 165, minWidth: 165 }} />
                      {getItemCurrency(key) !== wizardDisplayCurrency && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate(key)) ? getItemRate(key).toFixed(2) : ""} onChange={(e) => setItemRate(key, Number(e.target.value))} style={{ width: 90 }} />
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
                <label key={key} className="row onboarding-option" style={{ flexWrap: "wrap" }}>
                  <input type="checkbox" checked={c} onChange={(e) => set(e.target.checked)} />
                  <span>{t(`onboarding.${key}`)}</span>
                  {c && (
                    <>
                      <select className="select" value={getItemCurrency(itemKey)} onChange={(e) => setItemCurrency(itemKey, e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                        <option value="UYU">UYU</option>
                        <option value="USD">USD</option>
                      </select>
                      <input type="number" className="input onboarding-amount-input" placeholder={t("onboarding.wizardOptionalUsd")} value={recUsd[id] ?? ""} onChange={(e) => setRecUsd((prev) => ({ ...prev, [id]: e.target.value }))} style={{ width: 165, minWidth: 165 }} />
                      {getItemCurrency(itemKey) !== wizardDisplayCurrency && (
                        <span className="row" style={{ alignItems: "center", gap: 4 }}>
                          <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                          <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate(itemKey)) ? getItemRate(itemKey).toFixed(2) : ""} onChange={(e) => setItemRate(itemKey, Number(e.target.value))} style={{ width: 90 }} />
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
            <label className="row onboarding-option" style={{ flexWrap: "wrap" }}>
              <input type="checkbox" checked={incomeWork} onChange={(e) => setIncomeWork(e.target.checked)} />
              <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 400 }}>{t("onboarding.wizardIncomeWork")}</span>
              {incomeWork && (
                <>
                  <select className="select" value={getItemCurrency("income.work")} onChange={(e) => setItemCurrency("income.work", e.target.value as "UYU" | "USD")} style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}>
                    <option value="UYU">UYU</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    type="number"
                    className="input onboarding-amount-input"
                    placeholder={t("onboarding.wizardOptionalUsd")}
                    value={incomeWorkUsd}
                    onChange={(e) => setIncomeWorkUsd(e.target.value)}
                    style={{ width: 165, minWidth: 165 }}
                  />
                  {getItemCurrency("income.work") !== wizardDisplayCurrency && (
                    <span className="row" style={{ alignItems: "center", gap: 4 }}>
                      <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                      <input type="number" step="0.001" className="input" value={Number.isFinite(getItemRate("income.work")) ? getItemRate("income.work").toFixed(2) : ""} onChange={(e) => setItemRate("income.work", Number(e.target.value))} style={{ width: 72, height: 36, fontSize: 11 }} min={0} />
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
            <label className="row onboarding-option" style={{ flexWrap: "wrap" }}>
              <input type="checkbox" checked={incomeSavings} onChange={(e) => setIncomeSavings(e.target.checked)} />
              <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 400 }}>{t("onboarding.wizardIncomeSavings")}</span>
            </label>
            {incomeSavings && (
              <div style={{ paddingLeft: 28, display: "grid", gap: 10 }}>
                {savingsAccountsList.map((account, idx) => (
                  <div key={account.sourceKey} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto 165px auto", alignItems: "center" }} className="wizard-investment-row">
                    <input
                      type="text"
                      className="input onboarding-investment-text-input"
                      placeholder={t("onboarding.wizardIncomeSavingsAccountName")}
                      value={account.name}
                      onChange={(e) =>
                        setSavingsAccountsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return next;
                        })
                      }
                      style={{ minWidth: 0 }}
                    />
                    <select
                      className="select"
                      value={account.currencyId}
                      onChange={(e) =>
                        setSavingsAccountsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], currencyId: e.target.value as CurrencyId };
                          return next;
                        })
                      }
                      style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}
                      title={t("onboarding.wizardCurrencyLabel")}
                    >
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      className="input onboarding-amount-input"
                      placeholder={t("onboarding.wizardIncomeSavingsCapital")}
                      value={account.capital}
                      onChange={(e) =>
                        setSavingsAccountsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], capital: e.target.value };
                          return next;
                        })
                      }
                      style={{ width: "100%", minWidth: 0 }}
                      min={0}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={savingsAccountsList.length <= 1}
                      onClick={() =>
                        setSavingsAccountsList((prev) => {
                          if (prev.length <= 1) return [createSavingsAccountDraft(account.sourceKey)];
                          return prev.filter((row) => row.sourceKey !== account.sourceKey);
                        })
                      }
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setSavingsAccountsList((prev) => [
                      ...prev,
                      createSavingsAccountDraft(nextOnboardingSourceKey("onboarding:savings:", prev.map((row) => row.sourceKey))),
                    ])
                  }
                >
                  {t("onboarding.wizardAddSavingsAccount")}
                </button>
              </div>
            )}
            <label className="row onboarding-option" style={{ flexWrap: "wrap" }}>
              <input type="checkbox" checked={incomeInvestments} onChange={(e) => setIncomeInvestments(e.target.checked)} />
              <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 400 }}>{t("onboarding.wizardIncomeInvestments")}</span>
            </label>
            {incomeInvestments && (
              <div style={{ paddingLeft: 28, display: "grid", gap: 10 }}>
                {investmentsList.map((inv, idx) => (
                  <div key={inv.sourceKey} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr auto 165px auto", alignItems: "center" }} className="wizard-investment-row">
                    <input
                      type="text"
                      className="input onboarding-investment-text-input"
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
                      style={{ width: 72, minWidth: 72, height: 36, fontSize: 12, padding: "4px 6px" }}
                      title={t("onboarding.wizardCurrencyLabel")}
                    >
                      <option value="UYU">UYU</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      className="input onboarding-amount-input"
                      placeholder={t("onboarding.wizardIncomeInvestCapital")}
                      value={inv.amountUsd}
                      onChange={(e) =>
                        setInvestmentsList((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], amountUsd: e.target.value };
                          return next;
                        })
                      }
                      style={{ width: "100%", minWidth: 0, fontSize: 12 }}
                      min={0}
                    />
                    <div className="row" style={{ alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        className="input onboarding-amount-input"
                        placeholder={t("onboarding.wizardIncomeInvestExpectedReturn")}
                        value={inv.returnPct}
                        onChange={(e) =>
                          setInvestmentsList((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], returnPct: e.target.value };
                            return next;
                          })
                        }
                        style={{ width: 150, fontSize: 12 }}
                        title={t("onboarding.wizardIncomeInvestReturn")}
                      />
                      <span className="muted" style={{ fontSize: 12 }}>%</span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setInvestmentsList((prev) => [
                      ...prev,
                      createInvestmentDraft(nextOnboardingSourceKey("onboarding:investment:", prev.map((row) => row.sourceKey))),
                    ])
                  }
                >
                  {t("onboarding.wizardAddInvestment")}
                </button>
              </div>
            )}
            {shouldShowSavingsFx && (
              <div style={{ paddingLeft: 28 }}>
                <span className="row" style={{ alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{t("onboarding.wizardFxLabel")}</span>
                  <input
                    type="number"
                    step="0.001"
                    className="input"
                    value={Number.isFinite(getItemRate("income.savings")) ? getItemRate("income.savings").toFixed(2) : ""}
                    onChange={(e) => setItemRate("income.savings", Number(e.target.value))}
                    style={{ width: 72, height: 36, fontSize: 11 }}
                    min={0}
                  />
                </span>
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
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(15,23,42,0.04)",
              color: "rgba(15,23,42,0.76)",
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {t("onboarding.wizardDoneHelpNote")}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="row onboarding-footer">
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
          <>
            <button type="button" className="btn" onClick={onGoToDashboard}>
              {t("onboarding.wizardGoToDashboard")}
            </button>
            <button type="button" className="btn primary" onClick={onStartTour}>
              {t("onboarding.wizardStartTour")}
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={onSkip} style={{ marginLeft: "auto", display: step === 7 ? "none" : undefined }}>
          {t("onboarding.wizardSkip")}
        </button>
      </div>
    </div>
  );
}
