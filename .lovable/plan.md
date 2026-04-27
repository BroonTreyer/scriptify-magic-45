## Causa raiz

O erro "A conexão com o Claude foi interrompida antes do fim da resposta" dispara quando:

1. O stream do Claude **chega completo ou quase completo**, mas
2. `extractJson()` corta no último `}` — se o último `}` está num campo de meio do JSON (porque o final ficou truncado num campo string), o resultado é um JSON malformado, e
3. `JSON.parse` quebra → como `sawMessageStop` é `false` (Cloudflare Worker às vezes encerra o body antes do evento final), o código dispara o erro de "interrompida".

Já existe `repairJson()` em `src/server/generate-scripts.ts` exatamente pra esse caso (fecha aspas e brackets abertos), mas o frontend **nunca o usa**. Vamos plugá-lo.

## Mudanças

### 1. `src/routes/index.tsx` — cascata de parsing (linhas ~773–812)

Substituir o bloco `try { parsed = JSON.parse(extractJson(fullText)); } catch { ... }` por uma cascata de 3 níveis:

```ts
import { extractJson, repairJson } from "@/server/generate-scripts";

// ...

let parsed: { analise?: Analise; scripts?: Script[]; guia_producao?: GuiaProducao } | null = null;

// Nível 1: parse limpo
try {
  parsed = JSON.parse(extractJson(fullText));
} catch { /* tenta nível 2 */ }

// Nível 2: repair (fecha aspas/brackets pendentes)
if (!parsed) {
  try {
    parsed = JSON.parse(repairJson(fullText));
    console.warn("[generate-scripts] usado repairJson — stream truncado mas recuperado");
  } catch { /* tenta nível 3 */ }
}

// Nível 3: nada deu → erro contextual
if (!parsed) {
  if (!receivedAnyContent) {
    throw new Error("A conexão com o Claude foi interrompida antes de qualquer resposta. Tente novamente.");
  }
  throw new Error(
    "Resposta do Claude veio incompleta. Tente reduzir o número de scripts (ex: 5) e gerar de novo.",
  );
}
```

Depois, **filtrar scripts válidos** (descartar entradas truncadas com campos faltando):

```ts
const rawScripts = Array.isArray(parsed.scripts) ? parsed.scripts : [];
const validScripts = rawScripts.filter(
  (s): s is Script =>
    !!s && typeof s === "object" &&
    typeof s.hook === "string" && s.hook.length > 0 &&
    typeof s.agitacao === "string" && s.agitacao.length > 0 &&
    typeof s.virada === "string" && s.virada.length > 0 &&
    typeof s.prova === "string" && s.prova.length > 0 &&
    typeof s.cta === "string" && s.cta.length > 0,
);

if (validScripts.length === 0) {
  throw new Error("Claude não retornou nenhum script completo. Tente novamente.");
}

if (validScripts.length < rawScripts.length) {
  toast.warning(
    `Recebemos ${validScripts.length} de ${rawScripts.length} scripts (alguns vieram cortados).`,
  );
}
```

E usar `validScripts` no lugar de `rawScripts` em `setScripts(...)` e no resto do fluxo.

### 2. Validação

- `npx tsc --noEmit` — confirmar zero erros.
- `bunx vitest run` — confirmar 8/8 testes passando (mudanças não tocam testes existentes).

## O que NÃO vou mudar

- **Não toco no backend** (`src/routes/api/public/generate-scripts.ts`) — o stream já está correto, o problema é puramente de parsing tolerante no cliente.
- **Não mudo `extractJson` / `repairJson`** — já estão prontos e cobertos pela arquitetura, só faltava conectar.
- **Não reduzo `max_tokens`** nem o número padrão de scripts — a cascata absorve o caso de truncamento sem precisar limitar o produto.

## Resultado esperado

- Streams completos: parsed direto pelo nível 1 (caminho feliz, igual hoje).
- Streams cortados perto do fim: nível 2 recupera, usuário recebe scripts (com toast de aviso se faltou algum).
- Streams cortados muito cedo: erro claro pedindo pra reduzir nº de scripts em vez do genérico atual.