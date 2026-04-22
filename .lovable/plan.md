

## B — Persistência dos vídeos gerados em localStorage

### Objetivo

Hoje `generatedVideos` vive só no state do React. Refresh = perde tudo. Vou persistir em `localStorage` por **sessão de briefing**, então cada conjunto de scripts tem seus próprios vídeos vinculados.

### Estratégia de chave

Como o user pode gerar scripts várias vezes (briefings diferentes), preciso de uma chave estável que mude quando os scripts mudam. Vou usar um hash simples do conteúdo dos scripts (concat + hash leve) → key tipo `criativo-os:videos:<hash>`.

Quando o user gera novos scripts, a key muda → vídeos antigos ficam órfãos no storage mas não atrapalham. (Faço uma limpeza simples: manter só as últimas 5 sessões.)

### Mudanças

**`src/lib/video-storage.ts`** (novo) — helpers:
- `hashScripts(scripts: Script[]): string` — hash determinístico dos scripts (djb2 simples sobre `hook+cta` de cada).
- `loadVideos(sessionKey: string): Record<number, GeneratedVideo>` — lê do localStorage, retorna `{}` se nada.
- `saveVideos(sessionKey, videos)` — grava + faz cleanup mantendo só as 5 keys mais recentes.
- Try/catch em tudo (localStorage pode falhar em modo privado/quota).

**`src/routes/index.tsx`** — integrar:
- Computar `sessionKey = useMemo(() => scripts.length ? hashScripts(scripts) : null, [scripts])`.
- Quando `scripts` muda (nova geração), recarregar `generatedVideos` do storage com a nova key (`useEffect`).
- Quando `generatedVideos` muda E temos `sessionKey`, salvar (`useEffect`).
- Sem mudança visual nenhuma — só o estado agora persiste.

### Escopo intencionalmente fora

- **Não** vou mexer na etapa 4 listando vídeos (era opcional no plano original, fica pra depois se você quiser).
- **Não** vou criar UI de "histórico de briefings" (isso é o item C).
- **Não** salva o briefing ou os scripts em si — só os vídeos. Se o user perder os scripts (refresh sem regerar), os vídeos ficam órfãos no storage mas não exibidos. Isso é aceitável pra esse incremento mínimo.

### Edge cases tratados

- `localStorage` indisponível → fallback silencioso pra in-memory (mesmo comportamento de hoje).
- Quota excedida → captura erro, faz cleanup mais agressivo (só 1 sessão), retenta.
- JSON corrompido → reseta a key.

