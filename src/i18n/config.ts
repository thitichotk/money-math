import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en/translation.json';
import th from './locales/th/translation.json';

// A saved choice wins; otherwise the browser's language, so Thai browsers start in Thai.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, th: { translation: th } },
    fallbackLng: 'en',
    supportedLngs: ['th', 'en'],
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'bfc:language' },
  });

const syncLang = (lng: string) => document.documentElement.setAttribute('lang', lng.startsWith('th') ? 'th' : 'en');
syncLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', syncLang);

export default i18n;
