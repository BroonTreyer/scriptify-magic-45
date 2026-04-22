import { useState } from "react";
import type { BriefingInput } from "@/lib/criativo-types";

type Props = {
  onExtracted: (
    partial: Pick<
      BriefingInput,
      "produto" | "publico" | "dor" | "transformacao" | "prova" | "tom" | "url"
    >,
  ) => void;
};

export function UrlExtractor({ onExtracted }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const extract = async () => {
    if (!url.trim()) {
      setError("Cole uma URL primeiro.");
      return;
    }
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/public/extract-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as {
        briefing?: Pick<
          BriefingInput,
          "produto" | "publico" | "dor" | "transformacao" | "prova" | "tom"
        >;
        sourceUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.briefing) {
        throw new Error(data.error || `Erro (${res.status})`);
      }
      onExtracted({ ...data.briefing, url: data.sourceUrl ?? url.trim() });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha desconhecida");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-md p-5 mb-6"
      style={{
        background: "var(--co-surface)",
        border: "1px dashed var(--co-red)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[11px] font-mono-tech uppercase tracking-widest"
          style={{ color: "var(--co-red)" }}
        >
          🔗 // ATALHO
        </span>
        <span
          className="text-[11px] font-mono-tech uppercase tracking-wider"
          style={{ color: "var(--co-text-dim)" }}
        >
          extrair briefing direto da landing page
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://sua-landing.com"
          disabled={loading}
          className="flex-1 px-3 py-2.5 rounded text-sm font-mono-tech"
          style={{
            background: "var(--co-bg)",
            border: "1px solid var(--co-border)",
            color: "var(--co-text)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") extract();
          }}
        />
        <button
          type="button"
          onClick={extract}
          disabled={loading}
          className="px-5 py-2.5 rounded text-[12px] font-mono-tech uppercase tracking-wider whitespace-nowrap transition-opacity disabled:opacity-60"
          style={{ background: "var(--co-red)", color: "#fff" }}
        >
          {loading ? "EXTRAINDO..." : "EXTRAIR DA URL ⚡"}
        </button>
      </div>
      {error && (
        <div
          className="mt-3 text-xs font-mono-tech"
          style={{ color: "var(--co-red)" }}
        >
          ⚠ {error}
        </div>
      )}
      {success && !error && (
        <div
          className="mt-3 text-xs font-mono-tech"
          style={{ color: "#3fb950" }}
        >
          ✓ Briefing preenchido automaticamente. Revise e ajuste os campos.
        </div>
      )}
      <div
        className="mt-3 text-[10px] font-mono-tech"
        style={{ color: "var(--co-text-dim)" }}
      >
        Powered by Firecrawl + Lovable AI. Você pode editar tudo depois.
      </div>
    </div>
  );
}
