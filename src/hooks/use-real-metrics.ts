import { useEffect, useRef, useState } from "react";
import { listBriefings } from "@/lib/briefing-storage";
import { LANGUAGES } from "@/lib/translation-storage";
import {
  fetchMetricsSnapshot,
  pushMetricsSnapshot,
} from "@/lib/cloud-sync";
import { supabase } from "@/integrations/supabase/client";

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
  const lastPushedRef = useRef<RealMetrics | null>(null);
  useEffect(() => {
    let cancelled = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;

    const recount = () => {
      const local = countMetrics();
      if (!cancelled) setM(local);
      // só pushar se realmente mudou (quebra qualquer eco residual via realtime)
      const last = lastPushedRef.current;
      const changed =
        !last ||
        last.scripts !== local.scripts ||
        last.videos !== local.videos ||
        last.languages !== local.languages;
      if (!changed) return;
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        lastPushedRef.current = local;
        void pushMetricsSnapshot(local);
      }, 1500);
    };

    // 1) hidrata do cloud (se logado), depois reconta local
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const cloud = await fetchMetricsSnapshot();
          if (cloud && !cancelled) {
            setM(cloud);
            // marca como já pushado pra não reescrever o mesmo snapshot
            lastPushedRef.current = cloud;
          }
        }
      } catch {
        /* ignore */
      }
      recount();
    })();

    const refresh = () => recount();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("criativo-os:sync", refresh);
    return () => {
      cancelled = true;
      if (pushTimer) clearTimeout(pushTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("criativo-os:sync", refresh);
    };
  }, []);
  return m;
}
