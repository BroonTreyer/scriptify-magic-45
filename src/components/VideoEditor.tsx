import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music-library";

type CaptionChunk = { text: string; start: number; end: number };
type CaptionStyle = "tiktok" | "minimal" | "neon";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videoUrl: string;
  videoLabel?: string;
};

const labelStyle: React.CSSProperties = { color: "var(--co-text-dim)" };

export function VideoEditor({ open, onOpenChange, videoUrl, videoLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trim, setTrim] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [playing, setPlaying] = useState(false);

  const [voiceVolume, setVoiceVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.25);
  const [music, setMusic] = useState<MusicTrack | null>(null);

  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("tiktok");
  const [captions, setCaptions] = useState<CaptionChunk[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setPlaying(false);
    setCaptions([]);
    setTranscribeError(null);
    setExporting(false);
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);
    setMusic(null);
  }, [open]);

  // Sync video element volume
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = voiceVolume;
  }, [voiceVolume]);
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume;
  }, [musicVolume]);

  // Time loop for caption rendering (preview)
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        setCurrentTime(v.currentTime);
        // Auto-stop when reaching trim end
        if (trim.end > 0 && v.currentTime >= trim.end) {
          v.pause();
          v.currentTime = trim.start;
          if (musicRef.current) {
            musicRef.current.pause();
            musicRef.current.currentTime = 0;
          }
          setPlaying(false);
        }
        drawCaptionOverlay();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trim.end, trim.start, captions, captionStyle]);

  const drawCaptionOverlay = () => {
    const canvas = canvasRef.current;
    const v = videoRef.current;
    if (!canvas || !v || !v.videoWidth) return;
    if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (captions.length === 0) return;
    const t = v.currentTime;
    const active = captions.find((c) => t >= c.start && t <= c.end);
    if (!active) return;
    drawCaption(ctx, canvas.width, canvas.height, active.text, captionStyle);
  };

  const onLoadedMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setTrim({ start: 0, end: v.duration });
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      musicRef.current?.pause();
      setPlaying(false);
    } else {
      if (v.currentTime < trim.start || v.currentTime >= trim.end) {
        v.currentTime = trim.start;
      }
      v.play();
      if (musicRef.current && music) {
        musicRef.current.currentTime = 0;
        musicRef.current.play().catch(() => {});
      }
      setPlaying(true);
    }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(trim.start, Math.min(trim.end, t));
  };

  const transcribe = async () => {
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const res = await apiFetch("/api/public/elevenlabs/transcribe-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoUrl, language: "por" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro (${res.status}).`);
      setCaptions(json.chunks || []);
    } catch (e) {
      setTranscribeError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranscribing(false);
    }
  };

  const exportEdited = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;
    setExporting(true);
    setExportProgress(0);
    setExportUrl(null);
    setExportError(null);

    // Avoid AudioContext "InvalidStateError: source already connected".
    // We never reuse the preview <video> as an AudioNode source — instead we
    // create a fresh hidden <video> per export. The preview keeps playing the
    // original element with its native audio.
    const exportVideo = document.createElement("video");
    exportVideo.src = videoUrl;
    exportVideo.crossOrigin = "anonymous";
    exportVideo.muted = false;
    exportVideo.preload = "auto";
    exportVideo.playsInline = true;

    let audioCtx: AudioContext | null = null;
    let exportMusic: HTMLAudioElement | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          exportVideo.removeEventListener("loadedmetadata", onReady);
          exportVideo.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          exportVideo.removeEventListener("loadedmetadata", onReady);
          exportVideo.removeEventListener("error", onError);
          reject(new Error("Falha ao carregar vídeo para exportar."));
        };
        exportVideo.addEventListener("loadedmetadata", onReady);
        exportVideo.addEventListener("error", onError);
      });

      // Pause everything first
      v.pause();
      musicRef.current?.pause();

      // Build composition canvas
      const comp = document.createElement("canvas");
      comp.width = exportVideo.videoWidth || v.videoWidth;
      comp.height = exportVideo.videoHeight || v.videoHeight;
      const cctx = comp.getContext("2d");
      if (!cctx) throw new Error("Canvas indisponível.");

      const stream = comp.captureStream(30);

      // Compose audio with WebAudio
      const AudioCtxCtor =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) throw new Error("AudioContext indisponível.");
      audioCtx = new AudioCtxCtor();
      const dest = audioCtx.createMediaStreamDestination();

      // Voice from FRESH hidden video element (never reused → never throws).
      const voiceSrc = audioCtx.createMediaElementSource(exportVideo);
      const voiceGain = audioCtx.createGain();
      voiceGain.gain.value = voiceVolume;
      voiceSrc.connect(voiceGain).connect(dest);
      // Do NOT connect to audioCtx.destination: the preview element gives audio
      // feedback. The hidden export video stays muted to the user.

      let musicSrc: MediaElementAudioSourceNode | null = null;
      if (music) {
        // Fresh <audio> for music too, so re-export works without reconnect.
        exportMusic = new Audio(music.url);
        exportMusic.crossOrigin = "anonymous";
        exportMusic.loop = true;
        musicSrc = audioCtx.createMediaElementSource(exportMusic);
        const musicGain = audioCtx.createGain();
        musicGain.gain.value = musicVolume;
        musicSrc.connect(musicGain).connect(dest);
      }

      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);

      const mime =
        MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
        recorder.onerror = (e) => reject((e as ErrorEvent).error || new Error("Erro no MediaRecorder."));
      });

      // Seek and play
      exportVideo.currentTime = trim.start;
      await new Promise<void>((r) => {
        const onSeek = () => {
          exportVideo.removeEventListener("seeked", onSeek);
          r();
        };
        exportVideo.addEventListener("seeked", onSeek);
      });

      recorder.start(250);
      const trimDur = Math.max(0.1, trim.end - trim.start);
      const t0 = performance.now();

      // Render loop
      let stop = false;
      const renderLoop = () => {
        if (stop) return;
        cctx.drawImage(exportVideo, 0, 0, comp.width, comp.height);
        if (captions.length > 0) {
          const tNow = exportVideo.currentTime;
          const active = captions.find((c) => tNow >= c.start && tNow <= c.end);
          if (active) drawCaption(cctx, comp.width, comp.height, active.text, captionStyle);
        }
        const elapsed = (performance.now() - t0) / 1000;
        setExportProgress(Math.min(1, elapsed / trimDur));
        requestAnimationFrame(renderLoop);
      };
      requestAnimationFrame(renderLoop);

      await exportVideo.play();
      if (exportMusic) {
        exportMusic.currentTime = 0;
        exportMusic.play().catch(() => {});
      }

      // Wait for trim end
      await new Promise<void>((r) => {
        const check = () => {
          if (exportVideo.currentTime >= trim.end) {
            r();
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });

      stop = true;
      exportVideo.pause();
      exportMusic?.pause();
      recorder.stop();
      const blob = await finished;
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportProgress(1);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      try {
        if (audioCtx) await audioCtx.close();
      } catch {
        /* ignore */
      }
      try {
        exportVideo.pause();
        exportVideo.removeAttribute("src");
        exportVideo.load();
      } catch {
        /* ignore */
      }
      setExporting(false);
    }
  };

  const fmt = (t: number) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasCaptions = captions.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl overflow-y-auto p-0"
        style={{
          background: "var(--co-bg)",
          borderColor: "var(--co-border)",
          color: "var(--co-text)",
        }}
      >
        <SheetHeader
          className="px-6 pt-6 pb-4 border-b"
          style={{ borderColor: "var(--co-border)" }}
        >
          <SheetTitle
            className="font-display text-2xl tracking-wider"
            style={{ color: "var(--co-text)" }}
          >
            ✂️ EDITAR <span style={{ color: "var(--co-red)" }}>VÍDEO</span>
          </SheetTitle>
          {videoLabel && (
            <div className="text-[11px] font-mono-tech uppercase tracking-wider" style={labelStyle}>
              {videoLabel}
            </div>
          )}
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {/* PREVIEW */}
          <section className="relative rounded overflow-hidden" style={{ background: "#000", border: "1px solid var(--co-border)" }}>
            <div className="relative">
              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                onLoadedMetadata={onLoadedMeta}
                className="w-full max-h-[55vh] object-contain bg-black"
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: "contain" }}
              />
            </div>
            {music && <audio ref={musicRef} src={music.url} crossOrigin="anonymous" loop />}

            <div className="px-4 py-3 flex items-center gap-3 text-xs font-mono-tech" style={{ background: "var(--co-surface)" }}>
              <button
                type="button"
                onClick={togglePlay}
                className="px-3 py-1.5 rounded"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                {playing ? "❚❚ PAUSAR" : "▶ TOCAR"}
              </button>
              <span style={labelStyle}>
                {fmt(currentTime)} / {fmt(duration)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.05}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--co-red)]"
              />
            </div>
          </section>

          {/* TRIM */}
          <section>
            <div className="text-[11px] font-bold font-mono-tech uppercase tracking-widest mb-3" style={labelStyle}>
              ✂ Cortes — {fmt(trim.start)} → {fmt(trim.end)} ({fmt(Math.max(0, trim.end - trim.start))})
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-mono-tech mb-1" style={labelStyle}>INÍCIO</div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.05}
                  value={trim.start}
                  onChange={(e) => {
                    const v = Math.min(parseFloat(e.target.value), trim.end - 0.1);
                    setTrim((p) => ({ ...p, start: v }));
                    seekTo(v);
                  }}
                  className="w-full accent-[var(--co-red)]"
                />
              </div>
              <div>
                <div className="text-[10px] font-mono-tech mb-1" style={labelStyle}>FIM</div>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.05}
                  value={trim.end}
                  onChange={(e) => {
                    const v = Math.max(parseFloat(e.target.value), trim.start + 0.1);
                    setTrim((p) => ({ ...p, end: v }));
                  }}
                  className="w-full accent-[var(--co-red)]"
                />
              </div>
            </div>
          </section>

          {/* MUSIC */}
          <section>
            <div className="text-[11px] font-bold font-mono-tech uppercase tracking-widest mb-3" style={labelStyle}>
              🎵 Música de fundo
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMusic(null)}
                className="px-3 py-2 rounded text-xs"
                style={{
                  background: !music ? "color-mix(in oklab, var(--co-red) 8%, transparent)" : "var(--co-surface)",
                  border: !music ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                  color: "var(--co-text)",
                }}
              >
                <div className="font-mono-tech text-[10px]" style={labelStyle}>—</div>
                <div className="text-[12px]">Sem música</div>
              </button>
              {MUSIC_LIBRARY.map((m) => {
                const active = music?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMusic(m)}
                    className="px-3 py-2 rounded text-xs text-left"
                    style={{
                      background: active ? "color-mix(in oklab, var(--co-red) 8%, transparent)" : "var(--co-surface)",
                      border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                      color: "var(--co-text)",
                    }}
                  >
                    <div className="font-mono-tech text-[10px]" style={labelStyle}>{m.mood}</div>
                    <div className="text-[12px] truncate">{m.name}</div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-[10px] font-mono-tech mb-1" style={labelStyle}>VOZ {Math.round(voiceVolume * 100)}%</div>
                <input type="range" min={0} max={1} step={0.05} value={voiceVolume} onChange={(e) => setVoiceVolume(parseFloat(e.target.value))} className="w-full accent-[var(--co-red)]" />
              </div>
              <div>
                <div className="text-[10px] font-mono-tech mb-1" style={labelStyle}>MÚSICA {Math.round(musicVolume * 100)}%</div>
                <input type="range" min={0} max={1} step={0.05} value={musicVolume} onChange={(e) => setMusicVolume(parseFloat(e.target.value))} className="w-full accent-[var(--co-red)]" />
              </div>
            </div>
          </section>

          {/* CAPTIONS */}
          <section>
            <div className="text-[11px] font-bold font-mono-tech uppercase tracking-widest mb-3 flex items-center justify-between" style={labelStyle}>
              <span>💬 Legendas burn-in {hasCaptions ? `(${captions.length})` : ""}</span>
              <button
                type="button"
                onClick={transcribe}
                disabled={transcribing}
                className="text-[10px] font-mono-tech px-2 py-1 rounded"
                style={{
                  background: transcribing ? "var(--co-surface)" : "var(--co-red)",
                  color: "#fff",
                  opacity: transcribing ? 0.6 : 1,
                }}
              >
                {transcribing ? "TRANSCREVENDO..." : hasCaptions ? "REGENERAR" : "GERAR LEGENDAS"}
              </button>
            </div>
            {transcribeError && (
              <div className="px-3 py-2 rounded text-xs font-mono-tech mb-3" style={{ background: "color-mix(in oklab, var(--co-red) 10%, transparent)", border: "1px solid var(--co-red)", color: "var(--co-red)" }}>
                ⚠ {transcribeError}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(["tiktok", "minimal", "neon"] as CaptionStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCaptionStyle(s)}
                  className="px-3 py-2 rounded text-xs font-mono-tech uppercase"
                  style={{
                    background: captionStyle === s ? "color-mix(in oklab, var(--co-red) 8%, transparent)" : "var(--co-surface)",
                    border: captionStyle === s ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                    color: "var(--co-text)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* EXPORT */}
          <section className="pt-4 border-t" style={{ borderColor: "var(--co-border)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={exportEdited}
                disabled={exporting || !duration}
                className="px-5 py-3 rounded text-[12px] font-bold font-mono-tech tracking-wider uppercase"
                style={{
                  background: exporting ? "var(--co-surface)" : "var(--co-red)",
                  color: "#fff",
                  opacity: exporting || !duration ? 0.6 : 1,
                }}
              >
                {exporting ? `EXPORTANDO ${Math.round(exportProgress * 100)}%` : "⬇ EXPORTAR WEBM"}
              </button>
              {exportUrl && (
                <a
                  href={exportUrl}
                  download={`criativo-os-edit-${Date.now()}.webm`}
                  className="px-4 py-3 rounded text-[12px] font-bold font-mono-tech tracking-wider uppercase"
                  style={{ background: "var(--co-green)", color: "#000" }}
                >
                  ⬇ BAIXAR
                </a>
              )}
            </div>
            {exportError && (
              <div className="mt-3 px-3 py-2 rounded text-xs font-mono-tech" style={{ background: "color-mix(in oklab, var(--co-red) 10%, transparent)", border: "1px solid var(--co-red)", color: "var(--co-red)" }}>
                ⚠ {exportError}
              </div>
            )}
            <div className="mt-2 text-[10px] font-mono-tech" style={labelStyle}>
              Export client-side em WebM. O preview reproduz em tempo real para gravação — não feche a aba.
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  style: CaptionStyle,
) {
  const upper = text.toUpperCase();
  const fontSize = Math.round(h * 0.055);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const family =
    style === "minimal"
      ? "600 " + fontSize + "px 'DM Sans', system-ui, sans-serif"
      : "900 " + fontSize + "px 'Bebas Neue', Impact, sans-serif";
  ctx.font = family;

  const x = w / 2;
  const y = h * 0.82;
  const metrics = ctx.measureText(upper);
  const padX = fontSize * 0.6;
  const padY = fontSize * 0.35;
  const boxW = metrics.width + padX * 2;
  const boxH = fontSize + padY * 2;

  if (style === "tiktok") {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    roundRect(ctx, x - boxW / 2, y - boxH / 2, boxW, boxH, fontSize * 0.2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(upper, x, y);
  } else if (style === "minimal") {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(text, x, y);
    ctx.lineWidth = Math.max(2, fontSize * 0.06);
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(text, x, y);
  } else if (style === "neon") {
    ctx.shadowColor = "rgba(255,40,40,0.95)";
    ctx.shadowBlur = fontSize * 0.6;
    ctx.fillStyle = "#ff2a2a";
    ctx.fillText(upper, x, y);
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(2, fontSize * 0.05);
    ctx.strokeStyle = "#fff";
    ctx.strokeText(upper, x, y);
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
