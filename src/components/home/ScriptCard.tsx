import { useState } from "react";
import type { Script } from "@/lib/criativo-types";
import type { GeneratedVideo } from "@/lib/heygen-types";
import { LANGUAGES, type LanguageCode } from "@/lib/translation-storage";
import { VideoEditor } from "@/components/VideoEditor";

/**
 * ScriptCard — card expansível com tradução, produção e edição de vídeo.
 * Extraído de src/routes/index.tsx (Fase 2.5 refactor cirúrgico).
 */

export function formatScript(s: Script): string {
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

export function formatAllScripts(scripts: Script[]): string {
  return scripts
    .map((s, i) => `#${i + 1}\n\n${formatScript(s)}`)
    .join("\n\n---\n\n");
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

export type ScriptCardProps = {
  script: Script;
  index: number;
  onProduce: (i: number, override?: Script) => void;
  generatedVideo?: GeneratedVideo;
  translations: Partial<Record<LanguageCode, Script>>;
  onTranslate: (i: number, lang: LanguageCode) => Promise<void>;
};

export function ScriptCard({
  script,
  index,
  onProduce,
  generatedVideo,
  translations,
  onTranslate,
}: ScriptCardProps) {
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
          className="inline-block px-2.5 py-1 rounded-sm mb-2.5 text-[10px] font-bold uppercase tracking-widest font-mono-tech"
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
    <div className="relative mb-4 group">
      {/* Magazine numbering */}
      <div
        className="hidden lg:block absolute -left-20 top-3 font-display text-7xl leading-none select-none transition-opacity"
        style={{
          color: "var(--co-border-strong)",
          opacity: expanded ? 0.55 : 0.25,
        }}
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div
        className="rounded-md overflow-hidden transition-all"
        style={{
          border: expanded
            ? "1px solid color-mix(in oklab, var(--co-red) 40%, transparent)"
            : "1px solid var(--co-border)",
          background: expanded ? "var(--co-surface)" : "var(--co-bg)",
          boxShadow: expanded ? "0 18px 40px -24px var(--co-accent-glow)" : "none",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-5 py-4 flex items-center justify-between cursor-pointer text-left"
        >
          <div className="flex items-center gap-4">
            <span
              className="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold font-mono-tech shrink-0"
              style={{
                background: "var(--co-red)",
                color: "#fff",
                boxShadow: "0 4px 14px -4px var(--co-accent-glow)",
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div
                className="text-sm font-semibold mb-1 leading-tight"
                style={{ color: "var(--co-text)" }}
              >
                {script.angulo || `Script ${index + 1}`}
              </div>
              <div
                className="text-[10px] font-mono-tech uppercase tracking-widest"
                style={{ color: "var(--co-text-dim)" }}
              >
                {script.nivel_consciencia || "—"}
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
              className="px-3.5 py-1.5 rounded-sm text-[10px] cursor-pointer font-mono-tech uppercase tracking-widest transition-colors"
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
              className="px-3.5 py-1.5 rounded-sm text-[10px] cursor-pointer font-mono-tech uppercase tracking-widest transition-colors"
              style={{
                background: "var(--co-red)",
                border: "1px solid var(--co-red)",
                color: "#fff",
                boxShadow: "0 4px 14px -4px var(--co-accent-glow)",
              }}
            >
              🎬 PRODUZIR
              {activeLang !== "pt"
                ? ` ${LANGUAGES.find((l) => l.code === activeLang)?.flag}`
                : ""}
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
          <div className="px-5 pb-5">
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
                  <span
                    className="text-[10px] font-bold font-mono-tech uppercase tracking-widest"
                    style={{ color: "var(--co-green)" }}
                  >
                    ✓ VÍDEO GERADO
                  </span>
                  <span
                    className="text-[10px] font-mono-tech"
                    style={{ color: "var(--co-text-dim)" }}
                  >
                    {formatRelative(generatedVideo.generatedAt)}
                  </span>
                </div>
                <a
                  href={generatedVideo.videoUrl}
                  download={`heygen-${generatedVideo.videoId}.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-mono-tech px-3 py-1.5 rounded uppercase tracking-widest"
                  style={{ background: "var(--co-green)", color: "#000" }}
                >
                  ⬇ BAIXAR
                </a>
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="text-[10px] font-mono-tech px-3 py-1.5 rounded uppercase tracking-widest"
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
                    className="px-2.5 py-1 rounded-sm text-[10px] font-mono-tech uppercase tracking-widest transition-colors"
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
                  className="text-[10px] font-bold font-mono-tech tracking-widest uppercase mb-2"
                  style={{ color: "var(--co-text-dim)" }}
                >
                  💡 Nota Estratégica
                </div>
                <p
                  className="text-[13px] leading-relaxed m-0"
                  style={{ color: "var(--co-text-muted)" }}
                >
                  {script.estrategia}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
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
