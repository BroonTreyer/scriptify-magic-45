## Aplicar 3 melhorias do diagnóstico do pipeline

### 1. Filtrar vozes PT-BR nativas do HeyGen (esconder clones com nomes ruins)
**Arquivo:** `src/routes/api/public/heygen/voices.ts`
- Hoje retorna todas as voices com `language === "portuguese"`, incluindo voices clonadas pelo dono da conta com nomes tipo `"ADS 08 - GANCHO 01.mp4"`.
- Adicionar filtro: manter apenas vozes com `gender` definido (`male`/`female`) E excluir nomes que pareçam upload (regex: contém `.mp4`, `.mp3`, `.wav`, ou prefixo `ADS `, `GANCHO `, números longos no início).
- Manter shape de resposta intacto.

### 2. Mensagem amigável para crédito insuficiente no polling de status
**Arquivo:** `src/routes/api/public/heygen/status.$videoId.ts`
- Quando o HeyGen retorna `status: "failed"` com `error.code === "MOVIO_PAYMENT_INSUFFICIENT_CREDIT"` (ou `error.message` contendo isso), trocar por mensagem PT-BR: `"Créditos do HeyGen esgotados. Recarregue em app.heygen.com para continuar gerando vídeos."`
- Mapear também outros códigos comuns (`MOVIO_*`) para fallback genérico claro.
- Já existe mapeamento similar em `generate.ts`; reaproveitar a mesma lógica.

### 3. Esconder slider de `speed` quando voz clonada/áudio externo
**Arquivo:** `src/components/HeygenDrawer.tsx` (e/ou `UGCStudio.tsx` onde o slider mora)
- O endpoint `generate-with-audio` envia áudio pronto pro HeyGen — o parâmetro `speed` é ignorado nesse modo.
- Esconder (ou desabilitar com tooltip explicativo) o slider de velocidade quando o usuário selecionar voz clonada ElevenLabs.
- Mostrar normalmente quando voz nativa HeyGen estiver selecionada.

### Validação
- Rodar `bun run lint` se aplicável.
- Reabrir o drawer no preview e confirmar:
  - Lista de vozes PT-BR mostra só nomes humanos.
  - Slider de velocidade some ao escolher voz clonada.
- Não vou re-executar o teste end-to-end (consome créditos); a mudança de mensagem do polling será verificada por leitura do código.

### Fora do escopo
- Não vou recarregar créditos do HeyGen (ação do usuário).
- Não vou mexer em copy generation nem fluxo de geração (já validados).
