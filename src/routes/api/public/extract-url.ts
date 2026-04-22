import { createFileRoute } from "@tanstack/react-router";

type FirecrawlScrapeResp = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; description?: string; sourceURL?: string };
  };
  error?: string;
  markdown?: string;
  metadata?: { title?: string; description?: string };
};

type ExtractedBriefing = {
  produto: string;
  publico: string;
  dor: string;
  transformacao: string;
  prova: string;
  tom: string;
};

const TOM_VALUES = [
  "Agressivo / Urgência",
  "Emocional",
  "Educativo",
  "Humor / Provocação",
];

export const Route = createFileRoute("/api/public/extract-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!FIRECRAWL_API_KEY) {
          return json({ error: "FIRECRAWL_API_KEY não configurada." }, 500);
        }
        if (!LOVABLE_API_KEY) {
          return json({ error: "LOVABLE_API_KEY não configurada." }, 500);
        }

        let url: string;
        try {
          const body = (await request.json()) as { url?: string };
          if (!body.url || typeof body.url !== "string") throw new Error();
          url = body.url.trim();
          // Validate URL
          new URL(url);
        } catch {
          return json({ error: "URL inválida." }, 400);
        }

        // 1) Scrape com Firecrawl
        const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });

        if (!fcRes.ok) {
          const t = await fcRes.text().catch(() => "");
          console.error("Firecrawl error", fcRes.status, t);
          if (fcRes.status === 402) {
            return json(
              { error: "Firecrawl sem créditos. Recarregue na sua conta." },
              402,
            );
          }
          return json(
            { error: `Falha ao raspar a página (${fcRes.status}).` },
            502,
          );
        }

        const fcData = (await fcRes.json()) as FirecrawlScrapeResp;
        const markdown =
          fcData.data?.markdown ?? fcData.markdown ?? "";
        const meta = fcData.data?.metadata ?? fcData.metadata ?? {};
        if (!markdown || markdown.trim().length < 50) {
          return json(
            { error: "Página retornou conteúdo vazio ou insuficiente." },
            422,
          );
        }

        // 2) Extrai briefing via Lovable AI Gateway com tool calling
        const truncated = markdown.slice(0, 12000);
        const sysPrompt =
          "Você é um copywriter sênior especializado em ads. Dado o conteúdo de uma landing page, extrai um briefing acionável para criação de scripts publicitários. Responde sempre em português do Brasil. Seja específico, evite genéricos.";
        const userPrompt = `URL: ${url}\nTÍTULO: ${meta.title ?? ""}\nDESCRIÇÃO: ${meta.description ?? ""}\n\nCONTEÚDO DA PÁGINA (markdown):\n${truncated}\n\nExtraia o briefing usando a tool extract_briefing.`;

        const aiRes = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: sysPrompt },
                { role: "user", content: userPrompt },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "extract_briefing",
                    description:
                      "Extrai briefing publicitário a partir do conteúdo de uma landing page.",
                    parameters: {
                      type: "object",
                      properties: {
                        produto: {
                          type: "string",
                          description:
                            "Nome + descrição curta do produto/serviço (1-2 frases).",
                        },
                        publico: {
                          type: "string",
                          description:
                            "Público-alvo específico: idade, profissão, contexto, nível socioeconômico.",
                        },
                        dor: {
                          type: "string",
                          description:
                            "Principal dor/problema que o público enfrenta — concreta, com exemplo.",
                        },
                        transformacao: {
                          type: "string",
                          description:
                            "Transformação prometida: como o cliente sai depois de usar o produto.",
                        },
                        prova: {
                          type: "string",
                          description:
                            "Provas sociais, números, depoimentos, garantias ou diferenciais mencionados na página.",
                        },
                        tom: {
                          type: "string",
                          enum: TOM_VALUES,
                          description:
                            "Tom recomendado para os ads dado o produto e público.",
                        },
                      },
                      required: [
                        "produto",
                        "publico",
                        "dor",
                        "transformacao",
                        "prova",
                        "tom",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: {
                type: "function",
                function: { name: "extract_briefing" },
              },
            }),
          },
        );

        if (!aiRes.ok) {
          const t = await aiRes.text().catch(() => "");
          console.error("AI gateway error", aiRes.status, t);
          if (aiRes.status === 429) {
            return json(
              { error: "Limite de requisições. Aguarde alguns segundos." },
              429,
            );
          }
          if (aiRes.status === 402) {
            return json(
              {
                error:
                  "Créditos do Lovable AI esgotados. Adicione em Settings > Workspace > Usage.",
              },
              402,
            );
          }
          return json(
            { error: `Falha na extração com IA (${aiRes.status}).` },
            502,
          );
        }

        const aiJson = (await aiRes.json()) as {
          choices?: Array<{
            message?: {
              tool_calls?: Array<{
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
        };
        const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
        const argsStr = toolCall?.function?.arguments;
        if (!argsStr) {
          return json(
            { error: "IA não retornou estrutura esperada." },
            502,
          );
        }
        let extracted: ExtractedBriefing;
        try {
          const parsed = JSON.parse(argsStr) as Partial<ExtractedBriefing>;
          extracted = {
            produto: parsed.produto ?? "",
            publico: parsed.publico ?? "",
            dor: parsed.dor ?? "",
            transformacao: parsed.transformacao ?? "",
            prova: parsed.prova ?? "",
            tom: TOM_VALUES.includes(parsed.tom ?? "")
              ? (parsed.tom as string)
              : "Emocional",
          };
        } catch {
          return json({ error: "JSON inválido da IA." }, 502);
        }

        return json({ briefing: extracted, sourceUrl: url });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
