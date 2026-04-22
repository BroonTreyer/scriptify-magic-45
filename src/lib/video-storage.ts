import type { Script } from "@/lib/criativo-types";
import type { GeneratedVideo } from "@/lib/heygen-types";

const PREFIX = "criativo-os:videos:";
const INDEX_KEY = "criativo-os:videos:_index";
const MAX_SESSIONS = 5;

export function hashScripts(scripts: Script[]): string {
  const input = scripts.map((s) => `${s.hook ?? ""}|${s.cta ?? ""}`).join("##");
  // djb2
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

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

function readIndex(ls: Storage): string[] {
  try {
    const raw = ls.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ls: Storage, keys: string[]) {
  try {
    ls.setItem(INDEX_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

function touchIndex(ls: Storage, sessionKey: string, keepCount = MAX_SESSIONS) {
  const idx = readIndex(ls).filter((k) => k !== sessionKey);
  idx.unshift(sessionKey);
  const keep = idx.slice(0, keepCount);
  const remove = idx.slice(keepCount);
  for (const k of remove) {
    try {
      ls.removeItem(PREFIX + k);
    } catch {
      /* ignore */
    }
  }
  writeIndex(ls, keep);
}

export function loadVideos(sessionKey: string): Record<number, GeneratedVideo> {
  const ls = safeLS();
  if (!ls) return {};
  try {
    const raw = ls.getItem(PREFIX + sessionKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<number, GeneratedVideo>;
  } catch {
    try {
      ls.removeItem(PREFIX + sessionKey);
    } catch {
      /* ignore */
    }
    return {};
  }
}

export function saveVideos(
  sessionKey: string,
  videos: Record<number, GeneratedVideo>,
) {
  const ls = safeLS();
  if (!ls) return;
  const payload = JSON.stringify(videos);
  try {
    ls.setItem(PREFIX + sessionKey, payload);
    touchIndex(ls, sessionKey, MAX_SESSIONS);
  } catch {
    // Quota — aggressive cleanup, retry once
    try {
      const idx = readIndex(ls);
      for (const k of idx) {
        if (k !== sessionKey) {
          try {
            ls.removeItem(PREFIX + k);
          } catch {
            /* ignore */
          }
        }
      }
      writeIndex(ls, [sessionKey]);
      ls.setItem(PREFIX + sessionKey, payload);
    } catch {
      /* give up silently */
    }
  }
}
