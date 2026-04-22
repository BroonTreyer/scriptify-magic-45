

## Atualizar prompt do Claude com framework completo do copywriter

### O que muda

Substituir o `buildPrompt` em `src/server/generate-scripts.ts` para incluir o framework completo que você passou: análise estratégica detalhada, regras absolutas do copywriter, estrutura detalhada de cada bloco do script (hook/agitação/virada/prova/cta com instruções específicas), variações obrigatórias entre scripts, e o checklist de qualidade.

### Como vou montar

O prompt novo terá esta ordem:

1. **Persona do copywriter** — 15 anos, performance BR, R$50M, regras absolutas (nada de "incrível/revolucionário", nada de pergunta retórica óbvia, nada de "Problema→Solução→CTA mecânico", soar como bar não palco, cada frase ganhar direito de existir).

2. **Briefing recebido** — interpolando os campos do `BriefingInput` (produto, público, dor, transformação, prova, tom, plataforma, duração, concorrente, URL).

3. **Instruções de produção** — gerar `${b.numScripts}` scripts seguindo a estrutura detalhada de HOOK / AGITAÇÃO / VIRADA / PROVA / CTA, com as descrições completas que você passou (o que cada bloco PODE ser, o que NÃO PODE ser).

4. **Variações obrigatórias** — vergonha oculta, situação cotidiana, história de terceiro, consequência futura, quebra de crença.

5. **Checklist de qualidade interno** — instruir o Claude a passar cada script pelo filtro antes de entregar (sem retornar o checklist no JSON, só usar como auto-validação).

6. **Formato de saída JSON estrito** — manter o mesmo schema atual (`analise`, `scripts[]`, `guia_producao`) para não quebrar a UI. Cada script continua tendo `angulo`, `nivel_consciencia`, `duracao`, `hook`, `agitacao`, `virada`, `prova`, `cta`, `estrategia` (a `estrategia` agora consolida: ângulo + por quê + objeção neutralizada + onde performa melhor + sugestão visual).

7. **Regras de formato JSON** — manter as instruções rígidas atuais (começar com `{`, sem markdown, sem texto extra) porque são essenciais pro parser SSE não quebrar.

### O que NÃO muda

- Schema do JSON de saída (mantém compatível com `Analise`, `Script`, `GuiaProducao` em `src/lib/criativo-types.ts`).
- `extractJson` / `repairJson`.
- Rota `/api/public/generate-scripts` (continua proxy server-side com `claude-sonnet-4-5` e `max_tokens: 16000`).
- UI em `src/routes/index.tsx` (cards, copiar, navegação).
- Visual (preto, vermelho, fontes).

### Trade-off importante

O prompt vai ficar ~3x mais longo (gasta ~1.5k tokens só de input). Isso é aceitável — Claude segue melhor instruções detalhadas e a qualidade dos scripts vai subir bastante. Não impacta o `max_tokens` de saída.

### Arquivos alterados

- `src/server/generate-scripts.ts` — só a função `buildPrompt` (mantém `extractJson` e `repairJson` intactos).

### Resultado

Scripts mais afiados, com voz real de copywriter BR, variações de ângulo garantidas, e estrutura de bloco respeitada. A UI exibe tudo igual — só o conteúdo gerado fica melhor.

