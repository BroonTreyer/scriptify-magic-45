import type { HeygenAvatar } from "@/lib/heygen-types";
import { pushCustomAvatar, pushDeleteCustomAvatar } from "@/lib/cloud-sync";

const KEY = "criativo-os:custom-avatars";

export type CustomAvatar = HeygenAvatar & {
  createdAt: string;
  groupId?: string;
  status: "training" | "ready" | "failed";
  error?: string;
};

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const t = "__cob_ca__";
    ls.setItem(t, "1");
    ls.removeItem(t);
    return ls;
  } catch {
    return null;
  }
}

export function listCustomAvatars(): CustomAvatar[] {
  const ls = safeLS();
  if (!ls) return [];
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomAvatars(list: CustomAvatar[]) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function upsertCustomAvatar(a: CustomAvatar) {
  const list = listCustomAvatars();
  const idx = list.findIndex((x) => x.avatar_id === a.avatar_id);
  if (idx >= 0) list[idx] = a;
  else list.unshift(a);
  saveCustomAvatars(list);
  void pushCustomAvatar(a);
}

export function removeCustomAvatar(avatarId: string) {
  saveCustomAvatars(listCustomAvatars().filter((a) => a.avatar_id !== avatarId));
  void pushDeleteCustomAvatar(avatarId);
}