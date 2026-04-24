import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import type { HeygenAvatar, HeygenVoice } from "@/lib/heygen-types";

type AssetsState = {
  avatars: HeygenAvatar[];
  voices: HeygenVoice[];
  loading: boolean;
  error: string | null;
};

let cache: { avatars: HeygenAvatar[]; voices: HeygenVoice[] } | null = null;
let inflight: Promise<{ avatars: HeygenAvatar[]; voices: HeygenVoice[] }> | null = null;
const subscribers = new Set<(s: AssetsState) => void>();

function notify(state: AssetsState) {
  for (const cb of subscribers) cb(state);
}

async function fetchAssets(): Promise<{ avatars: HeygenAvatar[]; voices: HeygenVoice[] }> {
  const [aRes, vRes] = await Promise.all([
    apiFetch("/api/public/heygen/avatars"),
    apiFetch("/api/public/heygen/voices"),
  ]);
  const aJson = await aRes.json();
  const vJson = await vRes.json();
  if (!aRes.ok) throw new Error(aJson.error || "Erro ao carregar avatares.");
  if (!vRes.ok) throw new Error(vJson.error || "Erro ao carregar vozes.");
  return {
    avatars: (aJson.avatars ?? []) as HeygenAvatar[],
    voices: (vJson.voices ?? []) as HeygenVoice[],
  };
}

/**
 * Hook compartilhado para avatares + vozes HeyGen.
 * - 1 fetch por sessão (cache de módulo).
 * - Chamadas concorrentes compartilham a mesma promessa (dedupe).
 * - Componentes que ativam (open=true) montam o hook e recebem o cache.
 */
export function useHeygenAssets(active: boolean): AssetsState & {
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<AssetsState>(() =>
    cache
      ? { avatars: cache.avatars, voices: cache.voices, loading: false, error: null }
      : { avatars: [], voices: [], loading: false, error: null },
  );

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const sub = (s: AssetsState) => {
      if (mounted) setState(s);
    };
    subscribers.add(sub);

    if (cache) {
      sub({ avatars: cache.avatars, voices: cache.voices, loading: false, error: null });
    } else {
      sub({ avatars: [], voices: [], loading: true, error: null });
      const p =
        inflight ??
        (inflight = fetchAssets()
          .then((r) => {
            cache = r;
            return r;
          })
          .finally(() => {
            inflight = null;
          }));
      p.then((r) => {
        notify({ avatars: r.avatars, voices: r.voices, loading: false, error: null });
      }).catch((e: unknown) => {
        notify({
          avatars: [],
          voices: [],
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }

    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, [active]);

  const refresh = async () => {
    cache = null;
    inflight = null;
    notify({ avatars: [], voices: [], loading: true, error: null });
    try {
      const r = await fetchAssets();
      cache = r;
      notify({ avatars: r.avatars, voices: r.voices, loading: false, error: null });
    } catch (e) {
      notify({
        avatars: [],
        voices: [],
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return { ...state, refresh };
}