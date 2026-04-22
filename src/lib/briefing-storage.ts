import type { BriefingInput, GenerateResult } from "@/lib/criativo-types";
import { hashScripts } from "@/lib/video-storage";

const KEY = "criativo-os:briefings";
const MAX = 20;

export type SavedBriefing = {
  id: string;
  name: string;
  createdAt: string;
  briefing: BriefingInput;
  result: GenerateResult;
  scriptsHash: string;
};

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const t = "__cob_test__";
    ls.setItem(t, "1");
    ls.removeItem(t);
    return ls;
  } catch {
    return null;
  }
}

function readAll(): SavedBriefing[] {
  const ls = safeLS();
  if (!ls) return [];
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (b): b is SavedBriefing =>
        b && typeof b.id === "string" && typeof b.createdAt === "string",
    );
  } catch {
    try {
      ls.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return [];
  }
}

function writeAll(items: SavedBriefing[]) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(items));
  } catch {
    // Quota: try trimming
    try {
      ls.setItem(KEY, JSON.stringify(items.slice(0, Math.max(1, Math.floor(items.length / 2)))));
    } catch {
      /* give up */
    }
  }
}

export function listBriefings(): SavedBriefing[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function autoName(briefing: BriefingInput, createdAt: string): string {
  const d = new Date(createdAt);
  const dateStr = d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const produto = (briefing.produto || "Briefing").trim().slice(0, 40);
  return `${produto} — ${dateStr}`;
}

export function saveBriefing(
  briefing: BriefingInput,
  result: GenerateResult,
): SavedBriefing {
  const createdAt = new Date().toISOString();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const item: SavedBriefing = {
    id,
    name: autoName(briefing, createdAt),
    createdAt,
    briefing,
    result,
    scriptsHash: hashScripts(result.scripts),
  };
  const all = readAll();
  all.unshift(item);
  writeAll(all.slice(0, MAX));
  return item;
}

export function deleteBriefing(id: string) {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function renameBriefing(id: string, name: string) {
  const all = readAll();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], name: name.trim() || all[idx].name };
  writeAll(all);
}
