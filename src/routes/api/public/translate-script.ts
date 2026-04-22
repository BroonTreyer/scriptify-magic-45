import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ScriptSchema = z.object({
  angulo: z.string(),
  nivel_consciencia: z.string(),
  duracao: z.string(),
  hook: z.string(),
  agitacao: z.string(),
  virada: z.string(),
  prova: z.string(),
  cta: z.string(),
  estrategia: z.string(),
});

const Body = z.object({
  script: ScriptSchema,
  targetLang: z.string().min(2).max(20), // ex: "en", "es", "fr", "it", "de"
  targetLangLabel: z.string().min(2).max(40), // ex: "Inglês (EUA)"
});

const TOOL = {
  name: "translate_script",
  description:
    "Devolve o script publicitário traduzido e culturalmente adaptado, mantendo a mesma estrutura.",
  input_schema: {
    type: "object",
    properties: {
      angulo: { type: "string" },
      nivel_consciencia: { type: "string" },
      duracao: { type: "string" },
      hook: { type: "string" },
      agitacao: { type: "string" },
      virada: { type: "string" },
      prova: { type: "string" },
      cta: { type: "string" },
      estrategia: { type: "string" },
    },
    required: [
      "angulo",
      "nivel_consciencia",
      "duracao",
      "hook",
      "agitacao",
      "virada",
      "prova",
      "cta",
      "estrategia",
    ],
  },
};

export const Route = createFileRoute("/api/public/translate-script")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: "Parâmetros inválidos.",
              detail: e instanceof Error ? e.message : String(e),
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const userPrompt = `Traduza o script publicitário abaixo (originalmente em PT-BR) para **${parsed.targetLangLabel}** (código: ${parsed.targetLang}).

REGRAS DE TRADUÇÃO:
- NÃO faça tradução literal. Adapte culturalmente: gírias, referências, métricas locais, exemplos.
- Mantenha o tom, ritmo e impacto emocional do original — mesma punch, mesma cadência.
- Preserve a estrutura HOOK → AGITAÇÃO → VIRADA → PROVA → CTA com o mesmo timing.
- "duracao" e "nivel_consciencia" continuam em PT-BR (são metadados internos).
- "angulo" e "estrategia" também ficam em PT-BR (notas internas para o time).
- APENAS hook, agitacao, virada, prova e cta vão para o idioma alvo.
- Se o público brasileiro mencionado não fizer sentido no idioma alvo, adapte para um equivalente cultural plausível (ex: "Real" → "Dollar"/"Euro", "PIX" → "Zelle"/"SEPA").

SCRIPT ORIGINAL (JSON):
${JSON.stringify(parsed.script, null, 2)}

Use a tool "translate_script" para devolver o resultado.`;

        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 2000,
            tools: [TOOL],
            tool_choice: { type: "tool", name: "translate_script" },
            messages: [{ role: "user", content: userPrompt }],
          }),
        });

        const raw = await claudeRes.text();
        if (!claudeRes.ok) {
          let msg = `Erro Claude (${claudeRes.status}).`;
          if (claudeRes.status === 401) msg = "Chave Anthropic inválida.";
          else if (claudeRes.status === 429 || claudeRes.status === 529)
            msg = "Claude sobrecarregado. Tente novamente em alguns segundos.";
          return new Response(JSON.stringify({ error: msg, detail: raw }), {
            status: claudeRes.status,
            headers: { "content-type": "application/json" },
          });
        }

        let json: {
          content?: Array<{ type?: string; name?: string; input?: unknown }>;
        } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          return new Response(
            JSON.stringify({ error: "Resposta do Claude inválida.", detail: raw }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        const toolBlock = json.content?.find(
          (b) => b.type === "tool_use" && b.name === "translate_script",
        );
        if (!toolBlock?.input) {
          return new Response(
            JSON.stringify({
              error: "Claude não retornou o tool_use esperado.",
              detail: raw,
            }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        const validated = ScriptSchema.safeParse(toolBlock.input);
        if (!validated.success) {
          return new Response(
            JSON.stringify({
              error: "Tradução incompleta.",
              detail: validated.error.message,
            }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ script: validated.data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
