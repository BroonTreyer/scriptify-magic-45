import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  GeneratedVideo,
  HeygenAvatar,
  HeygenRatio,
  HeygenResolution,
  HeygenVideoStatus,
  HeygenVoice,
} from "@/lib/heygen-types";
import type { Script } from "@/lib/criativo-types";
import { PhotoAvatarUpload } from "@/components/PhotoAvatarUpload";

function buildScriptText(s: Script): { text: string; truncated: boolean } {
  const raw = [s.hook, s.agitacao, s.virada, s.prova, s.cta]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (raw.length <= 1500) return { text: raw, truncated: false };
  // truncate by sentence boundary
  const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [raw];
  let acc = "";
  for (const sent of sentences) {
    if ((acc + sent).length > 1500) break;
    acc += sent;
  }
  if (!acc) acc = raw.slice(0, 1500);
  return { text: acc.trim(), truncated: true };
}

type Phase = "config" | "generating" | "polling" | "done" | "error";

export function HeygenDrawer({
  open,
  onOpenChange,
  script,
  onVideoReady,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  script: Script | null;
  onVideoReady: (v: GeneratedVideo) => void;
}) {
  const [avatars, setAvatars] = useState<HeygenAvatar[]>([]);
  const [voices, setVoices] = useState<HeygenVoice[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [resolution, setResolution] = useState<HeygenResolution>("1080p");
  const [ratio, setRatio] = useState<HeygenRatio>("9:16");
  const [speed, setSpeed] = useState<number>(0.92);
  const [avatarQuery, setAvatarQuery] = useState<string>("");
  const [avatarTab, setAvatarTab] = useState<"public" | "custom">("public");

  const [phase, setPhase] = useState<Phase>("config");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [statusInfo, setStatusInfo] = useState<HeygenVideoStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollStartRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVideoReadyRef = useRef(onVideoReady);
  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
  }, [onVideoReady]);

  const { text: finalText, truncated } = script
    ? buildScriptText(script)
    : { text: "", truncated: false };

  // Reset state when reopening with a different script
  useEffect(() => {
    if (!open) return;
    setPhase("config");
    setVideoId(null);
    setStatusInfo(null);
    setErrorMsg(null);
  }, [open, script]);

  // Clear avatar search when drawer closes
  useEffect(() => {
    if (!open) setAvatarQuery("");
  }, [open]);

  // Load avatars + voices on first open
  useEffect(() => {
    if (!open) return;
    if (avatars.length > 0 && voices.length > 0) return;
    let cancelled = false;
    setLoadingMeta(true);
    setMetaError(null);
    (async () => {
      try {
        const [aRes, vRes] = await Promise.all([
          fetch("/api/public/heygen/avatars"),
          fetch("/api/public/heygen/voices"),
        ]);
        const aJson = await aRes.json();
        const vJson = await vRes.json();
        if (!aRes.ok) throw new Error(aJson.error || "Erro ao carregar avatares.");
        if (!vRes.ok) throw new Error(vJson.error || "Erro ao carregar vozes.");
        if (cancelled) return;
        setAvatars(aJson.avatars ?? []);
        setVoices(vJson.voices ?? []);
      } catch (e) {
        if (!cancelled) setMetaError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, avatars.length, voices.length]);

  // Polling
  useEffect(() => {
    if (phase !== "polling" || !videoId) return;
    let cancelled = false;
    pollStartRef.current = Date.now();

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/public/heygen/status/${encodeURIComponent(videoId)}`);
        const json = (await res.json()) as HeygenVideoStatus & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErrorMsg(json.error || "Erro ao consultar status.");
          setPhase("error");
          return;
        }
        setStatusInfo(json);
        if (json.status === "completed" && json.video_url) {
          setPhase("done");
          onVideoReadyRef.current({
            videoId,
            videoUrl: json.video_url,
            generatedAt: new Date().toISOString(),
          });
          return;
        }
        if (json.status === "failed") {
          setErrorMsg(json.error || "Renderização falhou no HeyGen.");
          setPhase("error");
          return;
        }
        if (Date.now() - pollStartRef.current > 5 * 60 * 1000) {
          setErrorMsg("A renderização está demorando. Verifique em heygen.com.");
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

  const playPreview = (url?: string) => {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const a = new Audio(url);
    audioRef.current = a;
    a.play().catch(() => {});
  };

  const generate = async () => {
    if (!script) return;
    if (!selectedAvatar || !selectedVoice) {
      setErrorMsg("Selecione um avatar e uma voz antes de gerar.");
      return;
    }
    setErrorMsg(null);
    setPhase("generating");
    try {
      const res = await fetch("/api/public/heygen/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          avatar_id: selectedAvatar,
          voice_id: selectedVoice,
          text: finalText,
          speed,
          ratio,
          resolution,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || `Erro ao gerar vídeo (${res.status}).`);
        setPhase("error");
        return;
      }
      setVideoId(json.video_id);
      setStatusInfo({ status: "pending" });
      setPhase("polling");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const labelStyle: React.CSSProperties = {
    color: "var(--co-text-dim)",
  };

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
            🎬 PRODUZIR <span style={{ color: "var(--co-red)" }}>VÍDEO</span>
          </SheetTitle>
          {script && (
            <div className="text-[11px] font-mono uppercase tracking-wider mt-1" style={labelStyle}>
              Script: {script.angulo || "Sem ângulo"}
            </div>
          )}
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {metaError && (
            <div
              className="px-4 py-3 rounded text-xs font-mono"
              style={{
                background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              ⚠ {metaError}
            </div>
          )}

          {/* AVATAR */}
          <section>
            <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
              Avatar
            </div>
            {/* Tabs Público / Meus */}
            <div className="flex gap-2 mb-3">
              {([
                { id: "public", label: "PÚBLICOS" },
                { id: "custom", label: "MEUS AVATARES" },
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
            {loadingMeta ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded animate-pulse"
                    style={{ background: "var(--co-surface)" }}
                  />
                ))}
              </div>
            ) : (
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
                      className="rounded overflow-hidden text-left transition-all"
                      style={{
                        border: active
                          ? "2px solid var(--co-red)"
                          : "1px solid var(--co-border)",
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
                {!avatars.length && (
                  <div className="col-span-3 text-xs font-mono" style={labelStyle}>
                    Nenhum avatar disponível.
                  </div>
                )}
                {avatars.length > 0 &&
                  avatarQuery.trim() &&
                  avatars.filter((a) =>
                    a.avatar_name.toLowerCase().includes(avatarQuery.trim().toLowerCase()),
                  ).length === 0 && (
                    <div className="col-span-3 text-xs font-mono" style={labelStyle}>
                      Nenhum avatar para "{avatarQuery}".
                    </div>
                  )}
              </div>
            )}
              </div>
            )}
          </section>

          {/* VOZ */}
          <section>
            <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3" style={labelStyle}>
              Voz (PT-BR)
            </div>
            {loadingMeta ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded animate-pulse"
                    style={{ background: "var(--co-surface)" }}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {(() => {
                  const groups: Record<string, HeygenVoice[]> = { Feminino: [], Masculino: [], Outro: [] };
                  for (const v of voices) {
                    const g = (v.gender || "").toLowerCase();
                    if (g.startsWith("f") || g.includes("female")) groups.Feminino.push(v);
                    else if (g.startsWith("m") || g.includes("male")) groups.Masculino.push(v);
                    else groups.Outro.push(v);
                  }
                  return (["Feminino", "Masculino", "Outro"] as const).map((gName) => {
                    const list = groups[gName];
                    if (!list.length) return null;
                    return (
                      <div key={gName} className="space-y-1.5">
                        <h4
                          className="text-[10px] font-bold font-mono uppercase tracking-widest pt-2 pb-1"
                          style={{ color: "var(--co-red)" }}
                        >
                          {gName} · {list.length}
                        </h4>
                        {list.map((v) => {
                          const active = selectedVoice === v.voice_id;
                          return (
                            <div
                              key={v.voice_id}
                              className="flex items-center gap-2 rounded px-3 py-2"
                              style={{
                                border: active
                                  ? "1px solid var(--co-red)"
                                  : "1px solid var(--co-border)",
                                background: active
                                  ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                                  : "var(--co-surface)",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedVoice(v.voice_id)}
                                className="flex-1 text-left"
                              >
                                <div className="text-[13px]" style={{ color: "var(--co-text)" }}>
                                  {v.name}
                                </div>
                                <div className="text-[10px] font-mono uppercase" style={labelStyle}>
                                  {v.gender}
                                </div>
                              </button>
                              {v.preview_audio && (
                                <button
                                  type="button"
                                  onClick={() => playPreview(v.preview_audio)}
                                  className="text-xs px-2 py-1 rounded font-mono"
                                  style={{
                                    border: "1px solid var(--co-border-strong)",
                                    color: "var(--co-text-dim)",
                                  }}
                                >
                                  ▶
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
                {!voices.length && (
                  <div className="text-xs font-mono" style={labelStyle}>
                    Nenhuma voz em português encontrada.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* CONFIGS */}
          <section className="space-y-4">
            <div>
              <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2" style={labelStyle}>
                Resolução
              </div>
              <div className="flex gap-2">
                {(["720p", "1080p"] as const).map((r) => {
                  const active = resolution === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className="flex-1 py-2 rounded text-xs font-mono uppercase"
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
            </div>

            <div>
              <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2" style={labelStyle}>
                Proporção
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 flex-1">
                  {(["9:16", "1:1", "16:9"] as const).map((r) => {
                    const active = ratio === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRatio(r)}
                        className="flex-1 py-2 rounded text-xs font-mono"
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
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ height: 60, width: 60 }}
                  aria-hidden
                >
                  <div
                    className="rounded-sm"
                    style={{
                      border: "1.5px solid var(--co-red)",
                      background: "color-mix(in oklab, var(--co-red) 8%, transparent)",
                      height: ratio === "16:9" ? 34 : 60,
                      width: ratio === "9:16" ? 34 : 60,
                      transition: "all 0.18s ease",
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div
                className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2 flex justify-between"
                style={labelStyle}
              >
                <span>Velocidade da fala</span>
                <span style={{ color: "var(--co-red)" }}>{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.2}
                step={0.02}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-red-600"
              />
            </div>
          </section>

          {/* TEXTO PREVIEW */}
          <section>
            <div className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2" style={labelStyle}>
              Texto que será falado · {finalText.length}/1500
            </div>
            <div
              className="rounded p-3 text-[12px] leading-relaxed max-h-32 overflow-y-auto"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text-muted)",
              }}
            >
              {finalText || "—"}
            </div>
            {truncated && (
              <div className="mt-2 text-[11px] font-mono" style={{ color: "var(--co-orange, #f5a524)" }}>
                ⚠ Texto truncado para caber no limite do HeyGen (1500 chars).
              </div>
            )}
          </section>

          {/* GERAR */}
          {phase === "config" || phase === "error" ? (
            <div className="space-y-2">
              <div
                className="text-[10px] font-mono uppercase tracking-widest text-right"
                style={{
                  color: finalText.length >= 1500 ? "var(--co-red)" : "var(--co-text-dim)",
                }}
              >
                {finalText.length} / 1500 caracteres
                {finalText.length >= 1500 && " · TRUNCADO"}
              </div>
              <button
                type="button"
                onClick={generate}
                disabled={!selectedAvatar || !selectedVoice || !finalText}
                className="w-full py-4 rounded font-mono text-sm font-bold uppercase tracking-widest disabled:opacity-50"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                GERAR VÍDEO ⚡
              </button>
            </div>
          ) : null}

          {phase === "generating" && (
            <div
              className="px-4 py-4 rounded font-mono text-sm text-center"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text-dim)",
              }}
            >
              Enviando para o HeyGen...
            </div>
          )}

          {phase === "polling" && statusInfo && (
            <div
              className="rounded p-4"
              style={{ background: "var(--co-surface)", border: "1px solid var(--co-border)" }}
            >
              <div className="text-[11px] font-mono uppercase tracking-widest mb-3" style={labelStyle}>
                {statusInfo.status === "pending" ? "Na fila..." : "Renderizando..."}
              </div>
              <div
                className="h-1.5 rounded overflow-hidden"
                style={{ background: "var(--co-border)" }}
              >
                <div
                  className="h-full"
                  style={{
                    width: "40%",
                    background:
                      "linear-gradient(90deg, transparent, var(--co-red), transparent)",
                    animation: "co-slide 1.6s linear infinite",
                  }}
                />
              </div>
              <style>{`@keyframes co-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>
            </div>
          )}

          {phase === "done" && statusInfo?.video_url && videoId && (
            <div
              className="rounded p-3 space-y-3"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-green, #22c55e)",
              }}
            >
              <video
                src={statusInfo.video_url}
                controls
                className="w-full rounded"
                style={{ background: "#000" }}
              />
              <a
                href={statusInfo.video_url}
                download={`heygen-${videoId}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center py-3 rounded font-mono text-xs font-bold uppercase tracking-widest"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                ⬇ BAIXAR VÍDEO
              </a>
            </div>
          )}

          {phase === "error" && errorMsg && (
            <div
              className="px-4 py-3 rounded text-xs font-mono"
              style={{
                background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              ⚠ {errorMsg}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}