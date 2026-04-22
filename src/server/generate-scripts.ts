import { createServerFn } from "@tanstack/react-start";
import type { BriefingInput, GenerateResult } from "@/lib/criativo-types";

function buildPrompt(b: BriefingInput) {
  return `Você é um copywriter direto-ao-resposta com 15 anos de experiência em performance marketing no Brasil. Já escreveu para os maiores lançamentos do país e gerenciou criativos que movimentaram mais de R$50 milhões em tráfego pago.

Você NÃO escreve copy de agência. Você escreve como alguém que entende profundamente de comportamento humano, gatilhos primitivos e da realidade específica do público brasileiro.

Suas regras absolutas:
— Nunca use palavras como "incrível", "revolucionário", "exclusivo", "transformador" ou qualquer adjetivo vazio
— Nunca comece com pergunta retórica óbvia
— A copy deve soar como alguém falando no bar, não num palco
— Cada frase deve ganhar o direito de existir

BRIEFING:
- Produto: ${b.produto}
- URL/Referência: ${b.url || "não informado"}
- Público: ${b.publico}
- Dor principal: ${b.dor}
- Transformação prometida: ${b.transformacao}
- Prova social: ${b.prova || "sem prova ainda"}
- Tom: ${b.tom}
- Plataforma: ${b.plataforma}
- Duração: ${b.duracao}
- Referência de concorrente: ${b.concorrente || "nenhuma"}

Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato:

{
  "analise": {
    "momento_de_vida": "descrição detalhada",
    "conversa_interna": "o que o cliente já pensa e tentou",
    "vergonha_oculta": "o que nunca falaria em voz alta",
    "desejo_real": "o que quer SENTIR, não comprar",
    "objecao_principal": "por que NÃO vai comprar"
  },
  "scripts": [
    {
      "angulo": "nome do ângulo (ex: Vergonha oculta)",
      "nivel_consciencia": "Nível 2 - Com Dor",
      "duracao": "${b.duracao}",
      "hook": "texto do hook aqui",
      "agitacao": "texto da agitação aqui",
      "virada": "texto da virada aqui",
      "prova": "texto da prova aqui",
      "cta": "texto do CTA aqui",
      "estrategia": "nota estratégica: por que esse ângulo, qual objeção neutraliza, onde performa melhor"
    }
  ],
  "guia_producao": {
    "perfil_avatar": "perfil ideal do avatar HeyGen para esse público",
    "voz": "tom e velocidade recomendados",
    "visual": "orientações de fundo, iluminação e estilo visual",
    "edicao": "orientações de corte, legenda e ritmo",
    "checklist": ["item 1", "item 2", "item 3", "item 4", "item 5"]
  }
}

Gere exatamente ${b.numScripts} scripts com ângulos diferentes: vergonha oculta, situação cotidiana específica, história de terceiro, consequência futura se nada mudar, e quebra de crença limitante.`;
}

function extractJson(text: string): string {
  const cleaned = text.replace(/```json|```/g, "").trim();
  if (cleaned.startsWith("{")) return cleaned;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export const generateScripts = createServerFn({ method: "POST" })
  .inputValidator((input: { briefing: BriefingInput }) => input)
  .handler(async ({ data }): Promise<GenerateResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: buildPrompt(data.briefing) }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Anthropic API error", res.status, errText);
      if (res.status === 429 || res.status === 529) {
        throw new Error("Claude está sobrecarregado. Tente novamente em alguns segundos.");
      }
      if (res.status === 401) {
        throw new Error("Chave da Anthropic inválida.");
      }
      throw new Error(`Erro na API do Claude (${res.status}).`);
    }

    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = (json.content || []).map((b) => b.text || "").join("");

    let parsed: {
      analise: GenerateResult["analise"];
      scripts: GenerateResult["scripts"];
      guia_producao: GenerateResult["guiaProducao"];
    };
    try {
      parsed = JSON.parse(extractJson(text));
    } catch (e) {
      console.error("Falha ao parsear JSON do Claude:", text.slice(0, 500));
      throw new Error("Claude retornou uma resposta em formato inválido. Tente novamente.");
    }

    if (!parsed.analise || !Array.isArray(parsed.scripts) || !parsed.guia_producao) {
      throw new Error("Resposta do Claude está incompleta. Tente novamente.");
    }

    return {
      analise: parsed.analise,
      scripts: parsed.scripts,
      guiaProducao: parsed.guia_producao,
    };
  });