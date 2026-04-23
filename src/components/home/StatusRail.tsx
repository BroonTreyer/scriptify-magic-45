import { useEffect, useState } from "react";

/**
 * Ticker técnico no topo do hero.
 * Extraído de src/routes/index.tsx (Fase 2.5 refactor cirúrgico).
 */
export function StatusRail() {
  const [sessionId, setSessionId] = useState("0000");
  useEffect(() => {
    setSessionId(Math.random().toString(16).slice(2, 6).toUpperCase());
  }, []);

  const items = [
    `SESSION ${sessionId}`,
    `MODEL claude-sonnet-4.5`,
    `ENGINE briefing.v2`,
    `STREAM server-sent events`,
    `STACK heygen · elevenlabs · firecrawl`,
  ];
  const line = items.map((x) => `// ${x}`).join("    ·    ");

  return (
    <div
      className="border-b overflow-hidden"
      style={{
        borderColor: "var(--co-border)",
        background: "color-mix(in oklab, var(--co-bg) 92%, black)",
      }}
    >
      <div className="relative h-7 flex items-center">
        <div
          className="flex animate-co-ticker whitespace-nowrap font-mono-tech text-[10px] uppercase tracking-widest"
          style={{ color: "var(--co-text-dim)" }}
        >
          <span className="px-6">{line}</span>
          <span className="px-6">{line}</span>
        </div>
      </div>
    </div>
  );
}
