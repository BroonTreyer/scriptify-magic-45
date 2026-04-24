import type { Script } from "@/lib/criativo-types";
import { pushTranslations } from "@/lib/cloud-sync";

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

// shape: { [scriptHash]: { [langCode]: Script } }
// Chaveado por hash do script (não por índice) para sobreviver a regenerações
// que reordenam scripts.
export type TranslationMap = Record<string, Partial<Record<LanguageCode, Script>>>;

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
    if (!parsed || typeof parsed !== "object") return {};
    // Migration: descarta formato antigo (chaves numéricas) — nunca casará com hash
    // novo, então não vaza tradução pro script errado.
    const out: TranslationMap = {};
    for (const k of Object.keys(parsed)) {
      if (!/^\d+$/.test(k)) {
        out[k] = (parsed as TranslationMap)[k];
      }
    }
    return out;
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
  void pushTranslations(sessionKey, map);
}
