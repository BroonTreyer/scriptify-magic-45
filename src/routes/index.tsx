import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { apiFetch } from "@/lib/api-fetch";
import { tryCooldown, COOLDOWN } from "@/lib/client-cooldown";
import { toast } from "sonner";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { extractJson } from "@/server/generate-scripts";
import type {
  Analise,
  BriefingInput,
  GenerateResult,
  GuiaProducao,
  Script,
} from "@/lib/criativo-types";
import type { GeneratedVideo } from "@/lib/heygen-types";
const HeygenDrawer = lazy(() =>
  import("@/components/HeygenDrawer").then((m) => ({ default: m.HeygenDrawer })),
);
import { hashScript, hashScripts, loadVideos, saveVideos } from "@/lib/video-storage";
import { BriefingHistorySheet } from "@/components/BriefingHistorySheet";
import { saveBriefing, type SavedBriefing } from "@/lib/briefing-storage";
import { ProfileDialog } from "@/components/ProfileDialog";
import { UrlExtractor } from "@/components/UrlExtractor";
const BatchMatrix = lazy(() =>
  import("@/components/BatchMatrix").then((m) => ({ default: m.BatchMatrix })),
);
const UGCStudio = lazy(() =>
  import("@/components/UGCStudio").then((m) => ({ default: m.UGCStudio })),
);
import {
  LANGUAGES,
  loadTranslations,
  saveTranslations,
  type LanguageCode,
  type TranslationMap,
} from "@/lib/translation-storage";
import { useRealMetrics } from "@/hooks/use-real-metrics";
import { StatusRail } from "@/components/home/StatusRail";
import { BriefingSidebar } from "@/components/home/BriefingSidebar";
import {
  ScriptCard,
  formatAllScripts,
} from "@/components/home/ScriptCard";

export const Route = createFileRoute("/")({
  component: HomePage,
  errorComponent: HomeErrorBoundary,
  pendingComponent: HomePending,
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

function HomePage() {
  const { user, profile, loading, signOut, setProfile } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  useRealtimeSync(user?.id);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
      >
        <div className="font-display text-2xl tracking-widest opacity-60">
          CARREGANDO...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 px-2 py-1 rounded border border-border bg-card hover:bg-accent"
          title="Editar perfil"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono uppercase">
              {(profile?.full_name || user.email || "?").slice(0, 1)}
            </div>
          )}
          <span className="text-xs font-mono opacity-80 hidden sm:inline">
            {profile?.full_name || user.email}
          </span>
        </button>
        <button
          onClick={() => {
            signOut();
            navigate({ to: "/auth" });
          }}
          className="px-3 py-1 rounded text-xs font-mono uppercase tracking-wider border border-border bg-card hover:bg-accent text-foreground"
        >
          Sair
        </button>
      </div>
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
        profile={profile}
        onSaved={setProfile}
      />
      <CriativoOS />
    </>
  );
}

function HomePending() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
    >
      <div className="text-center">
        <div
          className="font-display text-3xl tracking-widest mb-3"
          style={{ color: "var(--co-text)" }}
        >
          CRIATIVO·<span style={{ color: "var(--co-red)" }}>OS</span>
        </div>
        <div
          className="text-[11px] font-mono-tech uppercase tracking-widest"
          style={{ color: "var(--co-text-dim)" }}
        >
          carregando sistema…
        </div>
      </div>
    </div>
  );
}

function HomeErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
    >
      <div className="max-w-md w-full text-center">
        <div
          className="inline-block px-3 py-1 rounded mb-4 text-[10px] font-mono-tech uppercase tracking-widest"
          style={{
            border: "1px solid var(--co-red)",
            color: "var(--co-red)",
            background: "color-mix(in oklab, var(--co-red) 8%, transparent)",
          }}
        >
          ⚠ ERRO INESPERADO
        </div>
        <h1
          className="font-display text-3xl tracking-wider mb-3"
          style={{ color: "var(--co-text)" }}
        >
          ALGO QUEBROU AQUI
        </h1>
        <p
          className="text-sm mb-5"
          style={{ color: "var(--co-text-dim)" }}
        >
          A página caiu antes de renderizar. Tenta de novo, ou volta pro início.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre
            className="mb-5 max-h-40 overflow-auto rounded p-3 text-left font-mono text-[11px]"
            style={{
              background: "var(--co-surface)",
              border: "1px solid var(--co-border)",
              color: "var(--co-red)",
            }}
          >
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-widest"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            TENTAR DE NOVO
          </button>
          <Link
            to="/"
            className="px-4 py-2 rounded font-mono text-xs font-bold uppercase tracking-widest"
            style={{
              border: "1px solid var(--co-border-strong)",
              color: "var(--co-text)",
            }}
          >
            INÍCIO
          </Link>
        </div>
      </div>
    </div>
  );
}

type Step = "briefing" | "analise" | "scripts" | "producao";
const STEPS: Step[] = ["briefing", "analise", "scripts", "producao"];
const STEP_LABELS: Record<Step, string> = {
  briefing: "Briefing",
  analise: "Análise",
  scripts: "Scripts",
  producao: "Produção",
};
const STEP_HINTS: Record<Step, string> = {
  briefing: "~30s",
  analise: "~10s",
  scripts: "~1min",
  producao: "~10s",
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

/* ──────────────────────────────────────────────────────────
   STATUS RAIL — ticker técnico
   ────────────────────────────────────────────────────────── */
/* StatusRail extraído para src/components/home/StatusRail.tsx */

/* ──────────────────────────────────────────────────────────
   STEPPER — trilho técnico com nodos
   ────────────────────────────────────────────────────────── */
function ProgressBar({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  const pct = (idx / (STEPS.length - 1)) * 100;
  return (
    <div className="mb-12">
      <div className="relative">
        {/* trilho base */}
        <div
          className="absolute left-0 right-0 top-[14px] h-px"
          style={{ background: "var(--co-border)" }}
        />
        {/* trilho preenchido */}
        <div
          className="absolute left-0 top-[14px] h-px transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: "var(--co-red)",
            boxShadow: "0 0 12px var(--co-accent-glow)",
          }}
        />
        <div className="relative flex justify-between">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            const on = done || active;
            return (
              <div
                key={s}
                className="flex flex-col items-center gap-2"
                aria-current={active ? "step" : undefined}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold font-mono-tech transition-all relative"
                  style={{
                    background: on ? "var(--co-red)" : "var(--co-bg)",
                    border: on
                      ? "1px solid var(--co-red)"
                      : "1px solid var(--co-border-strong)",
                    color: on ? "#fff" : "var(--co-text-dim)",
                    boxShadow: active
                      ? "0 0 0 4px var(--co-accent-glow-soft)"
                      : "none",
                  }}
                >
                  {done ? "✓" : String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-center hidden sm:block">
                  <div
                    className="text-[10px] uppercase tracking-widest font-mono-tech"
                    style={{
                      color: active
                        ? "var(--co-text)"
                        : on
                          ? "var(--co-text-muted)"
                          : "var(--co-text-dim)",
                    }}
                  >
                    {STEP_LABELS[s]}
                  </div>
                  <div
                    className="text-[9px] font-mono-tech mt-0.5"
                    style={{ color: "var(--co-text-dim)" }}
                  >
                    {STEP_HINTS[s]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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

/* ──────────────────────────────────────────────────────────
   FORM PRIMITIVES
   ────────────────────────────────────────────────────────── */
type FieldProps = {
  label: string;
  name: keyof BriefingInput;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  hint?: string;
};

function FieldLabel({
  label,
  required,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <label
        className="text-[10px] font-bold uppercase tracking-widest font-mono-tech"
        style={{ color: "var(--co-text-muted)" }}
      >
        {label} {required && <span style={{ color: "var(--co-red)" }}>*</span>}
      </label>
      {hint && (
        <span
          className="text-[9px] font-mono-tech uppercase tracking-wider"
          style={{ color: "var(--co-text-dim)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  placeholder,
  required,
  rows,
  hint,
}: FieldProps) {
  const common = {
    name,
    value,
    onChange,
    placeholder,
    className:
      "w-full rounded font-sans text-sm outline-none transition-all px-4 py-3.5",
    style: {
      background: "var(--co-bg)",
      border: "1px solid var(--co-border)",
      color: "var(--co-text)",
    } as React.CSSProperties,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--co-red)";
      el.style.boxShadow = "0 0 0 3px var(--co-accent-glow-soft)";
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--co-border)";
      el.style.boxShadow = "none";
    },
  };
  return (
    <div className="mb-5">
      <FieldLabel label={label} required={required} hint={hint} />
      {rows ? (
        <textarea
          {...common}
          rows={rows}
          style={{ ...common.style, resize: "vertical" }}
        />
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
              className="px-3.5 py-2 rounded-sm text-[12px] font-medium transition-all"
              style={{
                background: active ? "var(--co-red)" : "var(--co-bg)",
                border: active
                  ? "1px solid var(--co-red)"
                  : "1px solid var(--co-border)",
                color: active ? "#fff" : "var(--co-text-dim)",
                boxShadow: active ? "0 4px 14px -4px var(--co-accent-glow)" : "none",
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

/* ──────────────────────────────────────────────────────────
   SECTION HEADER (form groups)
   ────────────────────────────────────────────────────────── */
function SectionHeader({
  tag,
  title,
  hint,
}: {
  tag: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-5 mt-2 flex items-center gap-3">
      <span
        className="px-2 py-0.5 rounded-sm text-[10px] font-mono-tech tracking-widest"
        style={{
          background: "var(--co-accent-glow-soft)",
          border: "1px solid color-mix(in oklab, var(--co-red) 35%, transparent)",
          color: "var(--co-red)",
        }}
      >
        {tag}
      </span>
      <span
        className="font-display text-base tracking-widest"
        style={{ color: "var(--co-text)" }}
      >
        {title}
      </span>
      {hint && (
        <span
          className="text-[10px] font-mono-tech uppercase tracking-wider hidden sm:inline"
          style={{ color: "var(--co-text-dim)" }}
        >
          // {hint}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "var(--co-border)" }} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   SCRIPT CARDS (logic preserved)
   ────────────────────────────────────────────────────────── */
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
      className="w-full mb-4 py-3 rounded text-[11px] font-bold font-mono-tech tracking-widest uppercase transition-colors"
      style={{
        background: copied
          ? "color-mix(in oklab, var(--co-green) 12%, transparent)"
          : "var(--co-bg)",
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

/* formatRelative, ScriptCardImpl e BriefingSidebar extraídos:
   - src/components/home/ScriptCard.tsx (com formatScript/formatAllScripts/formatRelative inline)
   - src/components/home/BriefingSidebar.tsx
*/


/* ──────────────────────────────────────────────────────────
   APP
   ────────────────────────────────────────────────────────── */
function CriativoOS() {
  const [step, setStep] = useState<Step>("briefing");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const metrics = useRealMetrics();
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

  useEffect(() => {
    if (!sessionKey) {
      setGeneratedVideos({});
      return;
    }
    setGeneratedVideos(loadVideos(sessionKey));
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    saveVideos(sessionKey, generatedVideos);
  }, [sessionKey, generatedVideos]);

  useEffect(() => {
    if (!sessionKey) {
      setTranslations({});
      return;
    }
    setTranslations(loadTranslations(sessionKey));
  }, [sessionKey]);
  useEffect(() => {
    if (!sessionKey) return;
    saveTranslations(sessionKey, translations);
  }, [sessionKey, translations]);

  const translateScript = async (idx: number, lang: LanguageCode) => {
    const src = scripts[idx];
    if (!src) throw new Error("Script não encontrado.");
    const langDef = LANGUAGES.find((l) => l.code === lang);
    if (!langDef) throw new Error("Idioma inválido.");
    const res = await apiFetch("/api/public/translate-script", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        script: src,
        targetLang: lang,
        targetLangLabel: langDef.label,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `Erro (${res.status}).`);
    const key = hashScript(src);
    setTranslations((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [lang]: json.script as Script },
    }));
  };

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
      const cd = tryCooldown("generate-scripts", COOLDOWN.generateScripts);
      if (cd !== true) {
        toast.warning(`Aguarde ${Math.ceil(cd / 1000)}s antes de gerar de novo.`);
        clearInterval(msgInterval);
        setLoading(false);
        return;
      }
      const res = await apiFetch("/api/public/generate-scripts", {
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
      let fullText = "{";
      let stopReason: string | null = null;
      let sawMessageStop = false;
      let receivedAnyContent = false;
      setStreamingText(fullText);

      const processEvent = (block: string) => {
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
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";
        for (const block of blocks) processEvent(block);
      }
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
        throw new Error("Claude retornou JSON inválido. Tente novamente.");
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
        throw new Error("Claude não retornou nenhum script. Tente novamente.");
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
    <div className="min-h-screen relative" style={{ background: "var(--co-bg)" }}>
      {/* ───────────── HEADER ───────────── */}
      <header
        className="border-b sticky top-0 z-30 backdrop-blur-md"
        style={{
          borderColor: "var(--co-border)",
          background: "color-mix(in oklab, var(--co-bg) 78%, transparent)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div
                  className="w-2.5 h-2.5 rounded-full animate-co-pulse"
                  style={{ background: "var(--co-red)" }}
                />
                <div
                  className="absolute inset-0 rounded-full blur-sm"
                  style={{ background: "var(--co-red)", opacity: 0.6 }}
                />
              </div>
              <h1
                className="font-display text-xl tracking-[0.18em]"
                style={{ color: "var(--co-text)" }}
              >
                CRIATIVO
                <span style={{ color: "var(--co-red)" }}>·OS</span>
              </h1>
            </div>
            <div
              className="hidden md:flex items-center gap-2 pl-4 border-l text-[10px] font-mono-tech uppercase tracking-widest"
              style={{ borderColor: "var(--co-border)", color: "var(--co-text-dim)" }}
            >
              <span>claude-sonnet-4.5</span>
              <span style={{ color: "var(--co-border-strong)" }}>·</span>
              <span>heygen · elevenlabs</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="text-[10px] font-mono-tech uppercase tracking-widest px-2.5 py-1.5 rounded-sm transition-colors hover:border-[color:var(--co-border-strong)]"
              style={{
                border: "1px solid var(--co-border)",
                color: "var(--co-text-dim)",
                background: "transparent",
              }}
              title="Histórico de briefings"
            >
              🕘 <span className="hidden sm:inline">HISTÓRICO</span>
            </button>
            <button
              type="button"
              onClick={() => setUgcOpen(true)}
              className="text-[10px] font-mono-tech uppercase tracking-widest px-2.5 py-1.5 rounded-sm transition-colors"
              style={{
                border: "1px solid var(--co-red)",
                color: "var(--co-red)",
                background: "var(--co-accent-glow-soft)",
              }}
              title="UGC Studio — fala vira vídeo"
            >
              🎤 <span className="hidden sm:inline">UGC</span>
            </button>
            {scripts.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                className="text-[10px] font-mono-tech uppercase tracking-widest px-2.5 py-1.5 rounded-sm transition-colors"
                style={{
                  border: "1px solid var(--co-border)",
                  color: "var(--co-text-dim)",
                  background: "transparent",
                }}
              >
                ▦ <span className="hidden sm:inline">BATCH</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <StatusRail />

      {/* ───────────── HERO ───────────── */}
      {step === "briefing" && (
        <section
          className="relative overflow-hidden hero-glow"
          style={{
            borderBottom: "1px solid var(--co-border)",
          }}
        >
          <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
            <div
              className="text-[10px] font-mono-tech uppercase tracking-[0.3em] mb-6 flex items-center gap-3"
              style={{ color: "var(--co-red)" }}
            >
              <span className="w-8 h-px" style={{ background: "var(--co-red)" }} />
              [01] BRIEFING ENGINE
              <span
                className="px-2 py-0.5 rounded-sm text-[9px]"
                style={{
                  background: "var(--co-accent-glow-soft)",
                  border: "1px solid color-mix(in oklab, var(--co-red) 30%, transparent)",
                }}
              >
                v2 · stream
              </span>
            </div>
            <h2
              className="font-display leading-[0.88] mb-8 text-balance"
              style={{
                fontSize: "clamp(3.25rem, 9vw, 8rem)",
                color: "var(--co-text)",
              }}
            >
              <div>SCRIPTS QUE</div>
              <div
                style={{
                  background:
                    "linear-gradient(180deg, var(--co-red) 0%, color-mix(in oklab, var(--co-red) 65%, black) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                PARAM O SCROLL.
              </div>
              <div style={{ color: "var(--co-text-muted)" }}>E VENDEM.</div>
            </h2>
            <div className="flex gap-4 max-w-2xl">
              <div
                className="w-px shrink-0 self-stretch"
                style={{ background: "var(--co-red)" }}
              />
              <p
                className="text-base sm:text-lg leading-relaxed"
                style={{ color: "var(--co-text-muted)" }}
              >
                Cole uma URL, descreva o cliente em 4 frases. A IA Claude analisa o
                público, mapeia as dores reais e devolve scripts prontos pra rodar —
                com guia de produção HeyGen, voz clonada e tradução em 6 idiomas.
              </p>
            </div>

            {/* Métricas */}
            <div className="mt-10 inline-flex items-center gap-6 px-5 py-3 rounded-md"
                 style={{
                   background: "var(--co-surface)",
                   border: "1px solid var(--co-border)",
                 }}>
              {[
                { v: metrics.scripts.toString(), l: "scripts gerados" },
                { v: metrics.videos.toString(), l: "vídeos produzidos" },
                { v: `${metrics.languages}/${LANGUAGES.length}`, l: "idiomas usados" },
              ].map((m, i) => (
                <div key={m.l} className="flex items-center gap-6">
                  <div>
                    <div
                      className="font-display text-2xl leading-none"
                      style={{ color: "var(--co-text)" }}
                    >
                      {m.v}
                    </div>
                    <div
                      className="text-[9px] font-mono-tech uppercase tracking-widest mt-1"
                      style={{ color: "var(--co-text-dim)" }}
                    >
                      {m.l}
                    </div>
                  </div>
                  {i < 2 && (
                    <div
                      className="w-px h-8"
                      style={{ background: "var(--co-border)" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <ProgressBar step={step} />

        {/* BRIEFING */}
        {step === "briefing" && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 lg:gap-14 animate-co-fade-up">
            <BriefingSidebar />

            <div className="min-w-0">
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
                className="rounded-md p-6 sm:p-8"
                style={{
                  background: "var(--co-surface)",
                  border: "1px solid var(--co-border)",
                  boxShadow:
                    "0 30px 80px -40px rgba(0,0,0,0.6), inset 0 1px 0 0 color-mix(in oklab, white 5%, transparent)",
                }}
              >
                <SectionHeader tag="[A]" title="PRODUTO" hint="o que vende" />
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
                    label="URL (opcional)"
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    placeholder="https://..."
                  />
                </div>

                <SectionHeader tag="[B]" title="AUDIÊNCIA" hint="pra quem" />
                <div className="grid grid-cols-1 gap-x-5">
                  <TextField
                    label="Público-alvo"
                    name="publico"
                    value={form.publico}
                    onChange={handleChange}
                    rows={2}
                    required
                    placeholder="Ex: Gestores de tráfego pago, agências pequenas, infoprodutores no Brasil..."
                  />
                  <TextField
                    label="Qual a maior dor do cliente?"
                    name="dor"
                    value={form.dor}
                    onChange={handleChange}
                    rows={3}
                    required
                    placeholder="Ex: Paga caro em agência, demora semanas pra receber o criativo, quando chega já está desatualizado..."
                  />
                  <TextField
                    label="Transformação que o produto entrega"
                    name="transformacao"
                    value={form.transformacao}
                    onChange={handleChange}
                    rows={2}
                    required
                    placeholder="Ex: Em 10 minutos o cliente tem 5 vídeos prontos com apresentador IA..."
                  />
                  <TextField
                    label="Prova social disponível"
                    name="prova"
                    value={form.prova}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Ex: 200 clientes, taxa de conversão média X%, depoimento de fulano..."
                  />
                  <TextField
                    label="Referência de concorrente"
                    name="concorrente"
                    value={form.concorrente}
                    onChange={handleChange}
                    placeholder="Ex: Creatify, HeyGen, agência X..."
                    hint="opcional"
                  />
                </div>

                <SectionHeader tag="[C]" title="CONFIGURAÇÃO" hint="formato final" />
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
                          onClick={() =>
                            setForm((f) => ({ ...f, numScripts: n }))
                          }
                          className="w-14 h-12 rounded-sm font-display text-xl transition-all"
                          style={{
                            background: active ? "var(--co-red)" : "var(--co-bg)",
                            border: active
                              ? "1px solid var(--co-red)"
                              : "1px solid var(--co-border)",
                            color: active ? "#fff" : "var(--co-text-dim)",
                            boxShadow: active
                              ? "0 4px 14px -4px var(--co-accent-glow)"
                              : "none",
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
                      background:
                        "color-mix(in oklab, var(--co-red) 8%, transparent)",
                      border:
                        "1px solid color-mix(in oklab, var(--co-red) 30%, transparent)",
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
                  className="w-full py-4 rounded font-mono-tech text-sm font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed glow-red"
                  style={{
                    background: loading
                      ? "color-mix(in oklab, var(--co-red) 50%, black)"
                      : "var(--co-red)",
                    color: "#fff",
                  }}
                >
                  {loading ? (
                    <>
                      <LoadingDots />
                      <span
                        style={{
                          color: "color-mix(in oklab, #fff 70%, transparent)",
                        }}
                      >
                        {loadingMsg}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>EXECUTAR · GERAR SCRIPTS</span>
                      <span style={{ opacity: 0.5 }}>→</span>
                    </>
                  )}
                </button>

                {loading && streamingText && (
                  <div
                    className="mt-4 rounded overflow-hidden"
                    style={{
                      border: "1px solid var(--co-border)",
                      background: "var(--co-bg)",
                    }}
                    aria-live="polite"
                  >
                    <div
                      className="px-3 py-1.5 text-[10px] font-mono-tech uppercase tracking-widest flex items-center justify-between"
                      style={{
                        background:
                          "color-mix(in oklab, var(--co-red) 8%, transparent)",
                        borderBottom: "1px solid var(--co-border)",
                        color: "var(--co-red)",
                      }}
                    >
                      <span>criativo-os $ stream/claude</span>
                      <span style={{ color: "var(--co-text-dim)" }}>SSE</span>
                    </div>
                    <div
                      className="p-4 font-mono-tech text-[11px] leading-relaxed max-h-48 overflow-auto whitespace-pre-wrap"
                      style={{ color: "var(--co-text-dim)" }}
                      ref={(el) => {
                        if (el) el.scrollTop = el.scrollHeight;
                      }}
                    >
                      {streamingText.slice(-1200)}
                      <span
                        className="inline-block w-2 h-3 ml-0.5 align-middle animate-co-cursor"
                        style={{ background: "var(--co-red)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ANÁLISE */}
        {step === "analise" && analise && (
          <div className="animate-co-fade-up max-w-4xl mx-auto">
            <div className="mb-10 flex items-end justify-between gap-6 flex-wrap">
              <div>
                <div
                  className="text-[10px] font-mono-tech uppercase tracking-[0.3em] mb-3"
                  style={{ color: "var(--co-red)" }}
                >
                  [02] STRATEGIC LAYER
                </div>
                <h2
                  className="font-display leading-none mb-3"
                  style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
                >
                  ANÁLISE{" "}
                  <span style={{ color: "var(--co-red)" }}>ESTRATÉGICA</span>
                </h2>
                <p
                  className="text-sm max-w-xl"
                  style={{ color: "var(--co-text-dim)" }}
                >
                  Como a IA enxerga seu cliente antes de escrever uma palavra.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
              {(
                [
                  { key: "momento_de_vida", label: "Momento de Vida", icon: "📍", n: "01", color: "var(--co-orange)" },
                  { key: "conversa_interna", label: "Conversa Interna", icon: "🧠", n: "02", color: "var(--co-blue)" },
                  { key: "vergonha_oculta", label: "Vergonha Oculta", icon: "🔴", n: "03", color: "var(--co-red)" },
                  { key: "desejo_real", label: "Desejo Real", icon: "✨", n: "04", color: "var(--co-green)" },
                  { key: "objecao_principal", label: "Objeção Principal", icon: "⚡", n: "05", color: "var(--co-red)" },
                ] as const
              ).map(({ key, label, icon, n, color }) => (
                <div
                  key={key}
                  className="p-5 rounded-md flex gap-4 transition-all hover:-translate-y-0.5"
                  style={{
                    background: "var(--co-surface)",
                    border: "1px solid var(--co-border)",
                    borderLeft: `2px solid ${color}`,
                  }}
                >
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="text-2xl mb-1"
                      style={{ filter: "saturate(1.2)" }}
                    >
                      {icon}
                    </div>
                    <div
                      className="font-display text-base"
                      style={{ color }}
                    >
                      {n}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-[10px] font-bold font-mono-tech tracking-widest uppercase mb-2"
                      style={{ color }}
                    >
                      {label}
                    </div>
                    <p
                      className="text-sm leading-relaxed m-0"
                      style={{ color: "var(--co-text-muted)" }}
                    >
                      {analise[key]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-10">
              <button
                type="button"
                onClick={() => setStep("briefing")}
                className="flex-1 py-3.5 rounded text-[12px] font-mono-tech uppercase tracking-widest"
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
                className="flex-[2] py-3.5 rounded text-[12px] font-bold font-mono-tech tracking-widest uppercase glow-red"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                VER SCRIPTS →
              </button>
            </div>
          </div>
        )}

        {/* SCRIPTS */}
        {step === "scripts" && scripts.length > 0 && (
          <div className="animate-co-fade-up max-w-4xl mx-auto">
            <div className="mb-10 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <div
                  className="text-[10px] font-mono-tech uppercase tracking-[0.3em] mb-3"
                  style={{ color: "var(--co-red)" }}
                >
                  [03] OUTPUT · {scripts.length} VARIAÇÕES
                </div>
                <h2
                  className="font-display leading-none mb-3"
                  style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
                >
                  <span style={{ color: "var(--co-text)" }}>
                    {String(scripts.length).padStart(2, "0")} SCRIPTS
                  </span>{" "}
                  <span style={{ color: "var(--co-red)" }}>PRONTOS</span>
                </h2>
                <p
                  className="text-sm max-w-xl"
                  style={{ color: "var(--co-text-dim)" }}
                >
                  Cada script tem ângulo, estrutura e nota estratégica. Clique pra
                  expandir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("analise")}
                className="px-4 py-2 rounded-sm text-[10px] font-mono-tech uppercase tracking-widest shrink-0 self-start sm:self-auto"
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
              className="w-full mb-6 py-3 rounded text-[11px] font-mono-tech tracking-widest uppercase transition-colors hover:bg-[var(--co-accent-glow-soft)]"
              style={{
                background: "transparent",
                border: "1px dashed var(--co-red)",
                color: "var(--co-red)",
              }}
            >
              ▦ GERAR EM LOTE (A/B) — scripts × avatares × vozes
            </button>

            <div className="lg:pl-8">
              {scripts.map((s, i) => (
                <ScriptCard
                  key={i}
                  script={s}
                  index={i}
                  onProduce={(idx: number, override?: Script) => {
                    setProducingScript(override ?? scripts[idx]);
                    setProducingIndex(idx);
                  }}
                  generatedVideo={generatedVideos[i]}
                  translations={translations[hashScript(s)] || {}}
                  onTranslate={translateScript}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep("producao")}
              className="w-full mt-8 py-4 rounded text-sm font-bold font-mono-tech tracking-widest uppercase glow-red"
              style={{ background: "var(--co-red)", color: "#fff" }}
            >
              VER GUIA DE PRODUÇÃO HEYGEN →
            </button>
          </div>
        )}

        {/* PRODUÇÃO */}
        {step === "producao" && guiaProducao && (
          <div className="animate-co-fade-up max-w-4xl mx-auto">
            <div className="mb-10">
              <div
                className="text-[10px] font-mono-tech uppercase tracking-[0.3em] mb-3"
                style={{ color: "var(--co-red)" }}
              >
                [04] PRODUCTION SPEC
              </div>
              <h2
                className="font-display leading-none mb-3"
                style={{ fontSize: "clamp(2.25rem, 5vw, 4rem)" }}
              >
                GUIA DE{" "}
                <span style={{ color: "var(--co-red)" }}>PRODUÇÃO</span>
              </h2>
              <p
                className="text-sm max-w-xl"
                style={{ color: "var(--co-text-dim)" }}
              >
                Configurações específicas pra esse público e esses scripts no
                HeyGen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 stagger">
              {(
                [
                  { key: "perfil_avatar", label: "Perfil do Avatar", icon: "🎭" },
                  { key: "voz", label: "Voz e Ritmo", icon: "🎙️" },
                  { key: "visual", label: "Visual e Ambiente", icon: "🎬" },
                  { key: "edicao", label: "Edição e Ritmo", icon: "✂️" },
                ] as const
              ).map(({ key, label, icon }) => (
                <div
                  key={key}
                  className="p-5 rounded-md"
                  style={{
                    background: "var(--co-surface)",
                    border: "1px solid var(--co-border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{icon}</span>
                    <div
                      className="text-[10px] font-bold font-mono-tech tracking-widest uppercase"
                      style={{ color: "var(--co-text-muted)" }}
                    >
                      {label}
                    </div>
                  </div>
                  <p
                    className="text-sm leading-relaxed m-0"
                    style={{ color: "var(--co-text-muted)" }}
                  >
                    {guiaProducao[key]}
                  </p>
                </div>
              ))}
            </div>

            {guiaProducao.checklist && guiaProducao.checklist.length > 0 && (
              <div
                className="p-6 rounded-md"
                style={{
                  background: "var(--co-surface)",
                  border:
                    "1px solid color-mix(in oklab, var(--co-red) 30%, transparent)",
                  boxShadow: "0 18px 40px -24px var(--co-accent-glow)",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="px-2 py-0.5 rounded-sm text-[10px] font-mono-tech tracking-widest"
                    style={{
                      background: "var(--co-accent-glow-soft)",
                      border: "1px solid color-mix(in oklab, var(--co-red) 35%, transparent)",
                      color: "var(--co-red)",
                    }}
                  >
                    QA
                  </span>
                  <div
                    className="text-[12px] font-bold font-mono-tech tracking-widest uppercase"
                    style={{ color: "var(--co-red)" }}
                  >
                    Checklist de Qualidade
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {guiaProducao.checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded-sm shrink-0 mt-0.5 flex items-center justify-center"
                        style={{
                          border:
                            "1px solid color-mix(in oklab, var(--co-red) 40%, transparent)",
                          background: "var(--co-accent-glow-soft)",
                        }}
                      >
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--co-red)" }}
                        >
                          ✓
                        </span>
                      </div>
                      <span
                        className="text-[13px] leading-relaxed"
                        style={{ color: "var(--co-text-muted)" }}
                      >
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-10">
              <button
                type="button"
                onClick={() => setStep("scripts")}
                className="flex-1 py-3.5 rounded text-[12px] font-mono-tech uppercase tracking-widest"
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
                className="flex-[2] py-3.5 rounded text-[12px] font-bold font-mono-tech tracking-widest uppercase glow-red"
                style={{ background: "var(--co-red)", color: "#fff" }}
              >
                ⚡ NOVO BRIEFING
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer mark */}
      <footer
        className="border-t mt-20"
        style={{ borderColor: "var(--co-border)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-[10px] font-mono-tech uppercase tracking-widest"
             style={{ color: "var(--co-text-dim)" }}>
          <span>© CRIATIVO·OS · scripts publicitários com ia</span>
          <span className="hidden sm:inline">claude · heygen · elevenlabs · firecrawl</span>
        </div>
      </footer>

      <Suspense fallback={null}>
        {producingIndex !== null && (
          <HeygenDrawer
            open={producingIndex !== null}
            onOpenChange={(v) => {
              if (!v) {
                setProducingIndex(null);
                setProducingScript(null);
              }
            }}
            script={
              producingScript ??
              (producingIndex !== null ? (scripts[producingIndex] ?? null) : null)
            }
            onVideoReady={(v) => {
              if (producingIndex !== null) {
                setGeneratedVideos((prev) => ({ ...prev, [producingIndex]: v }));
              }
            }}
          />
        )}
      </Suspense>
      <BriefingHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onLoad={loadFromHistory}
        onNew={reset}
      />
      <Suspense fallback={null}>
        {batchOpen && (
          <BatchMatrix
            open={batchOpen}
            onOpenChange={setBatchOpen}
            scripts={scripts}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {ugcOpen && <UGCStudio open={ugcOpen} onOpenChange={setUgcOpen} />}
      </Suspense>
    </div>
  );
}