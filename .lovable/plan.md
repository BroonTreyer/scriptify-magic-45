
## Bug 1 — Loop infinito de toast "Atualizado em outro dispositivo: metrics"

**Causa:** `metrics` está na lista `TABLES` do `useRealtimeSync`. Cada push do próprio dispositivo (feito pelo `use-real-metrics`) volta como evento realtime → toast → `syncOnLogin` → `dispatchEvent("criativo-os:sync")` → `use-real-metrics` reconta → push → loop.

**Correções em `src/hooks/use-realtime-sync.ts`:**
1. **Remover `"metrics"` da lista `TABLES`** — métricas são derivadas do localStorage, não precisam de notificação realtime nem rehidratação cruzada (já hidratam do cloud no mount via `fetchMetricsSnapshot`).
2. **Aumentar `suppressUntil` de 4s para 8s** — `syncOnLogin` faz N chamadas em paralelo e às vezes resolve depois dos 4s, causando o primeiro toast indevido.
3. **Não tostar tabelas que não são "user-facing"** — manter whitelist de tabelas que merecem toast: `briefings`, `videos`, `batches`, `translations`. `custom_avatars` e `custom_voices` ficam silenciosos (sincronizam mas sem toast) pra reduzir ruído.

**Em `src/hooks/use-real-metrics.ts`:**
4. **Não fazer push se o snapshot não mudou** — comparar com último valor pushado em ref; só chamar `pushMetricsSnapshot` quando `scripts/videos/languages` realmente mudaram. Isso quebra qualquer eco residual.

---

## Bug 2 — "Failed to execute 'json' on 'Response': Unexpected token 'u', 'upstream r'..."

**Causa:** Servidor está respondendo `upstream request timeout` em texto plano (o Firecrawl ou o AI Gateway travou). Cliente faz `res.json()` cego e quebra com mensagem confusa.

**Correções em `src/routes/api/public/extract-url.ts`:**
1. **Adicionar `AbortController` com timeout** nas duas chamadas externas:
   - Firecrawl: 25s (scrape pode ser lento)
   - AI Gateway: 30s
   - Em timeout, retornar JSON estruturado com 504 e mensagem clara ("A página demorou demais pra responder. Tente novamente ou use uma URL mais simples.").
2. **try/catch ao redor de `fetch`** — erros de rede também viram JSON, nunca string solta.

**Correções em `src/components/UrlExtractor.tsx`:**
3. **Parse defensivo da response** — ler `res.text()` primeiro e tentar `JSON.parse`; se falhar, mostrar uma mensagem amigável ("O servidor demorou demais pra responder. Tente novamente em instantes.") em vez do erro técnico do `Response.json()`.
4. **Mensagens de erro contextualizadas** por status HTTP (402 → créditos, 422 → conteúdo insuficiente, 504/502 → timeout, 429 → rate limit).

---

## Validação

- `npx tsc --noEmit` — typecheck limpo.
- `bunx vitest run` — testes existentes continuam verdes.
- Smoke manual no preview: abrir o app → confirmar que o toast "Atualizado em outro dispositivo: metrics" não aparece mais; tentar `extract-url` com uma URL lenta/inválida e ver mensagem amigável em vez do erro técnico.

## Arquivos tocados

- `src/hooks/use-realtime-sync.ts` — remove metrics, whitelist de toasts, suppress 8s
- `src/hooks/use-real-metrics.ts` — guard de "snapshot mudou?" antes de pushar
- `src/routes/api/public/extract-url.ts` — timeouts + try/catch JSON-safe
- `src/components/UrlExtractor.tsx` — parse defensivo + mensagens por status
