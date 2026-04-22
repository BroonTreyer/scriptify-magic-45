

## Ajustes no CriativoOS

Vou aplicar os 8 ajustes pedidos. **Antes**, um ponto importante sobre o item 1 (headers da Anthropic):

### ⚠ Sobre chamar a Anthropic direto do browser

Você pediu para usar `import.meta.env.VITE_ANTHROPIC_API_KEY` + header `anthropic-dangerous-direct-browser-access`. Isso **expõe sua chave da Anthropic publicamente** — qualquer pessoa que abrir o site pode pegar a chave do bundle e gastar seus créditos. O próprio nome do header ("dangerous") é o aviso da Anthropic.

Hoje o sistema já funciona do jeito **seguro**: a chave (`ANTHROPIC_API_KEY`, sem `VITE_`) fica só no servidor, e o browser chama `/api/public/generate-scripts` que faz proxy do streaming. Mesmas headers que você listou já são aplicadas lá dentro — só que escondidas do público.

**Recomendação:** manter o proxy server-side atual e ignorar o item 1. Os outros 7 ajustes vão todos do mesmo jeito.

Se mesmo assim quiser browser-direct (ex: app interno, demo rápido), eu troco — mas saiba que vai ter que rotacionar a chave depois e que os streams do browser vão começar a expor sua quota.

---

### Mudanças que vou fazer (assumindo manter proxy seguro)

**`src/routes/index.tsx`:**

1. **Loading com mensagens rotativas** — já existe (`LOADING_MSGS` + `setInterval` a cada 2.5s). Vou só confirmar que está ativo e rotacionando os 5 textos exatos que você listou (já estão idênticos).

2. **Copiar script completo (formato novo)** — substituir o `copy()` do `ScriptCard` para gerar:
   ```
   HOOK (0–3s):
   [hook]

   AGITAÇÃO (3–15s):
   [agitacao]

   VIRADA (15–20s):
   [virada]

   PROVA (20–35s):
   [prova]

   CTA (últimos 5s):
   [cta]

   ÂNGULO: [angulo]
   NOTA ESTRATÉGICA: [estrategia]
   ```

3. **Botão "COPIAR TODOS"** — adicionar acima da lista de cards na etapa `scripts`. Concatena todos os scripts numerados (`#1`, `#2`...) usando o mesmo formato do item 2, separados por `---`. Estado `copied` próprio + feedback visual.

4. **Navegação ← / → entre as 4 etapas** — hoje:
   - briefing → análise: ok (botão "Gerar")
   - análise ↔ scripts: ok
   - scripts → produção: ok, mas **falta voltar de scripts pra análise no header** (já tem botão "← ANÁLISE", ok) e **falta um ← na etapa produção** voltando pra scripts.
   Vou auditar e garantir que cada etapa tenha botão ← e → consistentes.

5. **Responsivo mobile do briefing** — o grid já usa `grid-cols-1 sm:grid-cols-2`, mas vou:
   - Garantir padding lateral adequado em telas pequenas (`px-4 sm:px-6`)
   - Reduzir tamanho do hero h2 no mobile (já tem `text-5xl sm:text-6xl`, ok)
   - Verificar que ChoiceGroup quebra bem (já tem `flex-wrap`, ok)
   - Ajustar header da etapa scripts (`flex justify-between` pode apertar no mobile) — mudar para `flex-col sm:flex-row`

6. **Error handling melhor** — já mostra mensagens específicas (max_tokens, JSON inválido, conexão interrompida, parcial). Vou adicionar: se o JSON parsear parcialmente (tem `analise` mas falta `guia_producao`, por exemplo), mostrar o que tiver em vez de bloquear tudo — fallbacks vazios para campos faltantes em vez de jogar erro.

**`src/routes/api/public/generate-scripts.ts`:** sem mudança (continua proxy server-side).

**`src/server/generate-scripts.ts`:** sem mudança (prompt e helpers já estão bons).

### Estilo
Sem mudanças visuais — mantém `#080808`, `#ff2d2d`, Bebas Neue / DM Sans / Space Mono.

### Modelo
Já está em `claude-sonnet-4-5` com `max_tokens: 16000` (mais novo e maior que o `claude-sonnet-4-20250514` / 4000 que você citou). Mantenho como está, a menos que prefira reverter.

### Arquivos alterados
- `src/routes/index.tsx` (itens 2, 3, 4, 5, 6 + ajustes mobile)

### Confirme antes de eu implementar
- [ ] Manter proxy seguro server-side (recomendado) **OU** mudar para browser-direct expondo a chave?
- [ ] Manter `claude-sonnet-4-5` + 16000 tokens **OU** voltar para `claude-sonnet-4-20250514` + 4000?

Se não responder, sigo com **proxy seguro + claude-sonnet-4-5 + 16000 tokens** e implemento os 7 ajustes restantes.

