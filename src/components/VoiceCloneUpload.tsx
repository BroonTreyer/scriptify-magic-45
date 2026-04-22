import { useEffect, useRef, useState } from "react";
import {
  listCustomVoices,
  upsertCustomVoice,
  removeCustomVoice,
  type CustomVoice,
} from "@/lib/custom-voices-storage";

type Phase = "idle" | "uploading" | "done" | "error";

export function VoiceCloneUpload({
  onSelect,
  selectedVoiceId,
}: {
  onSelect: (voiceId: string, name: string, isCustom: boolean) => void;
  selectedVoiceId: string;
}) {
  const [list, setList] = useState<CustomVoice[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Feminino" | "Masculino" | "Outro">("Feminino");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setList(listCustomVoices());
  }, []);

  const handleFile = async (file: File) => {
    if (!name.trim()) {
      setError("Dá um nome pra voz antes.");
      return;
    }
    if (file.size > 11 * 1024 * 1024) {
      setError("Áudio maior que 11MB.");
      return;
    }
    setError(null);
    setPhase("uploading");

    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("gender", gender);
      fd.append("file", file, file.name);

      const res = await fetch("/api/public/elevenlabs/clone-voice", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao clonar voz.");

      const voice: CustomVoice = {
        voice_id: json.voice_id,
        name: json.name || name.trim(),
        gender,
        createdAt: new Date().toISOString(),
        provider: "elevenlabs",
      };
      upsertCustomVoice(voice);
      setList(listCustomVoices());
      setPhase("done");
      setName("");
      onSelect(voice.voice_id, voice.name, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const labelStyle: React.CSSProperties = { color: "var(--co-text-dim)" };

  return (
    <div className="space-y-4">
      {list.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {list.map((v) => {
            const active = selectedVoiceId === v.voice_id;
            return (
              <div
                key={v.voice_id}
                className="flex items-center gap-2 rounded px-3 py-2"
                style={{
                  border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                  background: active
                    ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                    : "var(--co-surface)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(v.voice_id, v.name, true)}
                  className="flex-1 text-left"
                >
                  <div className="text-[13px]" style={{ color: "var(--co-text)" }}>
                    {v.name}
                  </div>
                  <div className="text-[10px] font-mono uppercase" style={labelStyle}>
                    {v.gender} · ELEVENLABS CLONE
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeCustomVoice(v.voice_id);
                    setList(listCustomVoices());
                  }}
                  className="text-xs px-2 py-1 rounded font-mono"
                  style={{
                    border: "1px solid var(--co-border-strong)",
                    color: "var(--co-red)",
                  }}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="rounded p-4 space-y-3"
        style={{ background: "var(--co-surface)", border: "1px dashed var(--co-border-strong)" }}
      >
        <div className="text-[11px] font-bold font-mono uppercase tracking-widest" style={labelStyle}>
          + Clonar nova voz
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: Minha voz)"
          disabled={phase === "uploading"}
          className="w-full px-3 py-2 rounded text-[12px] font-mono outline-none disabled:opacity-50"
          style={{
            background: "var(--co-bg)",
            border: "1px solid var(--co-border)",
            color: "var(--co-text)",
          }}
        />
        <div className="flex gap-2">
          {(["Feminino", "Masculino", "Outro"] as const).map((g) => {
            const active = gender === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                disabled={phase === "uploading"}
                className="flex-1 py-2 rounded text-[10px] font-mono uppercase tracking-widest disabled:opacity-50"
                style={{
                  background: active ? "var(--co-red)" : "transparent",
                  border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                  color: active ? "#fff" : "var(--co-text-dim)",
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/x-m4a,audio/webm,audio/ogg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={phase === "uploading" || !name.trim()}
          className="w-full py-3 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          style={{ background: "var(--co-red)", color: "#fff" }}
        >
          {phase === "uploading" ? "CLONANDO..." : "🎙 ESCOLHER ÁUDIO (30s+)"}
        </button>
        <div className="text-[10px] font-mono" style={labelStyle}>
          Áudio limpo · 30s a 5min · MP3/WAV/M4A · até 11MB · clone instantâneo
        </div>
        {error && (
          <div
            className="px-3 py-2 rounded text-[11px] font-mono"
            style={{
              background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
              border: "1px solid var(--co-red)",
              color: "var(--co-red)",
            }}
          >
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}