import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

const STORAGE_KEY = "ground:lang";

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && navigator.language && navigator.language.startsWith("es")) return "es";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

function applyLanguage(lng: string) {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = lng;
  }
}

i18n.on("languageChanged", applyLanguage);
// Aplicar lang al cargar (p. ej. para que input type="month" muestre los meses en el idioma correcto)
applyLanguage(i18n.language);

export default i18n;
export { STORAGE_KEY };
