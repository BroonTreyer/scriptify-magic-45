

## Fix definitivo: parar o Claude de truncar o JSON

### Diagnóstico

O erro "Claude cortou a resposta" aparece porque `JSON.parse(extractJson(fullText))` falha. Três causas combinadas:

1. **`max_tokens: 8000` é insuficiente** para 5 scripts longos + análise + guia de produção. Claude Sonnet 4.5 frequentemente gera 10k-12k tokens nesse formato e o stream termina com `stop_reason: "max_tokens"` no meio do JSON.
2. **Não detectamos `stop_reason`** nos eventos SSE — então quando o Claude trunca, mostramos uma mensagem genérica em vez de dizer exatamente "ficou sem tokens, aumente o limite ou reduza scripts".
3. **Sem prefill de assistente**, Claude às vezes adiciona texto explicativo antes do `{`, o que combinado com truncamento confunde o `extractJson`.

### Solução

#### 1. Aumentar drasticamente `max_tokens` e usar prefill

Em `src/routes/api/public/generate-scripts.ts`:

- Subir `max_tokens` para **16000** (Sonnet 4.5 suporta até 64k de output). Cobre confortavelmente 7 scripts.
- Adicionar **prefill de assistente** com `{` para forçar Claude a começar direto no JSON:
  ```ts
  messages: [
    { role: "user", content: buildPrompt(briefing) },
    { role: "assistant", content: "{" },  // prefill
  ]
  ```
  No cliente, prepender `{` no `fullText` antes do parse.

#### 2. Capturar `stop_reason` no SSE

Em `src/routes/index.tsx`, no loop do reader, também parsear eventos `message_delta` que contêm `delta.stop_reason`. Se for `"max_tokens"`, mostrar mensagem específica:

> "Claude atingiu o limite de tokens. Tente reduzir para 3 scripts."

E se for `"end_turn"` (terminou normalmente) mas o JSON ainda assim falhar, mostrar:

> "Claude retornou JSON inválido. Tente novamente."

#### 3. Endurecer o prompt

Em `src/server/generate-scripts.ts`, no fim do prompt adicionar:

```
IMPORTANTE: Comece sua resposta DIRETAMENTE com { e termine com }. 
Nada antes, nada depois. Sem markdown, sem explicação.
```

E reforçar que cada campo deve ser **conciso** (máx 2-3 frases por seção do script) para não estourar tokens com 5+ scripts.

#### 4. Melhorar `extractJson`

Tornar mais robusto — se o JSON estiver incompleto (sem `}` final ou com chaves não fechadas), tentar fechar contando brackets. Última linha de defesa antes de mostrar erro.

#### 5. UX: mostrar progresso real do streaming

Hoje o `streamingText` é populado mas **não é exibido em lugar nenhum** no UI durante o loading. Adicionar um box mono pequeno abaixo do botão "Gerar" mostrando os últimos ~300 chars do que está chegando — assim o usuário vê que está acontecendo algo e percebe quando truncou.

### Arquivos alterados

- `src/routes/api/public/generate-scripts.ts` — `max_tokens: 16000`, prefill de assistente
- `src/server/generate-scripts.ts` — prompt mais rígido sobre formato + `extractJson` mais robusto
- `src/routes/index.tsx` — capturar `stop_reason`, prepend `{` no fullText, mostrar streaming preview no UI, mensagens de erro específicas

### Sem mudança visual fora do streaming preview

Tudo continua igual exceto pela caixinha mono que aparece durante a geração, mostrando o JSON sendo cuspido em tempo real.

