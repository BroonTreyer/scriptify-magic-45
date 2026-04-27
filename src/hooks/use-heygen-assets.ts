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

type AssetsPayload = { avatars?: HeygenAvatar[]; voices?: HeygenVoice[]; error?: string };

function notify(state: AssetsState) {
  for (const cb of subscribers) cb(state);
}

async function readJsonSafely(res: Response): Promise<{ data: AssetsPayload | null; raw: string }> {
  const raw = await res.text();
  try {
    return {
      data: raw ? (JSON.parse(raw) as AssetsPayload) : null,
      raw,
    };
  } catch {
    return { data: null, raw };
  }
}

function friendlyAssetsError(status: number, msg: string | undefined, raw: string, kind: "avatares" | "vozes") {
  if (msg) return msg;
  if (status === 504 || /upstream|timeout|timed? ?out/i.test(raw)) {
    return `O HeyGen demorou demais para responder ao carregar ${kind}. Tente novamente em instantes.`;
  }
  if (status === 502 || status === 503) {
    return `O HeyGen está instável ao carregar ${kind}. Tente de novo em alguns segundos.`;
  }
  if (status === 401) return "A chave do HeyGen parece inválida.";
  if (status === 403) return "Sua sessão expirou. Recarregue a página.";
  return `Erro ao carregar ${kind} (${status}).`;
}

async function fetchAssets(): Promise<{ avatars: HeygenAvatar[]; voices: HeygenVoice[] }> {
  const [aRes, vRes] = await Promise.all([
    apiFetch("/api/public/heygen/avatars"),
    apiFetch("/api/public/heygen/voices"),
  ]);
  const [{ data: aJson, raw: aRaw }, { data: vJson, raw: vRaw }] = await Promise.all([
    readJsonSafely(aRes),
    readJsonSafely(vRes),
  ]);
  if (!aRes.ok) {
    throw new Error(friendlyAssetsError(aRes.status, aJson?.error, aRaw, "avatares"));
  }
  if (!vRes.ok) {
    throw new Error(friendlyAssetsError(vRes.status, vJson?.error, vRaw, "vozes"));
  }
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