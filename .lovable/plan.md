

# Redesign completo da página inicial — CriativoOS

## Visão

Recriar `src/routes/index.tsx` do zero, mantendo 100% da lógica e dos componentes existentes (HeygenDrawer, BatchMatrix, UGCStudio, VideoEditor, UrlExtractor, BriefingHistorySheet, ScriptCard, tradução, persistência) mas com uma **identidade visual de produto sênior**: editorial, técnica, com profundidade espacial e impacto cinematográfico — sem mexer em backend, APIs, storage ou tipos.

**Direção estética: "Operations Console"** — um terminal criativo para diretores de performance. Inspiração: Linear, Vercel, Arc Browser, Raycast, painéis Bloomberg. Dark, denso, tipográfico, com micro-detalhes técnicos.

## Princípios de design

1. **Hierarquia editorial** — display Bebas Neue gigante + serif/mono para tensão; hero com peso real, não só headline em vermelho.
2. **Profundidade por camadas** — gradientes sutis, glow vermelho de baixa opacidade, grain noise discreto, bordas com `inset` luminoso.
3. **Densidade técnica** — labels mono com prefixos (`[01]`, `// SYS`, `→`), métricas vivas (uptime, modelo Claude, latência simulada), ticker no header.
4. **Movimento contido** — fade-up em cascade, hover com translate-Y mínimo, número rolante no contador de scripts, cursor blink no streaming.
5. **Cor com restrição** — vermelho `--co-red` segue como acento único (CTAs, status, números). Adiciono apenas `--co-accent-glow` (vermelho 18% opacidade) e `--co-grid` (linhas 4% branco) no `styles.css`.

## Estrutura nova da página

```text
┌─────────────────────────────────────────────────────────┐
│ TOP BAR (sticky, glass, 56px)                           │
│  CRIATIVO·OS  │  v2.4 · claude-sonnet-4.5 · ●LIVE       │
│                          [HISTÓRICO] [UGC] [BATCH] [⚙]  │
├─────────────────────────────────────────────────────────┤
│ STATUS RAIL (ticker mono — 28px)                        │
│  // SESSION 4f2a · MODEL ONLINE · LAT 240ms · BR-SP    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   HERO (full-bleed, grid background, glow radial)       │
│   ─────────────────                                     │
│   [01] BRIEFING ENGINE                                  │
│                                                          │
│   SCRIPTS QUE                                           │
│   PARAM O SCROLL.                ← display 96-128px     │
│   E VENDEM.                       gradiente sutil       │
│                                                          │
│   Sub editorial 18px max-w-2xl + linha vertical vermelha│
│                                                          │
│   ┌─ MÉTRICAS LIVE ──────────────────────┐             │
│   │ 12.4k scripts · 847 vídeos · 6 langs │             │
│   └──────────────────────────────────────┘             │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ STEPPER HORIZONTAL refinado (com linha de progresso     │
│  animada + ícones técnicos + tempo estimado por etapa)  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ CARD PRINCIPAL — 2 COLUNAS no desktop                   │
│                                                          │
│ ┌─ ESQUERDA (sticky) ──┐ ┌─ DIREITA (form) ──────────┐ │
│ │ // INSTRUÇÕES         │ │ URL EXTRACTOR (destacado)  │ │
│ │ Como funciona em 4    │ │ ─────                      │ │
│ │ passos (numerado)     │ │ FORM em seções com         │ │
│ │                       │ │ headers tipo               │ │
│ │ // EXEMPLOS           │ │  [A] PRODUTO               │ │
│ │ 3 mini-cards de       │ │  [B] AUDIÊNCIA             │ │
│ │ scripts reais         │ │  [C] CONFIGURAÇÃO          │ │
│ │ (mock visual)         │ │                            │ │
│ │                       │ │ Inputs: floating label,    │ │
│ │ // CRÉDITOS           │ │ underline ao focar,        │ │
│ │ Powered by Claude     │ │ contador de chars          │ │
│ │ + HeyGen + ElevenLabs │ │                            │ │
│ │                       │ │ CTA principal: vermelho    │ │
│ │                       │ │ com glow, ícone ⚡         │ │
│ └───────────────────────┘ └────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Mobile: colapsa para coluna única, sidebar vira accordion no fim.

## Seções refeitas (mesma lógica, nova pele)

- **Hero/Briefing** → layout em 2 colunas, form agrupado em 3 seções nomeadas (`[A] PRODUTO`, `[B] AUDIÊNCIA`, `[C] CONFIGURAÇÃO`), inputs com floating label e underline animado, CTA com glow radial vermelho.
- **Análise** → grid 2×3 de cards com ícone grande à esquerda, número `[01]–[05]`, hover eleva e revela aspas decorativas.
- **Scripts** → header com contador display-size + filtros mock por ângulo; cards mantêm ScriptCardImpl mas ganham wrapper externo com numeração lateral grande tipo "magazine spread".
- **Produção** → layout tipo "ficha técnica de filme": colunas com label mono + valor, checklist em coluna separada com scroll suave.
- **ProgressBar** → trilho com linha contínua + nodos circulares, label superior + tempo embaixo (`~2 min`).
- **LoadingDots / streaming** → terminal box com prefixo `criativo-os $`, cursor piscando, log scroll bottom-locked.

## Detalhes técnicos

- **Único arquivo tocado: `src/routes/index.tsx`** (reescrita completa). Lógica, estado, fetch streaming, persistência, traduções, drawers — tudo preservado linha-a-linha em comportamento. Só o JSX e os estilos mudam.
- **`src/styles.css`** — aditivos pequenos: `--co-accent-glow`, `--co-grid`, classe `.bg-grid` (linhas SVG inline), `.glow-red` (box-shadow), `.text-balance`, animações `co-shimmer`, `co-cursor-blink`, `co-ticker`. Nada removido, nada renomeado.
- **Sem novas deps.** Tipografia já carregada (Bebas Neue, DM Sans, Space Mono).
- **Sem mexer** em: HeygenDrawer, BatchMatrix, UGCStudio, VideoEditor, UrlExtractor, BriefingHistorySheet, ScriptCardImpl interno (mantém estrutura, só ganha wrapper visual externo), todas as rotas `/api/public/*`, libs de storage, tipos.
- **Acessibilidade**: contraste AA garantido nos novos tokens, focus rings vermelhos visíveis, `aria-current` no stepper, `aria-live` no streaming.
- **Responsivo**: breakpoints `sm/md/lg`. Desktop ≥1024px ganha o layout 2 colunas; abaixo disso, fluxo vertical. Hero font-size com `clamp()`.
- **Performance**: zero JS extra, só CSS. Animações com `transform`/`opacity` apenas.

## O que NÃO muda

- Fluxo de 4 etapas (briefing → analise → scripts → producao)
- Todos os botões, callbacks, drawers, atalhos
- Persistência local de vídeos, traduções, briefings
- Header com Histórico / UGC / Batch (só visual novo)
- Comportamento de tradução por idioma nos cards
- API contracts e payloads

## Entregável

Um único commit reescrevendo `src/routes/index.tsx` + adições mínimas em `src/styles.css`. Build limpa em `tsc --noEmit`. Visual de produto sênior pronto pra demo.

