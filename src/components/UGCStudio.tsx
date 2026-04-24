import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { VoiceCloneUpload } from "@/components/VoiceCloneUpload";
import { PhotoAvatarUpload } from "@/components/PhotoAvatarUpload";
import { isCustomVoiceId } from "@/lib/custom-voices-storage";
import type {
  HeygenAvatar,
  HeygenRatio,
  HeygenResolution,
  HeygenVideoStatus,
  HeygenVoice,
} from "@/lib/heygen-types";
import { useHeygenAssets } from "@/hooks/use-heygen-assets";

type Phase = "idle" | "recording" | "transcribing" | "ready" | "generating" | "polling" | "done" | "error";

export function UGCStudio({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recording
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Transcript
  const [transcript, setTranscript] = useState<string>("");

  // Heygen meta
  const { avatars, voices, loading: loadingMeta, error: metaError } =
    useHeygenAssets(open);
  const [avatarTab, setAvatarTab] = useState<"public" | "custom">("custom");
  const [voiceTab, setVoiceTab] = useState<"public" | "custom">("custom");
  const [avatarQuery, setAvatarQuery] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [resolution, setResolution] = useState<HeygenResolution>("1080p");
  const [ratio, setRatio] = useState<HeygenRatio>("9:16");
  const [speed, setSpeed] = useState(0.95);

  // Render
  const [videoId, setVideoId] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<HeygenVideoStatus | null>(null);
  const pollStartRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) {
      stopRecording(true);
      return;
    }
  }, [open]);


  // Polling
  useEffect(() => {
    if (phase !== "polling" || !videoId) return;
    let cancelled = false;
    pollStartRef.current = Date.now();
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await apiFetch(`/api/public/heygen/status/${encodeURIComponent(videoId)}`);
        const json = (await res.json()) as HeygenVideoStatus & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(json.error || "Erro ao consultar status.");
          setPhase("error");
          return;
        }
        setStatusInfo(json);
        if (json.status === "completed" && json.video_url) {
          setFinalUrl(json.video_url);
          setPhase("done");
          return;
        }
        if (json.status === "failed") {
          setErrorMsg(json.error || "Renderização falhou no HeyGen.");
          setPhase("error");
          return;
        }
        if (Date.now() - pollStartRef.current > 5 * 60 * 1000) {
          setErrorMsg("Renderização demorando demais. Verifique no HeyGen.");
          setPhase("error");
          return;
        }
        pollTimerRef.current = setTimeout(poll, 5000);
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    };
    pollTimerRef.current = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [phase, videoId]);

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRecRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        setAudioUrl((u) => {
          if (u) URL.revokeObjectURL(u);
          return URL.createObjectURL(blob);
        });
      };
      rec.start();
      setPhase("recording");
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao acessar microfone.");
      setPhase("error");
    }
  };

  const stopRecording = (silent = false) => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (!silent && phase === "recording") setPhase("idle");
  };

  const handleUpload = (file: File) => {
    setErrorMsg(null);
    setAudioBlob(file);
    setAudioUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return URL.createObjectURL(file);
    });
    setPhase("idle");
  };

  const transcribe = async () => {
    if (!audioBlob) return;
    setErrorMsg(null);
    setPhase("transcribing");
    try {
      const fd = new FormData();
      const fname = audioBlob instanceof File ? audioBlob.name : "ugc.webm";
      fd.append("file", audioBlob, fname);
      fd.append("language", "por");
      const res = await apiFetch("/api/public/elevenlabs/transcribe", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao transcrever.");
      setTranscript(json.text || "");
      setPhase("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const generate = async () => {
    if (!transcript.trim()) {
      setErrorMsg("Sem texto pra gerar. Transcreva primeiro.");
      return;
    }
    if (!selectedAvatar || !selectedVoice) {
      setErrorMsg("Selecione um avatar e uma voz antes.");
      return;
    }
    setErrorMsg(null);
    setPhase("generating");
    try {
      const useClone = isCustomVoiceId(selectedVoice);
      const url = useClone
        ? "/api/public/heygen/generate-with-audio"
        : "/api/public/heygen/generate";
      const body = useClone
        ? {
            avatar_id: selectedAvatar,
            elevenlabs_voice_id: selectedVoice,
            text: transcript.slice(0, 1500),
            speed,
            ratio,
            resolution,
          }
        : {
            avatar_id: selectedAvatar,
            voice_id: selectedVoice,
            text: transcript.slice(0, 1500),
            speed,
            ratio,
            resolution,
          };
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ao gerar (${res.status}).`);
      setVideoId(json.video_id);
      setStatusInfo({ status: "pending" });
      setPhase("polling");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const restart = () => {
    setTranscript("");
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setVideoId(null);
    setStatusInfo(null);
    setFinalUrl(null);
    setErrorMsg(null);
    setPhase("idle");
  };

  const labelStyle: React.CSSProperties = { color: "var(--co-text-dim)" };

  const mmss = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        style={{
          background: "var(--co-bg)",
          borderColor: "var(--co-border)",
          color: "var(--co-text)",
        }}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--co-border)" }}>
          <SheetTitle className="font-display text-2xl tracking-wider" style={{ color: "var(--co-text)" }}>
            🎤 UGC <span style={{ color: "var(--co-red)" }}>STUDIO</span>
          </SheetTitle>
          <div className="text-[11px] font-mono uppercase tracking-wider mt-1" style={labelStyle}>
            Fala → Transcrição → Vídeo com seu avatar e sua voz
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {(metaError || errorMsg) && (
            <div
              className="px-4 py-3 rounded text-xs font-mono"
              style={{
                background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              ⚠ {errorMsg || metaError}
            </div>
          )}

          {/* STEP 1 — capture audio */}
          {phase !== "done" && (
            <section>
              <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
                1. Capture sua fala
              </div>
              <div className="flex gap-2 mb-3">
                {phase !== "recording" ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={phase === "transcribing" || phase === "generating" || phase === "polling"}
                    className="flex-1 py-3 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                    style={{ background: "var(--co-red)", color: "#fff" }}
                  >
                    ● GRAVAR
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => stopRecording()}
                    className="flex-1 py-3 rounded font-mono text-xs font-bold uppercase tracking-widest animate-pulse"
                    style={{ background: "var(--co-red)", color: "#fff" }}
                  >
                    ■ PARAR · {mmss(elapsed)}
                  </button>
                )}
                <label
                  className="flex-1 py-3 rounded font-mono text-xs font-bold uppercase tracking-widest text-center cursor-pointer"
                  style={{ border: "1px solid var(--co-border-strong)", color: "var(--co-text)" }}
                >
                  ⬆ SUBIR ÁUDIO
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {audioUrl && phase !== "recording" && (
                <div className="space-y-2">
                  <audio src={audioUrl} controls className="w-full" />
                  {phase !== "ready" && (
                    <button
                      type="button"
                      onClick={transcribe}
                      disabled={phase === "transcribing"}
                      className="w-full py-3 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                      style={{ background: "var(--co-text)", color: "var(--co-bg)" }}
                    >
                      {phase === "transcribing" ? "TRANSCREVENDO..." : "📝 TRANSCREVER COM SCRIBE"}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* STEP 2 — transcript */}
          {(phase === "ready" || phase === "generating" || phase === "polling") && (
            <section>
              <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
                2. Texto (edite se quiser)
              </div>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={6}
                disabled={phase !== "ready"}
                className="w-full px-3 py-2 rounded text-[13px] font-sans outline-none resize-y disabled:opacity-70"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border)",
                  color: "var(--co-text)",
                }}
              />
              <div className="text-[10px] font-mono mt-1" style={labelStyle}>
                {transcript.length} / 1500 caracteres
              </div>
            </section>
          )}

          {/* STEP 3 — avatar + voice + generate */}
          {phase === "ready" && (
            <>
              <section>
                <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
                  3. Avatar
                </div>
                <div className="flex gap-2 mb-3">
                  {([
                    { id: "custom", label: "MEUS" },
                    { id: "public", label: "PÚBLICOS" },
                  ] as const).map((t) => {
                    const active = avatarTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAvatarTab(t.id)}
                        className="flex-1 py-2 rounded text-[11px] font-mono uppercase tracking-widest"
                        style={{
                          background: active ? "var(--co-red)" : "transparent",
                          border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                          color: active ? "#fff" : "var(--co-text-dim)",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {avatarTab === "custom" ? (
                  <PhotoAvatarUpload
                    selectedAvatarId={selectedAvatar}
                    onSelect={(id) => setSelectedAvatar(id)}
                  />
                ) : (
                  <div>
                    {!loadingMeta && avatars.length > 0 && (
                      <input
                        type="text"
                        value={avatarQuery}
                        onChange={(e) => setAvatarQuery(e.target.value)}
                        placeholder="Buscar avatar..."
                        className="w-full mb-3 px-3 py-2 rounded text-[12px] font-mono outline-none"
                        style={{
                          background: "var(--co-surface)",
                          border: "1px solid var(--co-border)",
                          color: "var(--co-text)",
                        }}
                      />
                    )}
                    <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                      {avatars
                        .filter((a) =>
                          avatarQuery.trim()
                            ? a.avatar_name.toLowerCase().includes(avatarQuery.trim().toLowerCase())
                            : true,
                        )
                        .map((a) => {
                          const active = selectedAvatar === a.avatar_id;
                          return (
                            <button
                              key={a.avatar_id}
                              type="button"
                              onClick={() => setSelectedAvatar(a.avatar_id)}
                              className="rounded overflow-hidden text-left"
                              style={{
                                border: active ? "2px solid var(--co-red)" : "1px solid var(--co-border)",
                                background: "var(--co-surface)",
                              }}
                            >
                              <div className="aspect-square overflow-hidden bg-black">
                                {a.preview_image_url && (
                                  <img
                                    src={a.preview_image_url}
                                    alt={a.avatar_name}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div
                                className="px-2 py-1.5 text-[10px] font-mono truncate"
                                style={{ color: active ? "var(--co-red)" : "var(--co-text-dim)" }}
                              >
                                {a.avatar_name}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
                  4. Voz
                </div>
                <div className="flex gap-2 mb-3">
                  {([
                    { id: "custom", label: "MINHA VOZ" },
                    { id: "public", label: "PÚBLICAS" },
                  ] as const).map((t) => {
                    const active = voiceTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setVoiceTab(t.id)}
                        className="flex-1 py-2 rounded text-[11px] font-mono uppercase tracking-widest"
                        style={{
                          background: active ? "var(--co-red)" : "transparent",
                          border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                          color: active ? "#fff" : "var(--co-text-dim)",
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {voiceTab === "custom" ? (
                  <VoiceCloneUpload
                    selectedVoiceId={selectedVoice}
                    onSelect={(id) => setSelectedVoice(id)}
                  />
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {voices.map((v) => {
                      const active = selectedVoice === v.voice_id;
                      return (
                        <button
                          key={v.voice_id}
                          type="button"
                          onClick={() => setSelectedVoice(v.voice_id)}
                          className="w-full text-left rounded px-3 py-2"
                          style={{
                            border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                            background: active
                              ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                              : "var(--co-surface)",
                          }}
                        >
                          <div className="text-[13px]" style={{ color: "var(--co-text)" }}>{v.name}</div>
                          <div className="text-[10px] font-mono uppercase" style={labelStyle}>{v.gender}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["9:16", "1:1", "16:9"] as const).map((r) => {
                    const active = ratio === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRatio(r)}
                        className="py-2 rounded text-[11px] font-mono"
                        style={{
                          background: active ? "var(--co-red)" : "transparent",
                          border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                          color: active ? "#fff" : "var(--co-text-dim)",
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["720p", "1080p"] as const).map((r) => {
                    const active = resolution === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setResolution(r)}
                        className="py-2 rounded text-[11px] font-mono"
                        style={{
                          background: active ? "var(--co-red)" : "transparent",
                          border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                          color: active ? "#fff" : "var(--co-text-dim)",
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <div className="text-[10px] font-mono mb-1" style={labelStyle}>
                    Velocidade: {speed.toFixed(2)}x
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.2}
                    step={0.01}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                <button
                  type="button"
                  onClick={generate}
                  className="w-full py-4 rounded font-mono text-sm font-bold uppercase tracking-widest"
                  style={{ background: "var(--co-red)", color: "#fff" }}
                >
                  🎬 GERAR VÍDEO UGC
                </button>
              </section>
            </>
          )}

          {(phase === "generating" || phase === "polling") && (
            <div
              className="px-4 py-4 rounded text-[12px] font-mono text-center"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text-dim)",
              }}
            >
              {phase === "generating"
                ? "Enviando ao HeyGen..."
                : `Renderizando (${statusInfo?.status || "pending"})...`}
            </div>
          )}

          {phase === "done" && finalUrl && (
            <section className="space-y-3">
              <video src={finalUrl} controls className="w-full rounded" />
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={finalUrl}
                  download={`ugc-${videoId}.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3 rounded text-center font-mono text-xs font-bold uppercase tracking-widest"
                  style={{ background: "var(--co-green)", color: "#000" }}
                >
                  ⬇ BAIXAR
                </a>
                <button
                  type="button"
                  onClick={restart}
                  className="py-3 rounded font-mono text-xs font-bold uppercase tracking-widest"
                  style={{ border: "1px solid var(--co-border-strong)", color: "var(--co-text)" }}
                >
                  ↻ NOVO UGC
                </button>
              </div>
            </section>
          )}

          {phase === "error" && (
            <button
              type="button"
              onClick={restart}
              className="w-full py-3 rounded font-mono text-xs font-bold uppercase tracking-widest"
              style={{ border: "1px solid var(--co-border-strong)", color: "var(--co-text)" }}
            >
              ↻ COMEÇAR DE NOVO
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
