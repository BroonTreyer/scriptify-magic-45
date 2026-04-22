
## Corrigir o falso erro “Resposta do Claude está incompleta”

### Problema real

O erro atual não parece mais ser “falta de tokens” como causa principal. Pelo fluxo atual, o problema mais provável está no **parser do stream no cliente**:

1. O código lê o SSE quebrando por `\n`, não por **blocos SSE completos** (`\n\n`).
2. Quando o stream termina, o **resto do buffer final não é processado**.
3. Isso pode fazer o app **perder o `message_delta.stop_reason` e o `message_stop`**, ou até o último trecho do JSON.
4. Depois disso, `extractJson()` tenta “consertar” o JSON truncado fechando chaves automaticamente, o que transforma uma resposta cortada em um JSON “válido porém incompleto”.
5. Resultado: em vez de mostrar “stream foi interrompido” ou “Claude bateu no limite”, a UI cai no erro genérico:
   - `Resposta do Claude está incompleta. Tente novamente.`

### O que vou mudar

#### 1. Reescrever o parser SSE no cliente
Em `src/routes/index.tsx`:

- Trocar o parser atual baseado em linhas por um parser de **eventos SSE completos**.
- Acumular chunks em `buffer` e processar por separador de evento `\n\n`.
- Ler corretamente:
  - `content_block_delta`
  - `message_delta`
  - `message_stop`
  - `ping`
- Fazer **flush do buffer restante no final** antes de concluir a leitura.

### 2. Só aceitar sucesso se o stream terminou de verdade
Ainda em `src/routes/index.tsx`:

- Rastrear:
  - `stopReason`
  - `sawMessageStop`
  - `receivedAnyContent`
- Antes de fazer `JSON.parse`, validar que o stream realmente chegou ao fim.
- Se `message_stop` não vier, mostrar erro específico, por exemplo:
  - `A conexão com o Claude foi interrompida antes do fim da resposta. Tente novamente.`
- Se `stop_reason === "max_tokens"`, manter a mensagem específica de limite.
- Se houver `end_turn` mas o JSON estiver inválido, mostrar:
  - `Claude retornou JSON inválido. Tente novamente.`

### 3. Parar de “mascarar” resposta truncada como se fosse válida
Em `src/server/generate-scripts.ts`:

- Separar a lógica de:
  - **extrair JSON** de texto com lixo antes/depois
  - **reparar JSON truncado**
- O fluxo principal deve usar apenas extração/limpeza leve.
- O reparo agressivo de fechar chaves automaticamente não deve ser a defesa padrão para resposta de stream, porque hoje ele esconde o erro real.
- Se eu mantiver a função de repair, ela fica como fallback controlado e só quando fizer sentido.

### 4. Fortalecer a validação da estrutura recebida
Em `src/routes/index.tsx`:

- Validar explicitamente:
  - `analise` com os campos esperados
  - `scripts` como array não vazio
  - `guia_producao` com `perfil_avatar`, `voz`, `visual`, `edicao`, `checklist`
- Opcionalmente validar se o número de scripts retornado bate com `form.numScripts`.
- Se vier menos conteúdo do que o esperado, mostrar erro claro de resposta parcial em vez de seguir o fluxo.

### 5. Manter a UX atual, mas com diagnóstico correto
A UI continua praticamente igual:
- preview do streaming continua
- botão e loading continuam
- só melhoram as mensagens de erro

Mensagens finais ficam separadas por causa real:
- limite de tokens
- stream interrompido
- JSON inválido
- resposta parcial/incompleta

### Arquivos afetados

- `src/routes/index.tsx`
  - parser SSE robusto
  - flush do buffer final
  - rastreamento de `message_stop`
  - tratamento de erro mais preciso
  - validação estrutural mais forte

- `src/server/generate-scripts.ts`
  - refatorar `extractJson`
  - remover o repair agressivo do caminho principal
  - deixar parsing mais seguro para resposta de stream

- `src/routes/api/public/generate-scripts.ts`
  - ajuste pequeno só se necessário para manter headers de streaming consistentes
  - a principal correção não está aqui; está no cliente

### Resultado esperado

Depois dessa correção, o sistema vai distinguir corretamente entre:
- resposta completa do Claude
- resposta cortada/interrompida
- limite de tokens
- JSON realmente inválido

Isso elimina o falso positivo de “resposta incompleta” causado pelo parser atual e evita que JSON truncado seja aceito como se fosse apenas “parcial”.
