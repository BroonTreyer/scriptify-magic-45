import { supabase } from "@/integrations/supabase/client";
import type { SavedBriefing } from "@/lib/briefing-storage";
import type { GeneratedVideo } from "@/lib/heygen-types";
import type { LanguageCode, TranslationMap } from "@/lib/translation-storage";
import type { CustomAvatar } from "@/lib/custom-avatars-storage";
import type { CustomVoice } from "@/lib/custom-voices-storage";
import type { SavedBatch } from "@/lib/batch-storage";

/**
 * Cloud Sync — DB-first com cache em localStorage.
 *
 * Estratégia:
 *  - Storage modules mantêm API síncrona (lendo do cache local).
 *  - Cada mutate dispara um push assíncrono pra Supabase (fire-and-forget).
 *  - Ao logar: hidrata localStorage com dados do cloud (Cloud é source of truth).
 *  - Migração one-time: itens que existem só local vão pro cloud na primeira sync.
 */

const MIGRATED_FLAG = "criativo-os:cloud-migrated";

function isAuthError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? "");
  return /JWT|auth|unauthorized/i.test(msg);
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ───────── BRIEFINGS ───────── */

export async function pushBriefing(b: SavedBriefing): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("briefings").upsert(
      {
        id: b.id.length === 36 ? b.id : undefined, // local IDs aren't UUIDs; let DB gen
        user_id: uid,
        title: b.name,
        data: b.briefing as unknown as Record<string, unknown>,
        scripts: b.result as unknown as Record<string, unknown>,
        created_at: b.createdAt,
      },
      { onConflict: "id" },
    );
  } catch {
    /* swallow — local cache remains source */
  }
}

export async function pushDeleteBriefing(localId: string, title: string): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    if (localId.length === 36) {
      await supabase.from("briefings").delete().eq("id", localId).eq("user_id", uid);
    } else {
      await supabase
        .from("briefings")
        .delete()
        .eq("user_id", uid)
        .eq("title", title);
    }
  } catch {
    /* ignore */
  }
}

export async function pushRenameBriefing(localId: string, title: string): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    if (localId.length === 36) {
      await supabase.from("briefings").update({ title }).eq("id", localId).eq("user_id", uid);
    }
  } catch {
    /* ignore */
  }
}

export async function fetchBriefings(): Promise<SavedBriefing[]> {
  const uid = await getUserId();
  if (!uid) return [];
  try {
    const { data, error } = await supabase
      .from("briefings")
      .select("id, title, data, scripts, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data
      .filter((r) => r.scripts)
      .map((r) => {
        const scripts = r.scripts as unknown as SavedBriefing["result"];
        return {
          id: r.id,
          name: r.title ?? "Briefing",
          createdAt: r.created_at,
          briefing: r.data as unknown as SavedBriefing["briefing"],
          result: scripts,
          scriptsHash: hashFromScripts(scripts?.scripts ?? []),
        } satisfies SavedBriefing;
      });
  } catch {
    return [];
  }
}

function hashFromScripts(scripts: { hook?: string; cta?: string }[]): string {
  const input = scripts.map((s) => `${s.hook ?? ""}|${s.cta ?? ""}`).join("##");
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* ───────── VIDEOS ───────── */

export async function pushVideo(
  scriptHash: string,
  index: number,
  v: GeneratedVideo,
): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("videos").upsert(
      {
        user_id: uid,
        script_hash: `${scriptHash}:${index}`,
        video_id: v.videoId ?? null,
        video_url: v.videoUrl ?? null,
        thumbnail_url: v.thumbnailUrl ?? null,
        metadata: v as unknown as Record<string, unknown>,
      },
      { onConflict: "user_id,script_hash" },
    );
  } catch (e) {
    if (isAuthError(e)) return;
  }
}

export async function fetchVideos(
  scriptHash: string,
): Promise<Record<number, GeneratedVideo>> {
  const uid = await getUserId();
  if (!uid) return {};
  try {
    const { data } = await supabase
      .from("videos")
      .select("script_hash, metadata")
      .eq("user_id", uid)
      .like("script_hash", `${scriptHash}:%`);
    if (!data) return {};
    const out: Record<number, GeneratedVideo> = {};
    for (const row of data) {
      const m = row.script_hash.match(/:(\d+)$/);
      if (!m) continue;
      const idx = Number(m[1]);
      out[idx] = (row.metadata as unknown as GeneratedVideo) ?? ({} as GeneratedVideo);
    }
    return out;
  } catch {
    return {};
  }
}

/* ───────── TRANSLATIONS ───────── */

export async function pushTranslations(
  sessionKey: string,
  map: TranslationMap,
): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  const rows: {
    user_id: string;
    script_hash: string;
    language: string;
    translated_text: string;
  }[] = [];
  for (const scriptHash of Object.keys(map)) {
    const langs = map[scriptHash] ?? {};
    for (const lang of Object.keys(langs) as LanguageCode[]) {
      const s = langs[lang];
      if (!s) continue;
      rows.push({
        user_id: uid,
        script_hash: `${sessionKey}:${scriptHash}`,
        language: lang,
        translated_text: JSON.stringify(s),
      });
    }
  }
  if (rows.length === 0) return;
  try {
    await supabase
      .from("translations")
      .upsert(rows, { onConflict: "user_id,script_hash,language" });
  } catch {
    /* ignore */
  }
}

export async function fetchTranslations(sessionKey: string): Promise<TranslationMap> {
  const uid = await getUserId();
  if (!uid) return {};
  try {
    const { data } = await supabase
      .from("translations")
      .select("script_hash, language, translated_text")
      .eq("user_id", uid)
      .like("script_hash", `${sessionKey}:%`);
    if (!data) return {};
    const out: TranslationMap = {};
    for (const row of data) {
      const localHash = row.script_hash.slice(sessionKey.length + 1);
      try {
        const script = JSON.parse(row.translated_text);
        out[localHash] = out[localHash] ?? {};
        out[localHash][row.language as LanguageCode] = script;
      } catch {
        /* ignore malformed row */
      }
    }
    return out;
  } catch {
    return {};
  }
}

/* ───────── CUSTOM AVATARS ───────── */

export async function pushCustomAvatar(a: CustomAvatar): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("custom_avatars").upsert(
      {
        user_id: uid,
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name,
        group_id: a.groupId ?? null,
        status: a.status,
        error: a.error ?? null,
        preview_image_url: a.preview_image_url ?? null,
        created_at: a.createdAt,
      },
      { onConflict: "user_id,avatar_id" },
    );
  } catch {
    /* ignore */
  }
}

export async function pushDeleteCustomAvatar(avatarId: string): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase
      .from("custom_avatars")
      .delete()
      .eq("user_id", uid)
      .eq("avatar_id", avatarId);
  } catch {
    /* ignore */
  }
}

export async function fetchCustomAvatars(): Promise<CustomAvatar[]> {
  const uid = await getUserId();
  if (!uid) return [];
  try {
    const { data } = await supabase
      .from("custom_avatars")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map(
      (r): CustomAvatar => ({
        avatar_id: r.avatar_id,
        avatar_name: r.avatar_name,
        gender: "unknown",
        preview_image_url: r.preview_image_url ?? "",
        preview_video_url: "",
        premium: false,
        type: "custom",
        tags: [],
        groupId: r.group_id ?? undefined,
        status: (r.status as CustomAvatar["status"]) ?? "ready",
        error: r.error ?? undefined,
        createdAt: r.created_at,
      }),
    );
  } catch {
    return [];
  }
}

/* ───────── CUSTOM VOICES ───────── */

export async function pushCustomVoice(v: CustomVoice): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("custom_voices").upsert(
      {
        user_id: uid,
        voice_id: v.voice_id,
        name: v.name,
        gender: v.gender,
        provider: v.provider,
        created_at: v.createdAt,
      },
      { onConflict: "user_id,voice_id" },
    );
  } catch {
    /* ignore */
  }
}

export async function pushDeleteCustomVoice(voiceId: string): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("custom_voices").delete().eq("user_id", uid).eq("voice_id", voiceId);
  } catch {
    /* ignore */
  }
}

export async function fetchCustomVoices(): Promise<CustomVoice[]> {
  const uid = await getUserId();
  if (!uid) return [];
  try {
    const { data } = await supabase
      .from("custom_voices")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data.map((r) => ({
      voice_id: r.voice_id,
      name: r.name,
      gender: r.gender,
      createdAt: r.created_at,
      provider: "elevenlabs" as const,
    }));
  } catch {
    return [];
  }
}

/* ───────── BATCHES ───────── */

export async function pushBatch(b: SavedBatch): Promise<void> {
  const uid = await getUserId();
  if (!uid) return;
  try {
    await supabase.from("batches").upsert(
      {
        id: b.id.length === 36 ? b.id : undefined,
        user_id: uid,
        matrix: b as unknown as Record<string, unknown>,
        status: "active",
        created_at: b.createdAt,
      },
      { onConflict: "id" },
    );
  } catch {
    /* ignore */
  }
}

/* ───────── HYDRATION + MIGRATION ───────── */

/**
 * Chamado uma vez por sessão autenticada:
 *  1. Baixa tudo do cloud → reescreve localStorage (cloud wins).
 *  2. Se ainda não migrou, sobe o que tem só local pro cloud.
 */
export async function syncOnLogin(): Promise<void> {
  if (typeof window === "undefined") return;
  const uid = await getUserId();
  if (!uid) return;

  // Lazy import pra evitar ciclo de dep no SSR/build
  const [
    briefingMod,
    videoMod,
    transMod,
    avatarsMod,
    voicesMod,
  ] = await Promise.all([
    import("@/lib/briefing-storage"),
    import("@/lib/video-storage"),
    import("@/lib/translation-storage"),
    import("@/lib/custom-avatars-storage"),
    import("@/lib/custom-voices-storage"),
  ]);

  const ls = window.localStorage;
  const migrated = ls.getItem(MIGRATED_FLAG + ":" + uid) === "1";

  // 1) MIGRATE local→cloud (one-time)
  if (!migrated) {
    try {
      // briefings locais → push
      const localBriefings = briefingMod.listBriefings();
      for (const b of localBriefings) await pushBriefing(b);

      // custom avatars/voices locais → push
      for (const a of avatarsMod.listCustomAvatars()) await pushCustomAvatar(a);
      for (const v of voicesMod.listCustomVoices()) await pushCustomVoice(v);

      // videos: sobem por scriptsHash de cada briefing local
      for (const b of localBriefings) {
        const vids = videoMod.loadVideos(b.scriptsHash);
        for (const idxStr of Object.keys(vids)) {
          const idx = Number(idxStr);
          const v = vids[idx];
          if (v) await pushVideo(b.scriptsHash, idx, v);
        }
        // translations idem
        const tr = transMod.loadTranslations(b.scriptsHash);
        if (Object.keys(tr).length) await pushTranslations(b.scriptsHash, tr);
      }
      ls.setItem(MIGRATED_FLAG + ":" + uid, "1");
    } catch {
      /* ignore — tenta de novo na próxima sessão */
    }
  }

  // 2) HYDRATE cloud→local (cloud wins)
  try {
    const cloudBriefings = await fetchBriefings();
    if (cloudBriefings.length) briefingMod.replaceAllBriefings(cloudBriefings);

    const cloudAvatars = await fetchCustomAvatars();
    avatarsMod.saveCustomAvatars(cloudAvatars);

    const cloudVoices = await fetchCustomVoices();
    voicesMod.saveCustomVoices(cloudVoices);

    // videos & translations: hidrata por sessionKey de cada briefing
    for (const b of cloudBriefings) {
      const vids = await fetchVideos(b.scriptsHash);
      if (Object.keys(vids).length) videoMod.saveVideos(b.scriptsHash, vids);

      const tr = await fetchTranslations(b.scriptsHash);
      if (Object.keys(tr).length) transMod.saveTranslations(b.scriptsHash, tr);
    }
  } catch {
    /* fica com cache local */
  }
}

export function clearLocalCacheOnLogout(): void {
  if (typeof window === "undefined") return;
  const ls = window.localStorage;
  // remove apenas chaves do app (não toca em supabase auth keys)
  const prefixes = [
    "criativo-os:briefings",
    "criativo-os:videos:",
    "criativo-os:translations:",
    "criativo-os:custom-avatars",
    "criativo-os:custom-voices",
    "criativo-os:batch:",
  ];
  const toRemove: string[] = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (!k) continue;
    if (prefixes.some((p) => k.startsWith(p))) toRemove.push(k);
  }
  for (const k of toRemove) {
    try {
      ls.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}