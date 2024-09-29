import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";

i18n.use(HttpApi) // Load translations via HTTP (use with i18next-http-backend)
    .use(LanguageDetector) // Detect user language
    .use(initReactI18next) // Pass the i18n instance to react-i18next.
    .init({
        lng: "en",
        fallbackLng: {
            "en-US": ["en"],
            "en-GB": ["en"],
            default: ["en"],
        },
        load: "languageOnly",
        debug: true, // Enable debug messages
        backend: {
            loadPath: "/locales/{{lng}}.json", // Translation files path
        },
        interpolation: {
            escapeValue: false, // React already escapes values
        },
    });

export default i18n;
