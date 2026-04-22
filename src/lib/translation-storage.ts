import type { Script } from "@/lib/criativo-types";

export type LanguageCode = "pt" | "en" | "es" | "fr" | "it" | "de";

export const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "Inglês (EUA)", flag: "🇺🇸" },
  { code: "es", label: "Espanhol", flag: "🇪🇸" },
  { code: "fr", label: "Francês", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "de", label: "Alemão", flag: "🇩🇪" },
];

const PREFIX = "criativo-os:translations:";

// shape: { [scriptIndex]: { [langCode]: Script } }
export type TranslationMap = Record<number, Partial<Record<LanguageCode, Script>>>;

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const t = "__co_test__";
    ls.setItem(t, "1");
    ls.removeItem(t);
    return ls;
  } catch {
    return null;
  }
}

export function loadTranslations(sessionKey: string): TranslationMap {
  const ls = safeLS();
  if (!ls) return {};
  try {
    const raw = ls.getItem(PREFIX + sessionKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as TranslationMap) : {};
  } catch {
    return {};
  }
}

export function saveTranslations(sessionKey: string, map: TranslationMap) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(PREFIX + sessionKey, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}
