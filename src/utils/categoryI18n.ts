import type { TFunction } from "i18next";

// Fallback maps when API doesn't return nameKey/descriptionKey (e.g. before backfill).
// Same keys as backend defaultTemplates so we can translate by matching stored name/description.
const CATEGORY_KEY_BY_NAME_AND_TYPE: Record<string, string> = {
  "Housing|FIXED": "housing",
  "Domestic Staff|FIXED": "domestic_staff",
  "Connectivity|FIXED": "connectivity",
  "Utilities|FIXED": "utilities",
  "Health & Wellness|FIXED": "health_wellness",
  "Food & Grocery|VARIABLE": "food_grocery",
  "Transport|VARIABLE": "transport",
  "Dining & Leisure|VARIABLE": "dining_leisure",
  "Sports|VARIABLE": "sports",
  "Wellness|VARIABLE": "wellness",
  "Gifts & Social|VARIABLE": "gifts_social",
  "Other|VARIABLE": "other",
};

const DESCRIPTION_KEY_BY_DESC_AND_TYPE: Record<string, string> = {
  "Rent|FIXED": "rent",
  "Mortgage|FIXED": "mortgage",
  "Building Fees|FIXED": "building_fees",
  "Property Taxes|FIXED": "property_taxes",
  "Household Staff Salary|FIXED": "household_staff_salary",
  "Social Security|FIXED": "social_security",
  "Internet / Fiber|FIXED": "internet_fiber",
  "Mobile Phone|FIXED": "mobile_phone",
  "Cloud Storage|FIXED": "cloud_storage",
  "Streaming Services|FIXED": "streaming_services",
  "TV / Cable|FIXED": "tv_cable",
  "Other online (Spotify, etc.)|FIXED": "other_online",
  "Electricity|FIXED": "electricity",
  "Water|FIXED": "water",
  "Gas|FIXED": "gas",
  "Private Health Insurance|FIXED": "private_health_insurance",
  "Gym Membership|FIXED": "gym_membership",
  "Groceries|VARIABLE": "groceries",
  "Fuel|VARIABLE": "fuel",
  "Vehicle Taxes|VARIABLE": "vehicle_taxes",
  "Tolls|VARIABLE": "tolls",
  "Ride Sharing / Taxis|VARIABLE": "ride_sharing_taxis",
  "Public Transport|VARIABLE": "public_transport",
  "Restaurants|VARIABLE": "restaurants",
  "Coffee & Snacks|VARIABLE": "coffee_snacks",
  "Delivery|VARIABLE": "delivery",
  "Events & Concerts|VARIABLE": "events_concerts",
  "Tenis, Surf, Football / Others|VARIABLE": "sports_others",
  "Pharmacy|VARIABLE": "pharmacy",
  "Personal Care|VARIABLE": "personal_care",
  "Medical / Dental|VARIABLE": "medical_dental",
  "Psychologist|VARIABLE": "psychologist",
  "Holiday Gifts|VARIABLE": "holiday_gifts",
  "Donations / Raffles|VARIABLE": "donations_raffles",
  "Others|VARIABLE": "others",
};

export type CategoryForDisplay = {
  name: string;
  nameKey?: string | null;
  expenseType?: string;
};
export type TemplateForDisplay = {
  description: string;
  descriptionKey?: string | null;
  expenseType?: string;
};

function resolveCategoryKey(category: CategoryForDisplay): string | null {
  if (category.nameKey && typeof category.nameKey === "string") return category.nameKey;
  if (category.expenseType) {
    const fallback = CATEGORY_KEY_BY_NAME_AND_TYPE[`${category.name}|${category.expenseType}`];
    if (fallback) return fallback;
  }
  return null;
}

function resolveDescriptionKey(template: TemplateForDisplay): string | null {
  if (template.descriptionKey && typeof template.descriptionKey === "string")
    return template.descriptionKey;
  if (template.expenseType) {
    const fallback =
      DESCRIPTION_KEY_BY_DESC_AND_TYPE[`${template.description}|${template.expenseType}`];
    if (fallback) return fallback;
  }
  return null;
}

export function getCategoryDisplayName(category: CategoryForDisplay, t: TFunction): string {
  const key = resolveCategoryKey(category);
  if (key) {
    const fullKey = `categories.${key}`;
    const translated = t(fullKey);
    return translated !== fullKey ? translated : category.name;
  }
  return category.name;
}

export function getTemplateDescriptionDisplay(
  template: TemplateForDisplay,
  t: TFunction
): string {
  const key = resolveDescriptionKey(template);
  if (key) {
    const fullKey = `templateDescriptions.${key}`;
    const translated = t(fullKey);
    return translated !== fullKey ? translated : template.description;
  }
  return template.description;
}

export function getExpenseTypeLabel(expenseType: string, t: TFunction): string {
  if (expenseType === "FIXED") return t("expenses.typeFixed");
  if (expenseType === "VARIABLE") return t("expenses.typeVariable");
  return expenseType;
}
