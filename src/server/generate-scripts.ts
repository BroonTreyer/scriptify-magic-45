import type { BriefingInput } from "@/lib/criativo-types";

export function buildPrompt(b: BriefingInput) {
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

Gere exatamente ${b.numScripts} scripts com ângulos diferentes: vergonha oculta, situação cotidiana específica, história de terceiro, consequência futura se nada mudar, e quebra de crença limitante.

IMPORTANTE: Seja CONCISO. Cada campo (hook, agitacao, virada, prova, cta) deve ter no máximo 2-3 frases curtas. Estratégia em 1-2 frases. Não enrole.

CRÍTICO DE FORMATO: Comece sua resposta DIRETAMENTE com { e termine com }. Nada antes, nada depois. Sem markdown, sem \`\`\`json, sem explicação. Apenas JSON válido puro.`;
}

export function extractJson(text: string): string {
/**
 * Lightweight extraction: strips markdown fences and any text before the
 * first '{' / after the last '}'. Does NOT attempt to repair truncated JSON
 * — that would mask real stream interruptions. Use `repairJson` explicitly
 * as a controlled fallback if needed.
 */
export function extractJson(text: string): string {
  let cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start > 0) cleaned = cleaned.slice(start);
  else if (start === -1) return cleaned;
  const lastClose = cleaned.lastIndexOf("}");
  if (lastClose !== -1) cleaned = cleaned.slice(0, lastClose + 1);
  return cleaned;
}

/**
 * Last-resort repair: closes open strings and brackets so a truncated
 * payload can at least be parsed. Should NOT be used silently in the
 * main flow — only as an explicit fallback when the caller decides
 * partial data is acceptable.
 */
export function repairJson(text: string): string {
  let cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start > 0) cleaned = cleaned.slice(start);
  else if (start === -1) return cleaned;

  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let repaired = cleaned.replace(/,\s*$/, "");
  if (inString) repaired += '"';
  while (stack.length) repaired += stack.pop();
  return repaired;
}
