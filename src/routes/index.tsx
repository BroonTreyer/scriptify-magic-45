import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { extractJson } from "@/server/generate-scripts";
import type {
  Analise,
  BriefingInput,
  GenerateResult,
  GuiaProducao,
  Script,
} from "@/lib/criativo-types";
import type { GeneratedVideo } from "@/lib/heygen-types";
import { HeygenDrawer } from "@/components/HeygenDrawer";
import { hashScripts, loadVideos, saveVideos } from "@/lib/video-storage";
import { BriefingHistorySheet } from "@/components/BriefingHistorySheet";
import { saveBriefing, type SavedBriefing } from "@/lib/briefing-storage";
import { UrlExtractor } from "@/components/UrlExtractor";
import { BatchMatrix } from "@/components/BatchMatrix";
import { UGCStudio } from "@/components/UGCStudio";
import { VideoEditor } from "@/components/VideoEditor";
import {
  LANGUAGES,
  loadTranslations,
  saveTranslations,
  type LanguageCode,
  type TranslationMap,
} from "@/lib/translation-storage";

export const Route = createFileRoute("/")({
  component: CriativoOS,
  head: () => ({
    meta: [
      { title: "CriativoOS — Scripts que param o scroll e vendem" },
      {
        name: "description",
        content:
          "Sistema com IA Claude para gerar scripts publicitários de alta conversão para Meta Ads, TikTok e YouTube — com análise estratégica e guia de produção HeyGen.",
      },
    ],
  }),
});

type Step = "briefing" | "analise" | "scripts" | "producao";
const STEPS: Step[] = ["briefing", "analise", "scripts", "producao"];
const STEP_LABELS: Record<Step, string> = {
  briefing: "Briefing",
  analise: "Análise",
  scripts: "Scripts",
  producao: "Produção",
};

const TOM_OPTIONS = ["Agressivo / Urgência", "Emocional", "Educativo", "Humor / Provocação"];
const DURACAO_OPTIONS = ["30 segundos", "60 segundos", "90 segundos"];
const PLATAFORMA_OPTIONS = [
  "Meta Ads (Feed)",
  "Meta Ads (Stories/Reels)",
  "TikTok Ads",
  "YouTube Ads",
];

const LOADING_MSGS = [
  "Analisando o público e mapeando dores...",
  "Construindo análise estratégica...",
  "Gerando hooks que param o scroll...",
  "Refinando scripts para máxima conversão...",
  "Montando guia de produção HeyGen...",
];

function formatScript(s: Script): string {
  return [
    `HOOK (0–3s):`,
    s.hook ?? "",
    ``,
    `AGITAÇÃO (3–15s):`,
    s.agitacao ?? "",
    ``,
    `VIRADA (15–20s):`,
    s.virada ?? "",
    ``,
    `PROVA (20–35s):`,
    s.prova ?? "",
    ``,
    `CTA (últimos 5s):`,
    s.cta ?? "",
    ``,
    `ÂNGULO: ${s.angulo ?? ""}`,
    `NOTA ESTRATÉGICA: ${s.estrategia ?? ""}`,
  ].join("\n");
}

function formatAllScripts(scripts: Script[]): string {
  return scripts
    .map((s, i) => `#${i + 1}\n\n${formatScript(s)}`)
    .join("\n\n---\n\n");
}

function ProgressBar({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-2 sm:gap-4 mb-12">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} className="flex items-center gap-2 sm:gap-4 flex-1">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono-tech shrink-0 transition-colors"
                style={{
                  background: done || active ? "var(--co-red)" : "transparent",
                  border:
                    done || active
                      ? "1px solid var(--co-red)"
                      : "1px solid var(--co-border)",
                  color: done || active ? "#fff" : "var(--co-text-dim)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="text-[11px] uppercase tracking-wider font-mono-tech hidden sm:inline"
                style={{ color: active ? "var(--co-text)" : "var(--co-text-dim)" }}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px"
                style={{ background: done ? "var(--co-red)" : "var(--co-border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((d) => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono-tech" style={{ color: "var(--co-red)" }}>
      {"●".repeat(n)}
      {"○".repeat(3 - n)}
    </span>
  );
}

type FieldProps = {
  label: string;
  name: keyof BriefingInput;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label
      className="block mb-2 text-[11px] font-bold uppercase tracking-wider font-mono-tech"
      style={{ color: "var(--co-text-muted)" }}
    >
      {label} {required && <span style={{ color: "var(--co-red)" }}>*</span>}
    </label>
  );
}

function TextField({ label, name, value, onChange, placeholder, required, rows }: FieldProps) {
  const common = {
    name,
    value,
    onChange,
    placeholder,
    className:
      "w-full rounded font-sans text-sm outline-none transition-colors px-4 py-3.5",
    style: {
      background: "var(--co-surface)",
      border: "1px solid var(--co-border)",
      color: "var(--co-text)",
    } as React.CSSProperties,
    onFocus: (e: React.FocusEvent<HTMLElement>) =>
      ((e.currentTarget as HTMLElement).style.borderColor = "var(--co-red)"),
    onBlur: (e: React.FocusEvent<HTMLElement>) =>
      ((e.currentTarget as HTMLElement).style.borderColor = "var(--co-border)"),
  };
  return (
    <div className="mb-5">
      <FieldLabel label={label} required={required} />
      {rows ? (
        <textarea {...common} rows={rows} style={{ ...common.style, resize: "vertical" }} />
      ) : (
        <input {...common} type="text" />
      )}
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-5">
      <FieldLabel label={label} />
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className="px-4 py-2 rounded-sm text-[13px] font-medium transition-all"
              style={{
                background: active ? "var(--co-red)" : "transparent",
                border: active ? "1px solid var(--co-red)" : "1px solid var(--co-border)",
                color: active ? "#fff" : "var(--co-text-dim)",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScriptCard({
  script,
  index,
  onProduce,
  generatedVideo,
  translations,
  onTranslate,
}: {
  script: Script;
  index: number;
  onProduce: (i: number, override?: Script) => void;
  generatedVideo?: GeneratedVideo;
  translations: Partial<Record<LanguageCode, Script>>;
  onTranslate: (i: number, lang: LanguageCode) => Promise<void>;
}) {
  return (
    <ScriptCardImpl
      script={script}
      index={index}
      onProduce={onProduce}
      generatedVideo={generatedVideo}
      translations={translations}
      onTranslate={onTranslate}
    />
  );
}

function CopyAllButton({ scripts }: { scripts: Script[] }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(formatAllScripts(scripts));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="w-full mb-4 py-3 rounded text-[12px] font-bold font-mono-tech tracking-wider uppercase transition-colors"
      style={{
        background: copied
          ? "color-mix(in oklab, var(--co-green) 12%, transparent)"
          : "transparent",
        border: copied
          ? "1px solid var(--co-green)"
          : "1px solid var(--co-border-strong)",
        color: copied ? "var(--co-green)" : "var(--co-text)",
      }}
    >
      {copied ? "✓ TODOS COPIADOS" : `📋 COPIAR TODOS OS ${scripts.length} SCRIPTS`}
    </button>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScriptCardImpl({
  script,
  index,
  onProduce,
  generatedVideo,
  translations,
  onTranslate,
}: {
  script: Script;
  index: number;
  onProduce: (i: number, override?: Script) => void;
  generatedVideo?: GeneratedVideo;
  translations: Partial<Record<LanguageCode, Script>>;
  onTranslate: (i: number, lang: LanguageCode) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [copied, setCopied] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<LanguageCode>("pt");
  const [translatingLang, setTranslatingLang] = useState<LanguageCode | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const activeScript: Script = activeLang === "pt" ? script : translations[activeLang] ?? script;

  const handleTranslate = async (lang: LanguageCode) => {
    if (lang === "pt") {
      setActiveLang("pt");
      return;
    }
    if (translations[lang]) {
      setActiveLang(lang);
      return;
    }
    setTranslatingLang(lang);
    setTranslateError(null);
    try {
      await onTranslate(index, lang);
      setActiveLang(lang);
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : String(e));
    } finally {
      setTranslatingLang(null);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(formatScript(activeScript));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Section = ({
    label,
    text,
    color,
    emphasized,
  }: {
    label: string;
    text?: string;
    color: string;
    emphasized?: boolean;
  }) => {
    if (!text) return null;
    return (
      <div className="mb-5">
        <div
          className="inline-block px-2.5 py-1 rounded-sm mb-2.5 text-[10px] font-bold uppercase tracking-wider font-mono-tech"
          style={{
            background: `color-mix(in oklab, ${color} 10%, transparent)`,
            border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
            color: color,
          }}
        >
          {label}
        </div>
        <p
          className={`text-sm leading-relaxed m-0 ${emphasized ? "italic" : ""}`}
          style={{
            color: emphasized ? "var(--co-text)" : "color-mix(in oklab, var(--co-text) 80%, transparent)",
            fontSize: emphasized ? "15px" : "14px",
            fontWeight: emphasized ? 500 : 400,
          }}
        >
          {emphasized ? `"${text}"` : text}
        </p>
      </div>
    );
  };

  return (
    <div
      className="rounded-md mb-4 overflow-hidden transition-colors"
      style={{ border: "1px solid var(--co-border)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer text-left"
        style={{ background: expanded ? "var(--co-surface)" : "transparent" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono-tech shrink-0"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            {index + 1}
          </span>
          <div>
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--co-text)" }}>
              {script.angulo || `Script ${index + 1}`}
            </div>
            <div className="text-xs font-mono-tech" style={{ color: "var(--co-text-dim)" }}>
              {script.nivel_consciencia || ""}
              {script.duracao ? ` · ${script.duracao}` : ""}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 items-center">
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            className="px-3.5 py-1.5 rounded-sm text-[11px] cursor-pointer font-mono-tech transition-colors"
            style={{
              background: "transparent",
              border: "1px solid var(--co-border-strong)",
              color: copied ? "var(--co-green)" : "var(--co-text-dim)",
            }}
          >
            {copied ? "✓ COPIADO" : "COPIAR"}
          </span>
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onProduce(index, activeScript);
            }}
            className="px-3.5 py-1.5 rounded-sm text-[11px] cursor-pointer font-mono-tech transition-colors"
            style={{
              background: "var(--co-red)",
              border: "1px solid var(--co-red)",
              color: "#fff",
            }}
          >
            🎬 PRODUZIR{activeLang !== "pt" ? ` ${LANGUAGES.find((l) => l.code === activeLang)?.flag}` : ""}
          </span>
          <span
            className="text-base transition-transform"
            style={{
              color: "var(--co-text-dim)",
              transform: expanded ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5" style={{ background: "var(--co-surface)" }}>
          <div className="h-px mb-5" style={{ background: "var(--co-border)" }} />
          {generatedVideo && (
            <div
              className="mb-5 px-4 py-3 rounded flex items-center justify-between gap-3 flex-wrap"
              style={{
                background: "color-mix(in oklab, var(--co-green) 10%, transparent)",
                border: "1px solid var(--co-green)",
              }}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-bold font-mono-tech uppercase tracking-wider" style={{ color: "var(--co-green)" }}>
                  ✓ VÍDEO GERADO
                </span>
                <span className="text-[11px] font-mono-tech" style={{ color: "var(--co-text-dim)" }}>
                  {formatRelative(generatedVideo.generatedAt)}
                </span>
              </div>
              <a
                href={generatedVideo.videoUrl}
                download={`heygen-${generatedVideo.videoId}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono-tech px-3 py-1.5 rounded"
                style={{ background: "var(--co-green)", color: "#000" }}
              >
                ⬇ BAIXAR
              </a>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="text-[11px] font-mono-tech px-3 py-1.5 rounded"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                ✂️ EDITAR
              </button>
            </div>
          )}
          {/* Language tabs */}
          <div className="mb-5 -mx-1 flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => {
              const active = activeLang === l.code;
              const has = l.code === "pt" || !!translations[l.code];
              const isLoading = translatingLang === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleTranslate(l.code)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-sm text-[10px] font-mono-tech uppercase tracking-wider transition-colors"
                  style={{
                    background: active
                      ? "var(--co-red)"
                      : has
                        ? "color-mix(in oklab, var(--co-red) 8%, transparent)"
                        : "transparent",
                    border: active
                      ? "1px solid var(--co-red)"
                      : "1px solid var(--co-border)",
                    color: active ? "#fff" : has ? "var(--co-red)" : "var(--co-text-dim)",
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  title={l.label}
                >
                  {l.flag} {l.code.toUpperCase()}
                  {isLoading && " …"}
                  {!has && !isLoading && l.code !== "pt" && " 🌍"}
                </button>
              );
            })}
          </div>
          {translateError && (
            <div
              className="mb-4 px-3 py-2 rounded text-[11px] font-mono-tech"
              style={{
                background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              ⚠ {translateError}
            </div>
          )}
          <Section label="▶ HOOK — 0 a 3s" text={activeScript.hook} color="var(--co-red)" emphasized />
          <Section label="● AGITAÇÃO — 3 a 15s" text={activeScript.agitacao} color="var(--co-orange)" />
          <Section label="↗ VIRADA — 15 a 20s" text={activeScript.virada} color="var(--co-green)" />
          <Section label="✦ PROVA — 20 a 35s" text={activeScript.prova} color="var(--co-blue)" />
          <Section label="⚡ CTA — ÚLTIMOS 5s" text={activeScript.cta} color="var(--co-red)" emphasized />

          {script.estrategia && (
            <div
              className="mt-5 p-4 rounded"
              style={{
                background: "color-mix(in oklab, var(--co-bg) 60%, transparent)",
                border: "1px solid var(--co-border)",
              }}
            >
              <div
                className="text-[10px] font-bold font-mono-tech tracking-wider uppercase mb-2"
                style={{ color: "var(--co-text-dim)" }}
              >
                💡 Nota Estratégica
              </div>
              <p className="text-[13px] leading-relaxed m-0" style={{ color: "var(--co-text-muted)" }}>
                {script.estrategia}
              </p>
            </div>
          )}
        </div>
      )}
      {generatedVideo && (
        <VideoEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          videoUrl={generatedVideo.videoUrl}
          videoLabel={`Script #${index + 1} — ${script.angulo || ""}`}
        />
      )}
    </div>
  );
}

function CriativoOS() {
  const [step, setStep] = useState<Step>("briefing");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [guiaProducao, setGuiaProducao] = useState<GuiaProducao | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [producingIndex, setProducingIndex] = useState<number | null>(null);
  const [producingScript, setProducingScript] = useState<Script | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<Record<number, GeneratedVideo>>({});
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [ugcOpen, setUgcOpen] = useState(false);

  const sessionKey = useMemo(
    () => (scripts.length ? hashScripts(scripts) : null),
    [scripts],
  );

  // Load persisted videos when the script set changes
  useEffect(() => {
    if (!sessionKey) {
      setGeneratedVideos({});
      return;
    }
    setGeneratedVideos(loadVideos(sessionKey));
  }, [sessionKey]);

  // Persist videos whenever they change
  useEffect(() => {
    if (!sessionKey) return;
    saveVideos(sessionKey, generatedVideos);
  }, [sessionKey, generatedVideos]);

  const [form, setForm] = useState<BriefingInput>({
    produto: "",
    url: "",
    publico: "",
    dor: "",
    transformacao: "",
    prova: "",
    tom: "Agressivo / Urgência",
    duracao: "60 segundos",
    plataforma: "Meta Ads (Stories/Reels)",
    concorrente: "",
    numScripts: "5",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const gerar = async () => {
    if (!form.produto || !form.publico || !form.dor || !form.transformacao) {
      setError("Preencha os campos obrigatórios marcados com *");
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingMsg(LOADING_MSGS[0]);

    let mi = 0;
    const msgInterval = setInterval(() => {
      mi = (mi + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[mi]);
    }, 2500);

    setStreamingText("");

    try {
      const res = await fetch("/api/public/generate-scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefing: form }),
      });

      if (!res.ok || !res.body) {
        let msg = `Erro (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* noop */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Prefilled with "{" on the server side
      let fullText = "{";
      let stopReason: string | null = null;
      let sawMessageStop = false;
      let receivedAnyContent = false;
      setStreamingText(fullText);

      const processEvent = (block: string) => {
        // An SSE event block can have multiple lines like "event: ..." and "data: ..."
        const dataLines = block
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) return;
        const payload = dataLines.join("");
        if (!payload || payload === "[DONE]") return;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string; stop_reason?: string };
          };
          if (evt.type === "content_block_delta" && evt.delta?.text) {
            fullText += evt.delta.text;
            receivedAnyContent = true;
            setStreamingText(fullText);
          } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
            stopReason = evt.delta.stop_reason;
          } else if (evt.type === "message_stop") {
            sawMessageStop = true;
          }
        } catch {
          /* ignore non-JSON keepalives */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Split by complete SSE event blocks (separated by blank line)
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) processEvent(block);
      }
      // Flush any remaining bytes from the decoder + final buffered block
      buffer += decoder.decode();
      if (buffer.trim().length > 0) processEvent(buffer);

      if (stopReason === "max_tokens") {
        throw new Error(
          "Claude atingiu o limite de tokens. Tente reduzir para 3 scripts e gerar de novo.",
        );
      }

      if (!receivedAnyContent) {
        throw new Error(
          "A conexão com o Claude foi interrompida antes de qualquer resposta. Tente novamente.",
        );
      }

      if (!sawMessageStop) {
        throw new Error(
          "A conexão com o Claude foi interrompida antes do fim da resposta. Tente novamente.",
        );
      }

      let parsed: {
        analise: Analise;
        scripts: Script[];
        guia_producao: GuiaProducao;
      };
      try {
        parsed = JSON.parse(extractJson(fullText));
      } catch {
        throw new Error(
          "Claude retornou JSON inválido. Tente novamente.",
        );
      }

      const a = (parsed.analise ?? {}) as Partial<Analise>;
      const g = (parsed.guia_producao ?? {}) as Partial<GuiaProducao>;
      const rawScripts = Array.isArray(parsed.scripts) ? parsed.scripts : [];

      const filledAnalise: Analise = {
        momento_de_vida: a.momento_de_vida ?? "",
        conversa_interna: a.conversa_interna ?? "",
        vergonha_oculta: a.vergonha_oculta ?? "",
        desejo_real: a.desejo_real ?? "",
        objecao_principal: a.objecao_principal ?? "",
      };
      const filledGuia: GuiaProducao = {
        perfil_avatar: g.perfil_avatar ?? "",
        voz: g.voz ?? "",
        visual: g.visual ?? "",
        edicao: g.edicao ?? "",
        checklist: Array.isArray(g.checklist) ? g.checklist : [],
      };

      if (rawScripts.length === 0) {
        throw new Error(
          "Claude não retornou nenhum script. Tente novamente.",
        );
      }

      setAnalise(filledAnalise);
      setScripts(rawScripts);
      setGuiaProducao(filledGuia);
      setStep("analise");

      const result: GenerateResult = {
        analise: filledAnalise,
        scripts: rawScripts,
        guiaProducao: filledGuia,
      };
      try {
        saveBriefing(form, result);
      } catch {
        /* ignore storage errors */
      }

      const partial =
        !a.momento_de_vida ||
        !g.perfil_avatar ||
        rawScripts.some((s) => !s?.hook || !s?.cta);
      if (partial) {
        setError(
          "Resposta parcial do Claude — alguns campos vieram vazios. Considere gerar de novo.",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar scripts.";
      setError(msg);
    } finally {
      clearInterval(msgInterval);
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("briefing");
    setAnalise(null);
    setScripts([]);
    setGuiaProducao(null);
  };

  const loadFromHistory = (b: SavedBriefing) => {
    setForm(b.briefing);
    setAnalise(b.result.analise);
    setScripts(b.result.scripts);
    setGuiaProducao(b.result.guiaProducao);
    setGeneratedVideos(loadVideos(b.scriptsHash));
    setError(null);
    setStep("scripts");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--co-bg)" }}>
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10 backdrop-blur"
        style={{
          borderColor: "var(--co-border)",
          background: "color-mix(in oklab, var(--co-bg) 85%, transparent)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-2.5 h-2.5 rounded-full animate-co-pulse"
              style={{ background: "var(--co-red)" }}
            />
            <h1 className="font-display text-xl tracking-widest" style={{ color: "var(--co-text)" }}>
              CRIATIVO<span style={{ color: "var(--co-red)" }}>OS</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="text-[10px] font-mono-tech uppercase tracking-wider px-2.5 py-1.5 rounded-sm transition-colors"
              style={{
                border: "1px solid var(--co-border)",
                color: "var(--co-text-dim)",
                background: "transparent",
              }}
              title="Histórico de briefings"
            >
              🕘 HISTÓRICO
            </button>
            <button
              type="button"
              onClick={() => setUgcOpen(true)}
              className="text-[10px] font-mono-tech uppercase tracking-wider px-2.5 py-1.5 rounded-sm transition-colors"
              style={{
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
                background: "transparent",
              }}
              title="UGC Studio — fala vira vídeo"
            >
              🎤 UGC
            </button>
            <div
              className="text-[10px] font-mono-tech uppercase tracking-wider hidden sm:block"
              style={{ color: "var(--co-text-dim)" }}
            >
              <span style={{ color: "var(--co-green)" }}>●</span> SISTEMA ATIVO
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <ProgressBar step={step} />

        {/* HERO + BRIEFING */}
        {step === "briefing" && (
          <div className="animate-co-fade-up">
            <div className="mb-10">
              <div
                className="text-[11px] font-mono-tech uppercase tracking-widest mb-3"
                style={{ color: "var(--co-red)" }}
              >
                // Equipe Criativa com IA
              </div>
              <h2 className="font-display text-5xl sm:text-6xl leading-none mb-4">
                <div style={{ color: "var(--co-text)" }}>SCRIPTS QUE</div>
                <div style={{ color: "var(--co-red)" }}>PARAM O SCROLL</div>
                <div style={{ color: "var(--co-text)" }}>E VENDEM.</div>
              </h2>
              <p
                className="text-base leading-relaxed max-w-xl"
                style={{ color: "var(--co-text-muted)" }}
              >
                Preencha o briefing. A IA Claude analisa o público, mapeia as dores reais e gera
                scripts prontos pra rodar — com guia de produção no HeyGen.
              </p>
            </div>

            <UrlExtractor
              onExtracted={(partial) =>
                setForm((f) => ({
                  ...f,
                  produto: partial.produto || f.produto,
                  publico: partial.publico || f.publico,
                  dor: partial.dor || f.dor,
                  transformacao: partial.transformacao || f.transformacao,
                  prova: partial.prova || f.prova,
                  tom: partial.tom || f.tom,
                  url: partial.url || f.url,
                }))
              }
            />

            <div
              className="rounded-md p-6 sm:p-8 mb-6"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                <TextField
                  label="Produto / Serviço"
                  name="produto"
                  value={form.produto}
                  onChange={handleChange}
                  placeholder="Ex: Plataforma SaaS de criação de vídeos com IA"
                  required
                />
                <TextField
                  label="URL / Landing"
                  name="url"
                  value={form.url}
                  onChange={handleChange}
                  placeholder="https://..."
                />
                <div className="sm:col-span-2">
                  <TextField
                    label="Público-alvo"
                    name="publico"
                    value={form.publico}
                    onChange={handleChange}
                    rows={2}
                    required
                    placeholder="Ex: Gestores de tráfego pago, agências pequenas, infoprodutores no Brasil..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Qual a maior dor do cliente?"
                    name="dor"
                    value={form.dor}
                    onChange={handleChange}
                    rows={3}
                    required
                    placeholder="Ex: Paga caro em agência, demora semanas pra receber o criativo, quando chega já está desatualizado..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Qual a transformação que o produto entrega?"
                    name="transformacao"
                    value={form.transformacao}
                    onChange={handleChange}
                    rows={2}
                    required
                    placeholder="Ex: Em 10 minutos o cliente tem 5 vídeos prontos com apresentador IA..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Prova social disponível"
                    name="prova"
                    value={form.prova}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Ex: 200 clientes, taxa de conversão média X%, depoimento de fulano..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Referência de concorrente (opcional)"
                    name="concorrente"
                    value={form.concorrente}
                    onChange={handleChange}
                    placeholder="Ex: Creatify, HeyGen, agência X..."
                  />
                </div>
              </div>

              <ChoiceGroup
                label="Tom do criativo"
                options={TOM_OPTIONS}
                value={form.tom}
                onChange={(v) => setForm((f) => ({ ...f, tom: v }))}
              />
              <ChoiceGroup
                label="Duração do vídeo"
                options={DURACAO_OPTIONS}
                value={form.duracao}
                onChange={(v) => setForm((f) => ({ ...f, duracao: v }))}
              />
              <ChoiceGroup
                label="Plataforma principal"
                options={PLATAFORMA_OPTIONS}
                value={form.plataforma}
                onChange={(v) => setForm((f) => ({ ...f, plataforma: v }))}
              />

              <div className="mb-8">
                <FieldLabel label="Quantidade de Scripts" />
                <div className="flex gap-2">
                  {["3", "5", "7"].map((n) => {
                    const active = form.numScripts === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, numScripts: n }))}
                        className="w-14 h-12 rounded-sm font-display text-xl transition-all"
                        style={{
                          background: active ? "var(--co-red)" : "transparent",
                          border: active
                            ? "1px solid var(--co-red)"
                            : "1px solid var(--co-border)",
                          color: active ? "#fff" : "var(--co-text-dim)",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div
                  className="px-4 py-3.5 rounded text-sm mb-6 font-mono-tech"
                  style={{
                    background: "color-mix(in oklab, var(--co-red) 8%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--co-red) 30%, transparent)",
                    color: "var(--co-red)",
                  }}
                >
                  ⚠ {error}
                </div>
              )}

              <button
                type="button"
                onClick={gerar}
                disabled={loading}
                className="w-full py-4 rounded font-mono-tech text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-3 disabled:cursor-not-allowed"
                style={{
                  background: loading
                    ? "color-mix(in oklab, var(--co-red) 25%, transparent)"
                    : "var(--co-red)",
                  color: "#fff",
                }}
              >
                {loading ? (
                  <>
                    <LoadingDots />
                    <span style={{ color: "color-mix(in oklab, #fff 70%, transparent)" }}>
                      {loadingMsg}
                    </span>
                  </>
                ) : (
                  "⚡ GERAR SCRIPTS AGORA"
                )}
              </button>

              {loading && streamingText && (
                <div
                  className="mt-4 p-4 rounded font-mono-tech text-[11px] leading-relaxed max-h-48 overflow-auto whitespace-pre-wrap"
                  style={{
                    background: "var(--co-bg)",
                    border: "1px solid var(--co-border)",
                    color: "var(--co-text-dim)",
                  }}
                  ref={(el) => {
                    if (el) el.scrollTop = el.scrollHeight;
                  }}
                >
                  {streamingText.slice(-1200)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANÁLISE */}
        {step === "analise" && analise && (
          <div className="animate-co-fade-up">
            <div className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl mb-2">
                ANÁLISE <span style={{ color: "var(--co-red)" }}>ESTRATÉGICA</span>
              </h2>
              <p className="text-sm" style={{ color: "var(--co-text-dim)" }}>
                Como a IA enxerga seu cliente antes de escrever uma palavra.
              </p>
            </div>

            {(
              [
                { key: "momento_de_vida", label: "📍 Momento de Vida", color: "var(--co-orange)" },
                { key: "conversa_interna", label: "🧠 Conversa Interna", color: "var(--co-blue)" },
                { key: "vergonha_oculta", label: "🔴 Vergonha Oculta", color: "var(--co-red)" },
                { key: "desejo_real", label: "✨ Desejo Real", color: "var(--co-green)" },
                { key: "objecao_principal", label: "⚡ Objeção Principal", color: "var(--co-red)" },
              ] as const
            ).map(({ key, label, color }) => (
              <div
                key={key}
                className="px-6 py-5 rounded-md mb-3"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border)",
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div
                  className="text-[11px] font-bold font-mono-tech tracking-wider uppercase mb-2.5"
                  style={{ color }}
                >
                  {label}
                </div>
                <p className="text-sm leading-relaxed m-0" style={{ color: "var(--co-text-muted)" }}>
                  {analise[key]}
                </p>
              </div>
            ))}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep("briefing")}
                className="flex-1 py-3.5 rounded text-[13px] font-mono-tech"
                style={{
                  background: "transparent",
                  border: "1px solid var(--co-border)",
                  color: "var(--co-text-dim)",
                }}
              >
                ← EDITAR BRIEFING
              </button>
              <button
                type="button"
                onClick={() => setStep("scripts")}
                className="flex-[2] py-3.5 rounded text-[13px] font-bold font-mono-tech tracking-wider"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                VER SCRIPTS →
              </button>
            </div>
          </div>
        )}

        {/* SCRIPTS */}
        {step === "scripts" && scripts.length > 0 && (
          <div className="animate-co-fade-up">
            <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h2 className="font-display text-3xl sm:text-4xl mb-2">
                  {scripts.length} SCRIPTS{" "}
                  <span style={{ color: "var(--co-red)" }}>PRONTOS</span>
                </h2>
                <p className="text-sm" style={{ color: "var(--co-text-dim)" }}>
                  Cada script tem ângulo, estrutura e nota estratégica. Clique pra expandir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("analise")}
                className="px-4 py-2 rounded-sm text-[11px] font-mono-tech shrink-0 self-start sm:self-auto"
                style={{
                  background: "transparent",
                  border: "1px solid var(--co-border)",
                  color: "var(--co-text-dim)",
                }}
              >
                ← ANÁLISE
              </button>
            </div>

            <CopyAllButton scripts={scripts} />

            <button
              type="button"
              onClick={() => setBatchOpen(true)}
              className="w-full mb-5 py-3 rounded text-[12px] font-mono-tech tracking-wider uppercase"
              style={{
                background: "transparent",
                border: "1px dashed var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              🎬 GERAR EM LOTE (A/B) — scripts × avatares × vozes
            </button>

            {scripts.map((s, i) => (
              <ScriptCard
                key={i}
                script={s}
                index={i}
                onProduce={(idx) => setProducingIndex(idx)}
                generatedVideo={generatedVideos[i]}
              />
            ))}

            <button
              type="button"
              onClick={() => setStep("producao")}
              className="w-full mt-6 py-4 rounded text-sm font-bold font-mono-tech tracking-wider"
              style={{ background: "var(--co-red)", color: "#fff" }}
            >
              VER GUIA DE PRODUÇÃO HEYGEN →
            </button>
          </div>
        )}

        {/* PRODUÇÃO */}
        {step === "producao" && guiaProducao && (
          <div className="animate-co-fade-up">
            <div className="mb-8">
              <h2 className="font-display text-3xl sm:text-4xl mb-2">
                GUIA DE <span style={{ color: "var(--co-red)" }}>PRODUÇÃO</span>
              </h2>
              <p className="text-sm" style={{ color: "var(--co-text-dim)" }}>
                Configurações específicas pra esse público e esses scripts no HeyGen.
              </p>
            </div>

            {(
              [
                { key: "perfil_avatar", label: "🎭 Perfil do Avatar" },
                { key: "voz", label: "🎙️ Voz e Ritmo" },
                { key: "visual", label: "🎬 Visual e Ambiente" },
                { key: "edicao", label: "✂️ Edição e Ritmo" },
              ] as const
            ).map(({ key, label }) => (
              <div
                key={key}
                className="px-6 py-5 rounded-md mb-3"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border)",
                }}
              >
                <div
                  className="text-[12px] font-bold font-mono-tech tracking-wider uppercase mb-2.5"
                  style={{ color: "var(--co-text-muted)" }}
                >
                  {label}
                </div>
                <p className="text-sm leading-relaxed m-0" style={{ color: "var(--co-text-muted)" }}>
                  {guiaProducao[key]}
                </p>
              </div>
            ))}

            {guiaProducao.checklist && guiaProducao.checklist.length > 0 && (
              <div
                className="p-6 rounded-md mb-3"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid color-mix(in oklab, var(--co-red) 30%, transparent)",
                }}
              >
                <div
                  className="text-[12px] font-bold font-mono-tech tracking-wider uppercase mb-4"
                  style={{ color: "var(--co-red)" }}
                >
                  ✓ Checklist de Qualidade
                </div>
                {guiaProducao.checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 mb-2.5">
                    <div
                      className="w-5 h-5 rounded-sm shrink-0 mt-0.5 flex items-center justify-center"
                      style={{
                        border: "1px solid color-mix(in oklab, var(--co-red) 40%, transparent)",
                      }}
                    >
                      <span className="text-[10px]" style={{ color: "var(--co-red)" }}>
                        ✓
                      </span>
                    </div>
                    <span className="text-sm leading-relaxed" style={{ color: "var(--co-text-muted)" }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep("scripts")}
                className="flex-1 py-3.5 rounded text-[13px] font-mono-tech"
                style={{
                  background: "transparent",
                  border: "1px solid var(--co-border)",
                  color: "var(--co-text-dim)",
                }}
              >
                ← SCRIPTS
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex-[2] py-3.5 rounded text-[13px] font-bold font-mono-tech tracking-wider"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                ⚡ NOVO BRIEFING
              </button>
            </div>
          </div>
        )}
      </main>
      <HeygenDrawer
        open={producingIndex !== null}
        onOpenChange={(v) => {
          if (!v) setProducingIndex(null);
        }}
        script={producingIndex !== null ? (scripts[producingIndex] ?? null) : null}
        onVideoReady={(v) => {
          if (producingIndex !== null) {
            setGeneratedVideos((prev) => ({ ...prev, [producingIndex]: v }));
          }
        }}
      />
      <BriefingHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onLoad={loadFromHistory}
        onNew={reset}
      />
      <BatchMatrix
        open={batchOpen}
        onOpenChange={setBatchOpen}
        scripts={scripts}
      />
      <UGCStudio open={ugcOpen} onOpenChange={setUgcOpen} />
    </div>
  );
}