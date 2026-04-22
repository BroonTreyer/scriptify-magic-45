const KEY = "criativo-os:custom-voices";

export type CustomVoice = {
  voice_id: string;
  name: string;
  gender: string; // "Feminino" | "Masculino" | "Outro"
  createdAt: string;
  // Marcador para o fluxo de geração saber que precisa rotear via ElevenLabs TTS
  provider: "elevenlabs";
};

function safeLS(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const t = "__cob_cv__";
    ls.setItem(t, "1");
    ls.removeItem(t);
    return ls;
  } catch {
    return null;
  }
}

export function listCustomVoices(): CustomVoice[] {
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

export function saveCustomVoices(list: CustomVoice[]) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function upsertCustomVoice(v: CustomVoice) {
  const list = listCustomVoices();
  const idx = list.findIndex((x) => x.voice_id === v.voice_id);
  if (idx >= 0) list[idx] = v;
  else list.unshift(v);
  saveCustomVoices(list);
}

export function removeCustomVoice(voiceId: string) {
  saveCustomVoices(listCustomVoices().filter((v) => v.voice_id !== voiceId));
}

export function isCustomVoiceId(voiceId: string): boolean {
  return listCustomVoices().some((v) => v.voice_id === voiceId);
}