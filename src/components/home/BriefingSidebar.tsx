/**
 * Sidebar de instruções/exemplos/stack.
 * Extraído de src/routes/index.tsx (Fase 2.5 refactor cirúrgico).
 * Componente puro, sem props.
 */
export function BriefingSidebar() {
  const steps = [
    { n: "01", t: "Cole uma URL", d: "Extração automática de produto, dor e prova." },
    { n: "02", t: "Refine o briefing", d: "Ajuste tom, plataforma e duração." },
    { n: "03", t: "Gere os scripts", d: "Claude entrega análise + 3 a 7 variações." },
    { n: "04", t: "Produza no HeyGen", d: "Avatar, voz e edição — 1 clique por script." },
  ];
  const samples = [
    { ang: "Vergonha oculta", hook: '"Você abre o gerenciador e finge que entende o CPM."' },
    { ang: "Inversão", hook: '"O criativo que mais vendeu no Q4 foi feito por uma IA. Não pelo seu copywriter."' },
    { ang: "Educativo", hook: '"3 sinais de que seu criativo cansou — antes do CPA explodir."' },
  ];
  return (
    <aside className="lg:sticky lg:top-24 self-start space-y-8">
      <div>
        <div
          className="text-[10px] font-mono-tech uppercase tracking-widest mb-4"
          style={{ color: "var(--co-red)" }}
        >
          // PROTOCOLO
        </div>
        <ol className="space-y-4">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span
                className="font-display text-2xl leading-none"
                style={{ color: "var(--co-red)" }}
              >
                {s.n}
              </span>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--co-text)" }}>
                  {s.t}
                </div>
                <div
                  className="text-[12px] mt-0.5 leading-relaxed"
                  style={{ color: "var(--co-text-dim)" }}
                >
                  {s.d}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div
          className="text-[10px] font-mono-tech uppercase tracking-widest mb-4"
          style={{ color: "var(--co-red)" }}
        >
          // EXEMPLOS DE HOOK
        </div>
        <div className="space-y-2">
          {samples.map((s, i) => (
            <div
              key={i}
              className="p-3 rounded text-[12px] leading-snug"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text-muted)",
              }}
            >
              <div
                className="text-[9px] font-mono-tech uppercase tracking-widest mb-1"
                style={{ color: "var(--co-text-dim)" }}
              >
                {s.ang}
              </div>
              <div className="italic" style={{ color: "var(--co-text)" }}>
                {s.hook}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div
          className="text-[10px] font-mono-tech uppercase tracking-widest mb-3"
          style={{ color: "var(--co-red)" }}
        >
          // STACK
        </div>
        <div
          className="text-[11px] font-mono-tech leading-relaxed"
          style={{ color: "var(--co-text-dim)" }}
        >
          claude-sonnet-4.5 · heygen.v2
          <br />
          elevenlabs.tts · firecrawl
          <br />
          stream sse · edge runtime
        </div>
      </div>
    </aside>
  );
}
