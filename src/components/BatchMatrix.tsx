import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  HeygenAvatar,
  HeygenRatio,
  HeygenResolution,
  HeygenVideoStatus,
  HeygenVoice,
} from "@/lib/heygen-types";
import { useHeygenAssets } from "@/hooks/use-heygen-assets";
import type { Script } from "@/lib/criativo-types";
import {
  jobsToCsv,
  newBatchId,
  saveBatch,
  type BatchJob,
} from "@/lib/batch-storage";
import { hashScripts } from "@/lib/video-storage";
import { VideoEditor } from "@/components/VideoEditor";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scripts: Script[];
};

const MAX_CONCURRENT = 3;

function buildScriptText(s: Script): string {
  const raw = [s.hook, s.agitacao, s.virada, s.prova, s.cta]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return raw.length <= 1500 ? raw : raw.slice(0, 1500);
}

export function BatchMatrix({ open, onOpenChange, scripts }: Props) {
  const { avatars, voices, loading: loadingMeta, error: metaError } =
    useHeygenAssets(open);

  // Selections
  const [selScripts, setSelScripts] = useState<Set<number>>(new Set());
  const [selAvatars, setSelAvatars] = useState<Set<string>>(new Set());
  const [selVoices, setSelVoices] = useState<Set<string>>(new Set());
  const [ratio, setRatio] = useState<HeygenRatio>("9:16");
  const [resolution, setResolution] = useState<HeygenResolution>("1080p");
  const [avatarQuery, setAvatarQuery] = useState("");

  // Filter UI in results view
  const [filterScript, setFilterScript] = useState<string>("all");
  const [filterAvatar, setFilterAvatar] = useState<string>("all");
  const [filterVoice, setFilterVoice] = useState<string>("all");

  const [phase, setPhase] = useState<"select" | "running" | "done">("select");
  const [batchId, setBatchId] = useState<string>("");
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const jobsRef = useRef<BatchJob[]>([]);
  jobsRef.current = jobs;


  // Reset state when reopening
  useEffect(() => {
    if (!open) return;
    setPhase("select");
    setJobs([]);
    setBatchId("");
    setSelScripts(new Set());
    setSelAvatars(new Set());
    setSelVoices(new Set());
    setAvatarQuery("");
    setFilterScript("all");
    setFilterAvatar("all");
    setFilterVoice("all");
  }, [open]);

  const totalCombos =
    selScripts.size * selAvatars.size * selVoices.size;

  const filteredAvatars = useMemo(
    () =>
      avatars.filter((a) =>
        avatarQuery.trim()
          ? a.avatar_name.toLowerCase().includes(avatarQuery.trim().toLowerCase())
          : true,
      ),
    [avatars, avatarQuery],
  );

  const toggle = <T,>(set: Set<T>, val: T): Set<T> => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    return next;
  };

  // Build job list and start
  const startBatch = () => {
    if (totalCombos === 0) return;
    const builtJobs: BatchJob[] = [];
    for (const si of selScripts) {
      const s = scripts[si];
      if (!s) continue;
      for (const aid of selAvatars) {
        const a = avatars.find((x) => x.avatar_id === aid);
        for (const vid of selVoices) {
          const v = voices.find((x) => x.voice_id === vid);
          builtJobs.push({
            id: `${si}-${aid}-${vid}-${Math.random().toString(36).slice(2, 6)}`,
            scriptIndex: si,
            scriptLabel: s.angulo || `Script #${si + 1}`,
            avatarId: aid,
            avatarName: a?.avatar_name ?? aid,
            voiceId: vid,
            voiceName: v?.name ?? vid,
            ratio,
            resolution,
            status: "queued",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    const id = newBatchId();
    setBatchId(id);
    setJobs(builtJobs);
    setPhase("running");
  };

  // Persist batch on changes (running/done)
  useEffect(() => {
    if (!batchId || phase === "select") return;
    saveBatch({
      id: batchId,
      name: `Batch ${new Date().toLocaleString("pt-BR")}`,
      scriptsHash: hashScripts(scripts),
      createdAt: new Date().toISOString(),
      jobs,
    });
  }, [batchId, jobs, phase, scripts]);

  // Job runner: keep MAX_CONCURRENT jobs in flight
  useEffect(() => {
    if (phase !== "running") return;

    const runJob = async (jobId: string) => {
      const start = (status: BatchJob["status"], patch: Partial<BatchJob> = {}) =>
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status, ...patch } : j)),
        );

      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;
      const s = scripts[job.scriptIndex];
      if (!s) {
        start("failed", { error: "Script não encontrado." });
        return;
      }
      start("generating");
      try {
        const res = await apiFetch("/api/public/heygen/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            avatar_id: job.avatarId,
            voice_id: job.voiceId,
            text: buildScriptText(s),
            speed: 0.92,
            ratio: job.ratio,
            resolution: job.resolution,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          start("failed", { error: json.error || `Erro (${res.status}).` });
          return;
        }
        const vId = json.video_id as string;
        start("polling", { videoId: vId });

        const t0 = Date.now();
        while (true) {
          await new Promise((r) => setTimeout(r, 5000));
          if (Date.now() - t0 > 5 * 60 * 1000) {
            start("failed", { error: "Timeout (>5min)" });
            return;
          }
          const sRes = await apiFetch(
            `/api/public/heygen/status/${encodeURIComponent(vId)}`,
          );
          const sJson = (await sRes.json()) as HeygenVideoStatus & {
            error?: string;
          };
          if (!sRes.ok) {
            start("failed", { error: sJson.error || "Erro de status." });
            return;
          }
          if (sJson.status === "completed" && sJson.video_url) {
            start("done", {
              video: {
                videoId: vId,
                videoUrl: sJson.video_url,
                generatedAt: new Date().toISOString(),
              },
            });
            return;
          }
          if (sJson.status === "failed") {
            start("failed", { error: sJson.error || "Render falhou." });
            return;
          }
        }
      } catch (e) {
        start("failed", { error: e instanceof Error ? e.message : String(e) });
      }
    };

    // Schedule next queued jobs up to MAX_CONCURRENT
    const inflight = jobs.filter(
      (j) => j.status === "generating" || j.status === "polling",
    ).length;
    const slots = MAX_CONCURRENT - inflight;
    if (slots <= 0) return;
    const queued = jobs.filter((j) => j.status === "queued").slice(0, slots);
    if (queued.length === 0) {
      // All finished?
      const anyActive = jobs.some(
        (j) => j.status === "queued" || j.status === "generating" || j.status === "polling",
      );
      if (!anyActive && jobs.length > 0) setPhase("done");
      return;
    }
    for (const q of queued) runJob(q.id);
  }, [phase, jobs, scripts]);

  const toggleWinner = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, winner: !j.winner } : j)),
    );
  };

  const downloadCsv = () => {
    const csv = jobsToCsv(jobs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleJobs = jobs.filter((j) => {
    if (filterScript !== "all" && String(j.scriptIndex) !== filterScript) return false;
    if (filterAvatar !== "all" && j.avatarId !== filterAvatar) return false;
    if (filterVoice !== "all" && j.voiceId !== filterVoice) return false;
    return true;
  });

  const counts = {
    done: jobs.filter((j) => j.status === "done").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    active: jobs.filter(
      (j) => j.status === "generating" || j.status === "polling",
    ).length,
    queued: jobs.filter((j) => j.status === "queued").length,
  };

  const labelStyle: React.CSSProperties = { color: "var(--co-text-dim)" };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto p-0"
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
            🎬 GERAR EM <span style={{ color: "var(--co-red)" }}>LOTE</span>
          </SheetTitle>
          <div
            className="text-[11px] font-mono uppercase tracking-wider mt-1"
            style={labelStyle}
          >
            {phase === "select" && "Marque scripts × avatares × vozes"}
            {phase === "running" &&
              `${counts.done + counts.failed}/${jobs.length} • ativos: ${counts.active} • fila: ${counts.queued}`}
            {phase === "done" &&
              `Concluído: ${counts.done} ok • ${counts.failed} falhas`}
          </div>
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

          {phase === "select" && (
            <>
              {/* SCRIPTS */}
              <section>
                <div
                  className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3 flex items-center justify-between"
                  style={labelStyle}
                >
                  <span>Scripts ({selScripts.size}/{scripts.length})</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelScripts(
                        selScripts.size === scripts.length
                          ? new Set()
                          : new Set(scripts.map((_, i) => i)),
                      )
                    }
                    className="text-[10px] font-mono"
                    style={{ color: "var(--co-red)" }}
                  >
                    {selScripts.size === scripts.length ? "limpar" : "todos"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {scripts.map((s, i) => {
                    const active = selScripts.has(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelScripts(toggle(selScripts, i))}
                        className="text-left px-3 py-2.5 rounded text-xs"
                        style={{
                          border: active
                            ? "1px solid var(--co-red)"
                            : "1px solid var(--co-border)",
                          background: active
                            ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                            : "var(--co-surface)",
                          color: "var(--co-text)",
                        }}
                      >
                        <div className="font-mono text-[10px]" style={labelStyle}>
                          #{i + 1} • {s.duracao || "—"}
                        </div>
                        <div className="truncate text-[12px]">
                          {s.angulo || s.hook?.slice(0, 60) || "—"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* AVATARS */}
              <section>
                <div
                  className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3 flex items-center justify-between"
                  style={labelStyle}
                >
                  <span>Avatares ({selAvatars.size})</span>
                  <button
                    type="button"
                    onClick={() => setSelAvatars(new Set())}
                    className="text-[10px] font-mono"
                    style={{ color: "var(--co-red)" }}
                  >
                    limpar
                  </button>
                </div>
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
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredAvatars.map((a) => {
                    const active = selAvatars.has(a.avatar_id);
                    return (
                      <button
                        key={a.avatar_id}
                        type="button"
                        onClick={() =>
                          setSelAvatars(toggle(selAvatars, a.avatar_id))
                        }
                        className="rounded overflow-hidden text-left"
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
                          className="px-2 py-1 text-[9px] font-mono truncate"
                          style={{
                            color: active ? "var(--co-red)" : "var(--co-text-dim)",
                          }}
                        >
                          {a.avatar_name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* VOICES */}
              <section>
                <div
                  className="text-[11px] font-bold font-mono uppercase tracking-widest mb-3 flex items-center justify-between"
                  style={labelStyle}
                >
                  <span>Vozes ({selVoices.size})</span>
                  <button
                    type="button"
                    onClick={() => setSelVoices(new Set())}
                    className="text-[10px] font-mono"
                    style={{ color: "var(--co-red)" }}
                  >
                    limpar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {voices.map((v) => {
                    const active = selVoices.has(v.voice_id);
                    return (
                      <button
                        key={v.voice_id}
                        type="button"
                        onClick={() =>
                          setSelVoices(toggle(selVoices, v.voice_id))
                        }
                        className="text-left px-3 py-2 rounded"
                        style={{
                          border: active
                            ? "1px solid var(--co-red)"
                            : "1px solid var(--co-border)",
                          background: active
                            ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                            : "var(--co-surface)",
                        }}
                      >
                        <div className="text-[12px]" style={{ color: "var(--co-text)" }}>
                          {v.name}
                        </div>
                        <div
                          className="text-[10px] font-mono uppercase"
                          style={labelStyle}
                        >
                          {v.gender}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* CONFIG */}
              <section className="grid grid-cols-2 gap-3">
                <div>
                  <div
                    className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2"
                    style={labelStyle}
                  >
                    Proporção
                  </div>
                  <div className="flex gap-1.5">
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
                            border: active
                              ? "1px solid var(--co-red)"
                              : "1px solid var(--co-border)",
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
                  <div
                    className="text-[11px] font-bold font-mono uppercase tracking-widest mb-2"
                    style={labelStyle}
                  >
                    Resolução
                  </div>
                  <div className="flex gap-1.5">
                    {(["720p", "1080p"] as const).map((r) => {
                      const active = resolution === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setResolution(r)}
                          className="flex-1 py-2 rounded text-xs font-mono"
                          style={{
                            background: active ? "var(--co-red)" : "transparent",
                            border: active
                              ? "1px solid var(--co-red)"
                              : "1px solid var(--co-border)",
                            color: active ? "#fff" : "var(--co-text-dim)",
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* CTA */}
              <div
                className="rounded p-4 flex items-center justify-between"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border)",
                }}
              >
                <div>
                  <div
                    className="text-[10px] font-mono uppercase tracking-widest"
                    style={labelStyle}
                  >
                    Total a gerar
                  </div>
                  <div
                    className="font-display text-3xl"
                    style={{ color: totalCombos > 0 ? "var(--co-red)" : "var(--co-text-dim)" }}
                  >
                    {totalCombos} <span className="text-sm font-mono">vídeo{totalCombos === 1 ? "" : "s"}</span>
                  </div>
                  <div
                    className="text-[10px] font-mono"
                    style={labelStyle}
                  >
                    {selScripts.size} script · {selAvatars.size} avatar · {selVoices.size} voz · max 3 simultâneos
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startBatch}
                  disabled={totalCombos === 0}
                  className="px-6 py-3 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-40"
                  style={{ background: "var(--co-red)", color: "#fff" }}
                >
                  ⚡ INICIAR LOTE
                </button>
              </div>
            </>
          )}

          {(phase === "running" || phase === "done") && (
            <>
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <SelectFilter
                  label="Script"
                  value={filterScript}
                  onChange={setFilterScript}
                  options={[
                    { v: "all", l: "Todos" },
                    ...Array.from(selScripts).map((i) => ({
                      v: String(i),
                      l: scripts[i]?.angulo || `#${i + 1}`,
                    })),
                  ]}
                />
                <SelectFilter
                  label="Avatar"
                  value={filterAvatar}
                  onChange={setFilterAvatar}
                  options={[
                    { v: "all", l: "Todos" },
                    ...Array.from(selAvatars).map((id) => ({
                      v: id,
                      l: avatars.find((a) => a.avatar_id === id)?.avatar_name || id,
                    })),
                  ]}
                />
                <SelectFilter
                  label="Voz"
                  value={filterVoice}
                  onChange={setFilterVoice}
                  options={[
                    { v: "all", l: "Todas" },
                    ...Array.from(selVoices).map((id) => ({
                      v: id,
                      l: voices.find((v) => v.voice_id === id)?.name || id,
                    })),
                  ]}
                />
              </div>

              {phase === "done" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="px-4 py-2 rounded text-xs font-mono uppercase tracking-wider"
                    style={{
                      border: "1px solid var(--co-border)",
                      color: "var(--co-text)",
                    }}
                  >
                    ⬇ EXPORTAR CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("select")}
                    className="px-4 py-2 rounded text-xs font-mono uppercase tracking-wider"
                    style={{
                      border: "1px solid var(--co-border)",
                      color: "var(--co-text-dim)",
                    }}
                  >
                    + NOVO LOTE
                  </button>
                </div>
              )}

              {/* Results grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleJobs.map((j) => (
                  <JobCard key={j.id} job={j} onWinner={() => toggleWinner(j.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block">
      <span
        className="text-[10px] font-mono uppercase tracking-widest block mb-1"
        style={{ color: "var(--co-text-dim)" }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 rounded text-xs font-mono"
        style={{
          background: "var(--co-surface)",
          border: "1px solid var(--co-border)",
          color: "var(--co-text)",
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function JobCard({ job, onWinner }: { job: BatchJob; onWinner: () => void }) {
  const statusColor: Record<BatchJob["status"], string> = {
    queued: "var(--co-text-dim)",
    generating: "var(--co-blue, #58a6ff)",
    polling: "var(--co-orange, #f0883e)",
    done: "var(--co-green, #3fb950)",
    failed: "var(--co-red)",
  };
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <div
      className="rounded overflow-hidden"
      style={{
        background: "var(--co-surface)",
        border: job.winner
          ? "2px solid var(--co-red)"
          : "1px solid var(--co-border)",
      }}
    >
      <div className="aspect-[9/16] bg-black flex items-center justify-center relative">
        {job.video?.videoUrl ? (
          <video
            src={job.video.videoUrl}
            controls
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <div
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{ color: statusColor[job.status] }}
            >
              {job.status === "queued" && "fila…"}
              {job.status === "generating" && "gerando…"}
              {job.status === "polling" && "renderizando…"}
              {job.status === "failed" && "FALHOU"}
            </div>
            {job.error && (
              <div
                className="text-[10px] font-mono mt-2 px-3"
                style={{ color: "var(--co-red)" }}
              >
                {job.error.slice(0, 80)}
              </div>
            )}
          </div>
        )}
        {job.status === "done" && (
          <button
            type="button"
            onClick={onWinner}
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: job.winner ? "var(--co-red)" : "rgba(0,0,0,0.6)",
              color: "#fff",
            }}
            title={job.winner ? "Desmarcar vencedor" : "Marcar vencedor"}
          >
            ★
          </button>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <div className="text-[11px] truncate" style={{ color: "var(--co-text)" }}>
          {job.scriptLabel}
        </div>
        <div
          className="text-[10px] font-mono truncate"
          style={{ color: "var(--co-text-dim)" }}
        >
          {job.avatarName} · {job.voiceName}
        </div>
        <div
          className="text-[9px] font-mono uppercase"
          style={{ color: statusColor[job.status] }}
        >
          {job.status} · {job.ratio} · {job.resolution}
        </div>
        {job.status === "done" && job.video?.videoUrl && (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="mt-1 w-full px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            ✂️ EDITAR
          </button>
        )}
      </div>
      {job.video?.videoUrl && (
        <VideoEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          videoUrl={job.video.videoUrl}
          videoLabel={`${job.scriptLabel} — ${job.avatarName}`}
        />
      )}
    </div>
  );
}
