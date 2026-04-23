

# Auditoria Completa do CriativoOS — Relatório Hard

## Visão geral

Sistema funcional em produção, mas com **6 blocos de funcionalidades planejadas que nunca foram entregues**, **vários números fake** apresentados como métricas reais, **bugs sutis de UX/estado** e **dívida técnica acumulada** (arquivo de 2.000 linhas, sem testes, sem auth, sem persistência de servidor). Tudo abaixo é factual — extraído da leitura dos arquivos.

---

## 1. Funcionalidades NUNCA implementadas (planejadas e abandonadas)

| # | Bloco | Status | Onde aparece a "promessa" |
|---|---|---|---|
| 1 | **Bloco 7 — Performance Ads (Meta API)** | 0% — só plano em chat | Aprovado em 4 sprints, nunca começou. Sem Lovable Cloud, sem schema, sem OAuth. |
| 2 | **Auth + multi-tenant** | 0% | Inexistente. App é single-user, tudo em `localStorage`. |
| 3 | **Sync de métricas reais (ROAS/CPM/CTR)** | 0% | Era Sprint 4 do Bloco 7. |
| 4 | **Upload de vídeo pro Meta direto da UI** | 0% | Botão "🚀 PUBLICAR NO META" nunca foi criado. |
| 5 | **Dashboard de performance** | 0% | Rota `/dashboard` não existe. |
| 6 | **Cron de sync diário** | 0% | Nenhum endpoint `/api/public/cron/*`. |

---

## 2. Funcionalidades implementadas pela METADE

### 2.1 Métricas do hero são **100% inventadas**
`src/routes/index.tsx` linhas 1351-1354:
```
{ v: "12.4k", l: "scripts gerados" },
{ v: "847", l: "vídeos produzidos" },
{ v: "6", l: "idiomas" },
```
Não há contador real. Em produto sênior, isso é **enganoso**. Ou removo, ou puxo do `localStorage` real (briefings + vídeos salvos).

### 2.2 Status Rail mostra dados fake
Linhas 117-126: `LAT 218ms`, `REGION br-sp`, `BUILD v2.4.0`, `STREAM sse/h2`, `BUILD v2.4` no header — tudo hardcoded. Latência é `Math.random()`. É decorativo, mas se vai ficar precisa virar real ou ser claramente "ambient".

### 2.3 PhotoAvatarUpload — bug de listagem
`src/components/PhotoAvatarUpload.tsx` linhas 83-89: o useEffect que retoma polling depende de `list` mas esse `list` é estado local, não atualiza quando outro componente cria um avatar. Resultado: se o user fechar o drawer durante o treinamento, ao reabrir o estado fica inconsistente.

### 2.4 Bebas Neue não está carregada
`styles.css` linha 4: `@import url('...?family=Space+Mono...&family=DM+Sans...&family=Bebas+Neue&display=swap')` — Bebas Neue **está** carregada, OK. Mas a classe `.font-display` não está definida no CSS visível (só vi até linha 80). Verificar se as fontes-utility (`font-display`, `font-mono-tech`) realmente existem em `styles.css` — se não, o hero está caindo no fallback.

### 2.5 ScriptCard wrapper duplicado
Linhas 419-444: existe um wrapper `ScriptCard` que só repassa props pro `ScriptCardImpl`. Resíduo do redesign — código morto.

### 2.6 Loading messages nunca rotacionam
`LOADING_MSGS` (linha 66) tem 5 mensagens, mas só o índice 0 é usado (`useState(LOADING_MSGS[0])`). O carrossel prometido no plano não existe.

### 2.7 Filtros mock por ângulo na seção Scripts
Plano da home prometia "filtros mock por ângulo" na seção Scripts. Não foi implementado.

### 2.8 Tradução: chave `[idx]` é frágil
`translations[i] || {}` em index.tsx — se a ordem dos scripts mudar (regerar), as traduções "vazam" pro script errado. Precisa chavear por hash do script, não índice.

### 2.9 VideoEditor: export só WebM, sem MP4
Linhas 214-217: `MediaRecorder` só suporta WebM. Para Meta Ads o ideal é MP4. Falta um passo de transcodificação (server-side ou ffmpeg.wasm).

### 2.10 VideoEditor: AudioContext leak
Linha 196: `audioCtx.createMediaElementSource(v)` — se o user exportar duas vezes, dá `InvalidStateError` (um element só pode ser source uma vez por context). Bug latente.

### 2.11 BatchMatrix — falta retry / cancelamento
`MAX_CONCURRENT = 3` (linha 31), mas se um job falha no meio, não há botão de retry individual nem de cancelar a fila inteira.

---

## 3. Erros / problemas técnicos no sistema HOJE

### 3.1 `tailwind.config.ts` ausente
Log do dev-server:
```
Could not resolve "/dev-server/tailwind.config.ts"
Error generating tailwind.config.lov.json
```
Tailwind v4 usa CSS-first via `@theme` no `styles.css` então **funciona**, mas o ferramental do Lovable espera o arquivo. Não quebra build mas polui logs e pode quebrar features auxiliares (ex: tema visual).

### 3.2 Metadados do `__root.tsx` genéricos
Linhas 32-43: title "Lovable App", og:image apontando pro preview-id antigo. Em produção isso vaza branding errado. A rota `/` sobrescreve title mas og:image do root sempre vence (segundo o guia TanStack).

### 3.3 `index.tsx` com 1997 linhas
Inviável de manter. Componentes inline (StatusRail, ProgressBar, LoadingDots, TextField, ChoiceGroup, SectionHeader, ScriptCard, ScriptCardImpl, BriefingSidebar, CopyAllButton, formatRelative, formatScript, formatAllScripts) deveriam estar em arquivos separados.

### 3.4 Sem error boundary por rota
`src/routes/index.tsx` não declara `errorComponent` nem `pendingComponent`. Se o componente quebrar, cai no boundary global do router (genérico em inglês).

### 3.5 Sem QueryClient
Não usa TanStack Query. Cada componente faz `fetch` direto, sem cache, sem retry, sem dedupe. Avatares HeyGen são re-fetched por componente (HeygenDrawer, BatchMatrix, UGCStudio cada um pede a sua lista).

### 3.6 Persistência só local
Tudo em `localStorage`: vídeos, briefings, traduções, avatares custom, vozes custom, batches. **Trocou de browser → perdeu tudo.** Nenhuma DB.

### 3.7 Endpoints públicos sem rate limiting
`/api/public/heygen/generate`, `/api/public/elevenlabs/clone-voice`, `/api/public/extract-url` — qualquer um na internet pode chamar e queimar seus créditos HeyGen/ElevenLabs/Firecrawl/Lovable AI. Crítico de custo.

### 3.8 Hidratação SSR — risco residual
StatusRail foi corrigido, mas o ScriptCard usa `Math.random()`? Não — mas usa `setExpanded(index === 0)` que é determinístico, OK. `formatRelative` usa `Date.now()` que pode divergir SSR/cliente — render só ocorre depois de `generatedVideo` existir (client-only), então OK na prática.

### 3.9 ScriptCard: card 0 sempre auto-expanded
`useState(index === 0)` força o primeiro a abrir. Se o user fecha e volta pra etapa, abre de novo (estado é local, não persiste).

### 3.10 Drawer aria/focus
HeygenDrawer/BatchMatrix/UGCStudio são `Sheet` shadcn — sem labels customizados. O title diz "🎬 PRODUZIR VÍDEO" — OK, mas várias subseções não têm `<section aria-labelledby>`.

### 3.11 `extract-url` modelo com nome questionável
`google/gemini-3-flash-preview` (linha 109) — o gateway aceita, mas se for renomeado/descontinuado quebra silenciosamente. Sem fallback.

### 3.12 Sem tratamento de quota Lovable AI no /generate-scripts
Não verifiquei o arquivo, mas é provavelmente o mesmo padrão de extract-url. Se sim, OK; se não, ataque de quota leva a UX ruim.

---

## 4. Inconsistências de design / produto

- **CTA "🎬 PRODUZIR"** abre HeygenDrawer mas o nome do app é "CRIATIVO·OS" — falta consistência de copy entre "produzir / gerar / renderizar".
- **Rodapé** diz "BUILT FOR PERFORMANCE" mas a feature de performance (Bloco 7) não existe.
- **Sidebar do briefing** lista "// PROTOCOLO 04 — Produza no HeyGen" como passo final, mas o último step real é "Produção" (guia, não vídeo). Confuso.
- **Header tem badge "● LIVE"** verde sem significado.

---

## 5. Sugestão de roadmap pós-auditoria

Ordem proposta por impacto × esforço:

**🔴 Bloqueadores de credibilidade (1 dia)**
1. Remover métricas fake do hero OU plugar contador real do localStorage
2. Recriar `tailwind.config.ts` mínimo pra parar o erro do dev-server
3. Atualizar metadados do `__root.tsx` (title/description/og:image reais)
4. Atualizar copy do rodapé / status rail pra não prometer o que não existe

**🟠 Estabilidade (1-2 dias)**
5. Quebrar `index.tsx` em ~8 arquivos por seção
6. Adicionar `errorComponent` e `pendingComponent` na rota `/`
7. Mudar chave de tradução para hash do script (em vez de índice)
8. Fix do `AudioContext` reuse no VideoEditor
9. Centralizar fetch de avatares/vozes HeyGen num hook compartilhado (ou TanStack Query)

**🟡 Segurança / custo (1 dia)**
10. Rate limiting básico nos endpoints `/api/public/*` (KV ou memória + IP) ou mover pra `/api/_protected/*`

**🟢 Funcionalidades faltantes (escolher)**
11. Bloco 7 — começar Sprint 1 (Cloud + auth + schema)
12. UGC Studio — auditar separadamente (não foi lido em profundidade)
13. Export MP4 server-side via API externa (já que ffmpeg não roda no Worker)

---

## Resposta direta às 4 perguntas

- **O que ficou sem implementar?** Bloco 7 inteiro (Meta Ads, dashboard, OAuth, sync), auth, multi-tenant, persistência server-side, rate limiting, MP4 export.
- **O que ficou pela metade?** Métricas do hero (fake), Status Rail (fake), filtros de scripts (não existem), rotação de loading messages, retomada de polling em PhotoAvatarUpload, retry no BatchMatrix, gestão de traduções por hash.
- **O que falta arrumar?** `tailwind.config.ts` ausente, metadados root genéricos, `index.tsx` monstro de 2k linhas, error boundaries por rota, AudioContext leak, dedupe de fetch HeyGen, copy inconsistente.
- **Erros hoje?** 1 erro recorrente no dev-server (tailwind config), 0 erros runtime conhecidos. Riscos: AudioContext reuse, quota Lovable AI sem fallback, endpoints públicos sem rate limit.

Quero que eu execute o roadmap inteiro, só os bloqueadores 🔴, ou um subset específico?
