// Système multilingue pour BroolyKid
// Support de 8 langues : FR, EN, ES, DE, IT, PT, AR, ZH

export type Language = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar' | 'zh';

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

let currentLanguage: Language = 'fr';
let translations: Record<string, any> = {};

// Charger les traductions
export async function loadTranslations() {
  try {
    const response = await fetch('/translations.json');
    translations = await response.json();
    return translations;
  } catch (error) {
    console.error('Error loading translations:', error);
    return {};
  }
}

// Définir la langue
export function setLanguage(lang: Language) {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('broolykid-language', lang);
  }
}

// Obtenir la langue actuelle
export function getLanguage(): Language {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('broolykid-language') as Language;
    if (stored && languages.some(l => l.code === stored)) {
      currentLanguage = stored;
    }
  }
  return currentLanguage;
}

// Traduire une clé
export function t(key: string, lang?: Language): string {
  const targetLang = lang || currentLanguage;

  // Navigation dans l'objet de traduction avec notation pointée
  const keys = key.split('.');
  let value: any = translations[targetLang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback vers français si traduction manquante
      value = translations['fr'];
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Retourner la clé si aucune traduction trouvée
        }
      }
      break;
    }
  }

  return typeof value === 'string' ? value : key;
}

// Hook React pour le multilingue
export function useTranslation() {
  const [lang, setLang] = React.useState<Language>(getLanguage());

  React.useEffect(() => {
    loadTranslations();
  }, []);

  const changeLanguage = (newLang: Language) => {
    setLanguage(newLang);
    setLang(newLang);
  };

  return {
    t: (key: string) => t(key, lang),
    language: lang,
    changeLanguage,
    languages,
  };
}

// Pour compatibilité React
import React from 'react';
