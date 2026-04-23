import { useEffect, useState } from "react";
import { listBriefings } from "@/lib/briefing-storage";
import { LANGUAGES } from "@/lib/translation-storage";

export type RealMetrics = {
  scripts: number;
  videos: number;
  languages: number;
};

const VIDEO_PREFIX = "criativo-os:videos:";
const TRANSLATION_PREFIX = "criativo-os:translations:";

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function countMetrics(): RealMetrics {
  const ls = safeLS();
  if (!ls) return { scripts: 0, videos: 0, languages: 1 };

  // scripts = soma dos scripts de todos os briefings salvos
  let scripts = 0;
  try {
    for (const b of listBriefings()) {
      scripts += b.result?.scripts?.length ?? 0;
    }
  } catch {
    /* ignore */
  }

  // videos = total de videos salvos em todas as sessões
  let videos = 0;
  // languages = idiomas únicos efetivamente usados em qualquer tradução
  const langs = new Set<string>(["pt"]); // PT é o default

  try {
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k) continue;
      if (k.startsWith(VIDEO_PREFIX) && k !== VIDEO_PREFIX + "_index") {
        try {
          const raw = ls.getItem(k);
          if (!raw) continue;
          const obj = JSON.parse(raw);
          if (obj && typeof obj === "object") {
            videos += Object.keys(obj).length;
          }
        } catch {
          /* ignore */
        }
      } else if (k.startsWith(TRANSLATION_PREFIX)) {
        try {
          const raw = ls.getItem(k);
          if (!raw) continue;
          const obj = JSON.parse(raw);
          if (obj && typeof obj === "object") {
            for (const idx of Object.keys(obj)) {
              const inner = obj[idx];
              if (inner && typeof inner === "object") {
                for (const lang of Object.keys(inner)) {
                  if (LANGUAGES.some((l) => l.code === lang)) langs.add(lang);
                }
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }

  return { scripts, videos, languages: langs.size };
}

export function useRealMetrics(): RealMetrics {
  // SSR-safe: hidrata com 0,0,1 e atualiza no client
  const [m, setM] = useState<RealMetrics>({ scripts: 0, videos: 0, languages: 1 });
  useEffect(() => {
    setM(countMetrics());
    // re-count on focus / storage events
    const refresh = () => setM(countMetrics());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return m;
}
