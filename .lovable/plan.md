

## Corrigir timeout ao gerar scripts

### Problema

`upstream request timeout` = a server function chamou a API do Claude e ficou esperando a resposta inteira por mais de ~30s (limite de execução do worker). Como `claude-sonnet-4-5` gerando 5 scripts JSON longos demora frequentemente 40-90s, o servidor mata a requisição antes do Claude terminar.

A causa raiz é arquitetural: **uma única request HTTP síncrona não cabe no orçamento de tempo do worker**. Aumentar `max_tokens` ou tentar de novo não resolve.

### Solução: streaming SSE direto do Claude para o browser

Trocar a server function pós-processada por uma **rota de API pública que faz proxy de streaming** (`/api/generate-scripts`) usando SSE da Anthropic. O servidor abre a conexão com o Claude com `stream: true` e vai repassando os chunks pro navegador conforme chegam — assim nenhuma request fica pendurada esperando os 60s completos. O browser recebe bytes a cada poucos ms, então não há timeout de "upstream".

Bônus: a UI passa a mostrar o texto sendo gerado em tempo real (efeito "digitando"), o que melhora muito a percepção de espera.

### Mudanças de arquivos

1. **`src/routes/api/generate-scripts.ts`** (novo) — rota POST que:
   - Recebe `{ briefing }` no body
   - Chama `api.anthropic.com/v1/messages` com `stream: true`
   - Retorna `new Response(claudeRes.body, { headers: { "content-type": "text/event-stream" } })` — passa o stream adiante sem bufferizar
   - Lê `ANTHROPIC_API_KEY` do `process.env`

2. **`src/server/generate-scripts.ts`** — remover (ou deixar só o `buildPrompt` exportado para reuso).

3. **`src/routes/index.tsx`** — substituir `useServerFn(generateScripts)` por:
   - `fetch("/api/generate-scripts", { method: "POST", body: JSON.stringify({ briefing }) })`
   - Ler `response.body.getReader()` em loop, parsear cada linha `data: {...}` do SSE da Anthropic, acumular `delta.text` num buffer
   - Atualizar uma state `streamingText` para mostrar no UI durante a geração (substituindo o `LoadingDots` por um preview em tempo real)
   - Quando o stream fechar, rodar `extractJson` + `JSON.parse` no buffer final e popular `analise/scripts/guiaProducao` como hoje

4. **Tratamento de erros**:
   - Se o Claude responder não-2xx no início do stream, capturar e mostrar mensagem amigável (401 = chave inválida, 429/529 = sobrecarregado)
   - Se o JSON final não parsear, mostrar "Claude cortou a resposta — tente reduzir para 3 scripts"
   - Botão de "Tentar de novo" mantendo o briefing

### Detalhes técnicos

- Rota fica em `/api/public/generate-scripts` para garantir que não exija auth (regra do TanStack Start: `/api/public/*` bypassa auth no published).
- Sem assinatura/HMAC porque o endpoint só faz proxy autenticado pelo nosso lado (a `ANTHROPIC_API_KEY` está só no server, e cada chamada gasta créditos seus — vou adicionar um rate-limit simples por IP usando `getRequestIP` se você quiser).
- `max_tokens` sobe para 8000 para garantir que 5-7 scripts caibam sem truncar.
- Modelo: mantém `claude-sonnet-4-5`.

### Nada muda visualmente fora isto

A UI segue idêntica nas 4 etapas. A única diferença visível é que durante "gerar" você verá o texto bruto sendo cuspido em tempo real (em fonte mono pequena, dentro do mesmo box do `LoadingDots`).

