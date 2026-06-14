import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en";
import it from "./it";

// English is the canonical default (docs, certificates and emails are
// English-only). The URL is the single source of truth for the language:
// English lives on the bare path (e.g. /create), Italian under a /it prefix
// (e.g. /it/create). We detect the language from the first path segment, so a
// bare URL (or any non-"it" prefix) resolves to the English fallback, and only
// an explicit /it opts into Italian. No browser/localStorage detection.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      it: { translation: it },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "it"],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      // Read the first path segment: "/it/..." → "it", anything else → en.
      order: ["path"],
      lookupFromPathIndex: 0,
    },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language?.startsWith("it") ? "it" : "en";

export default i18n;
