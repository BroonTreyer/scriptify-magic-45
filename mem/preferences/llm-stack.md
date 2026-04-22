---
name: LLM stack (Claude default)
description: Padrão obrigatório para qualquer chamada de LLM no projeto — endpoint, headers, modelos, streaming e tool use.
type: preference
---
**Provider padrão:** Anthropic Claude. Lovable AI / Gemini NÃO devem ser usados a menos que o usuário peça explicitamente.

**Secret:** `process.env.ANTHROPIC_API_KEY` (já configurada no projeto).

**Endpoint:** `https://api.anthropic.com/v1/messages`

**Headers obrigatórios:**
- `x-api-key: <ANTHROPIC_API_KEY>`
- `anthropic-version: 2023-06-01`
- `Content-Type: application/json`

**Modelos:**
- Default: `claude-sonnet-4-5` (qualidade alta, uso geral).
- Quando velocidade > qualidade: `claude-haiku-4-5`.

**Padrão de streaming SSE:** seguir exatamente `src/routes/api/public/generate-scripts.ts` — repassar `claudeRes.body` com headers `text/event-stream`, `cache-control: no-cache, no-transform`, `x-accel-buffering: no`. Tratar 401 (chave inválida), 429/529 (sobrecarga) com mensagens em PT-BR.

**Extração estruturada:** usar tool use nativo do Claude (não pedir JSON no prompt). Definir `tools: [{ name, description, input_schema }]` + `tool_choice: { type: "tool", name }`. Ler resposta de `content[0].input`.

**Template para novas rotas:** copiar a estrutura de `generate-scripts.ts` (validação Zod, tratamento de erro, mensagens PT-BR).

**Como aplicar:** Toda nova rota em `src/routes/api/public/**` que precisar de LLM segue este padrão. Antes de propor Lovable AI / Gemini, confirme com o usuário.
