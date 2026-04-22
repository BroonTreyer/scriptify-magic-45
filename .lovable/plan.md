

# Regra de stack de IA

Salvar preferência permanente: **Claude (Anthropic) é o LLM padrão de toda a aplicação. Lovable AI / Gemini só como fallback ou quando explicitamente solicitado.**

## O que vai mudar

### 1. Memória do projeto
- Criar `mem://index.md` com regra Core: "LLM padrão = Claude (Anthropic via `ANTHROPIC_API_KEY`). Lovable AI/Gemini só como fallback explícito."
- Criar `mem://preferences/llm-stack.md` detalhando: modelo padrão `claude-sonnet-4-5`, endpoint `https://api.anthropic.com/v1/messages`, header `x-api-key`, version `2023-06-01`, padrão de streaming SSE igual ao já usado em `generate-scripts.ts`.

### 2. Auditoria das rotas existentes
Hoje só `src/routes/api/public/generate-scripts.ts` usa Claude. As outras rotas chamam APIs específicas (HeyGen, ElevenLabs) — não são LLM, então ficam como estão.

Não há nenhum uso atual de Lovable AI / Gemini no código, então não há migração retroativa necessária.

### 3. Atualização do plano (`.lovable/plan.md`)
Trocar as referências a "Lovable AI Gateway (gemini-3-flash-preview)" por **Claude (`claude-sonnet-4-5`)** nos blocos que ainda vão ser implementados:
- **Bloco 1** (URL → Briefing): extração estruturada via Claude com tool use (`input_schema` JSON), não Gemini.
- **Bloco 5** (Multi-idioma): tradução de scripts via Claude.
- **Bloco 6** (UGC insights): análise pós-transcrição via Claude.
- **Bloco 7** (Performance): análise de padrões de criativos via Claude.

### 4. Padrão para novas rotas
Toda nova rota que precisar de LLM deve seguir o template de `generate-scripts.ts`:
- `process.env.ANTHROPIC_API_KEY` (já configurada)
- Modelo `claude-sonnet-4-5` por padrão (ou `claude-haiku-4-5` quando velocidade > qualidade)
- Streaming quando o output for longo, non-stream + tool use quando for extração estruturada

## Próximo passo após salvar a regra

Sigo com o **Bloco 4 (Editor + legendas client-only)** que você ainda não confirmou, ou pulo pra outro bloco se preferir. Me diz qual.

