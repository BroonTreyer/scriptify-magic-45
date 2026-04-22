

## CriativoOS — Sistema de geração de scripts publicitários com Claude

App de 4 etapas (Briefing → Análise → Scripts → Guia de Produção) que envia um briefing estruturado para a API do Claude (Anthropic) e renderiza a resposta em JSON em uma UI escura, estilo "performance marketing brutalista".

### Arquitetura

```text
[Browser /]  ──POST──▶  [Server Function: generateScripts]  ──▶  api.anthropic.com
   ▲                          (lê ANTHROPIC_API_KEY do                │
   │                           process.env, monta prompt,              │
   │                           parseia JSON da resposta)               │
   └──────────────  JSON { analise, scripts, guia_producao } ◀─────────┘
```

A chave da Anthropic **nunca** vai para o cliente — fica em uma server function do TanStack Start. Isso elimina o erro de CORS que o código original teria ao chamar `api.anthropic.com` direto do browser.

### Stack e arquivos

- `src/routes/index.tsx` — página única com as 4 etapas (state machine: `briefing | analise | scripts | producao`).
- `src/server/generate-scripts.ts` — server function `createServerFn` que recebe o briefing, chama Claude e retorna JSON tipado.
- `src/components/criativo/` — componentes reutilizáveis: `ProgressBar`, `BriefingForm`, `AnaliseView`, `ScriptCard`, `GuiaProducaoView`, `LoadingDots`, `SelectGroup`.
- `src/lib/criativo-types.ts` — tipos TS para `Analise`, `Script`, `GuiaProducao`, `BriefingInput`.
- `src/styles.css` — adicionar imports das fontes (Space Mono, DM Sans, Bebas Neue) e tokens de cor (`--brand-red: #ff2d2d`, `--bg: #080808`, etc).

### Fluxo de geração

1. Usuário preenche briefing (produto, público, dor, transformação, prova, tom, duração, plataforma, nº de scripts).
2. Validação client-side dos 4 campos obrigatórios.
3. `generateScripts({ briefing })` é chamada → server function monta o prompt (idêntico ao do código original), chama `https://api.anthropic.com/v1/messages` com modelo `claude-sonnet-4-5` e `max_tokens: 4000` (o original tinha 1000, insuficiente para 5+ scripts).
4. Server faz `JSON.parse` da resposta (limpando blocos markdown), valida estrutura mínima e devolve `{ analise, scripts, guiaProducao }`.
5. Cliente avança para etapa "análise" e o usuário navega entre etapas.

### Erros tratados

- `ANTHROPIC_API_KEY` ausente → 500 com mensagem clara.
- Claude retorna JSON malformado → server tenta extrair bloco `{...}` e re-parsear; se falhar, retorna erro amigável.
- 429 / 529 (rate limit / overloaded) → toast "Claude está sobrecarregado, tente em alguns segundos".
- Timeout / falha de rede → toast genérico de erro.

### Design (fiel ao mock)

- Fundo `#080808`, cards `#0d0d0d`, bordas `#1a1a1a`, vermelho de marca `#ff2d2d`.
- Tipografia: Bebas Neue (títulos), Space Mono (labels/UI técnica), DM Sans (corpo).
- Hero "SCRIPTS QUE PARAM O SCROLL E VENDEM" só aparece na etapa briefing.
- ProgressBar com 4 passos numerados, check verde nos concluídos.
- ScriptCard expansível com seções coloridas: HOOK (vermelho), AGITAÇÃO (laranja), VIRADA (verde), PROVA (azul), CTA (vermelho), Nota Estratégica (cinza). Botão COPIAR que copia o script formatado.
- Animação `fadeUp` entre etapas, `LoadingDots` pulsante durante a geração com mensagens rotativas ("Analisando o público…", "Gerando hooks…", etc).

### Segredo necessário

Vou pedir a `ANTHROPIC_API_KEY` como secret depois que você aprovar — você obtém em https://console.anthropic.com/settings/keys. Nada será chamado direto do browser, então a chave fica segura.

### O que fica fora deste plano (posso adicionar depois se quiser)

- Histórico/login (versão atual é stateless — recarregar limpa tudo).
- Export PDF do guia.
- Edição de scripts gerados.

