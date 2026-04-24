import type { GeneratedVideo } from "@/lib/heygen-types";
import { pushBatch } from "@/lib/cloud-sync";

const KEY_PREFIX = "criativo-os:batch:";
const INDEX_KEY = "criativo-os:batch:_index";
const MAX_BATCHES = 10;

export type BatchJobStatus = "queued" | "generating" | "polling" | "done" | "failed";

export type BatchJob = {
  id: string;
  scriptIndex: number;
  scriptLabel: string; // angulo ou "#1"
  avatarId: string;
  avatarName: string;
  voiceId: string;
  voiceName: string;
  ratio: "9:16" | "1:1" | "16:9";
  resolution: "720p" | "1080p";
  status: BatchJobStatus;
  videoId?: string;
  video?: GeneratedVideo;
  error?: string;
  winner?: boolean;
  createdAt: string;
};

export type SavedBatch = {
  id: string;
  name: string;
  scriptsHash: string;
  createdAt: string;
  jobs: BatchJob[];
};

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const t = "__cob_b__";
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

function writeIndex(ls: Storage, ids: string[]) {
  try {
    ls.setItem(INDEX_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function touch(ls: Storage, id: string) {
  const idx = readIndex(ls).filter((k) => k !== id);
  idx.unshift(id);
  const keep = idx.slice(0, MAX_BATCHES);
  for (const k of idx.slice(MAX_BATCHES)) {
    try {
      ls.removeItem(KEY_PREFIX + k);
    } catch {
      /* ignore */
    }
  }
  writeIndex(ls, keep);
}

export function saveBatch(batch: SavedBatch) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(KEY_PREFIX + batch.id, JSON.stringify(batch));
    touch(ls, batch.id);
  } catch {
    // try cleanup
    try {
      const idx = readIndex(ls);
      for (const k of idx) {
        if (k !== batch.id) {
          try {
            ls.removeItem(KEY_PREFIX + k);
          } catch {
            /* ignore */
          }
        }
      }
      writeIndex(ls, [batch.id]);
      ls.setItem(KEY_PREFIX + batch.id, JSON.stringify(batch));
    } catch {
      /* give up */
    }
  }
  void pushBatch(batch);
}

export function loadBatch(id: string): SavedBatch | null {
  const ls = safeLS();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as SavedBatch;
  } catch {
    return null;
  }
}

export function listBatches(): SavedBatch[] {
  const ls = safeLS();
  if (!ls) return [];
  const ids = readIndex(ls);
  const out: SavedBatch[] = [];
  for (const id of ids) {
    const b = loadBatch(id);
    if (b) out.push(b);
  }
  return out;
}

export function deleteBatch(id: string) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.removeItem(KEY_PREFIX + id);
  } catch {
    /* ignore */
  }
  writeIndex(
    ls,
    readIndex(ls).filter((k) => k !== id),
  );
}

export function newBatchId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function jobsToCsv(jobs: BatchJob[]): string {
  const header = [
    "script",
    "avatar",
    "voice",
    "ratio",
    "resolution",
    "status",
    "winner",
    "video_url",
    "error",
  ];
  const rows = jobs.map((j) =>
    [
      j.scriptLabel,
      j.avatarName,
      j.voiceName,
      j.ratio,
      j.resolution,
      j.status,
      j.winner ? "yes" : "",
      j.video?.videoUrl ?? "",
      j.error ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}
