## Objetivo
Eliminar o aviso infinito de “Atualizado em outro dispositivo” e tornar o carregamento de avatares/vozes do HeyGen recuperável quando houver timeout.

## O que vou corrigir
1. Interromper o loop de sync em tempo real.
2. Evitar que a hidratação do backend gere eventos de volta para o próprio cliente.
3. Melhorar o modal HeyGen para não ficar preso em erro sem saída.
4. Validar que os ajustes não reintroduzem loops ou regressões.

## Diagnóstico
O loop principal está na hidratação do cache local:
- `syncOnLogin()` baixa dados do backend.
- Durante essa hidratação, ele chama `saveTranslations()` e `saveVideos()`.
- Essas funções gravam no `localStorage`, mas também fazem `push` para o backend.
- O `push` gera eventos realtime na tabela `translations`/`videos`.
- `useRealtimeSync()` recebe esses eventos, roda `syncOnLogin()` de novo e volta a exibir toast.

O erro do HeyGen é separado:
- `useHeygenAssets()` já trata timeout com mensagem amigável.
- Porém os componentes (`HeygenDrawer`, `UGCStudio`, `BatchMatrix`) não expõem um caminho claro de retry usando o `refresh()` já existente no hook.

## Implementação
### 1) Parar o eco de realtime na hidratação
- Ajustar os storages para permitir gravação local sem `push` para o backend durante hidratação.
- Aplicar isso em:
  - `src/lib/translation-storage.ts`
  - `src/lib/video-storage.ts`
- Atualizar `syncOnLogin()` em `src/lib/cloud-sync.ts` para usar modo “cache-only” ao reidratar dados vindos do backend.

### 2) Reduzir duplicação de toasts de sync
- Fortalecer `useRealtimeSync()` para ignorar ecos residuais do próprio ciclo de sincronização.
- Deduplicar notificações iguais em janela curta, especialmente para `translations`, que pode gerar muitos eventos em lote.
- Manter sync silencioso para tabelas que não precisam aviso.

### 3) Dar recuperação real ao erro do HeyGen
- Passar `refresh` retornado por `useHeygenAssets()` para a UI.
- Adicionar ação explícita de “Tentar novamente” nos componentes que usam esses assets:
  - `src/components/HeygenDrawer.tsx`
  - `src/components/UGCStudio.tsx`
  - `src/components/BatchMatrix.tsx`
- Se houver cache válido anterior, preservar os dados em vez de zerar a experiência desnecessariamente.

### 4) Validação
- Verificar que abrir o modal do HeyGen não dispara mais toasts de sync em cascata.
- Verificar que eventos em `translations` não entram mais em loop local → backend → realtime → local.
- Rodar checagem de tipos/testes após a implementação.

## Detalhes técnicos
```text
Antes:
backend change -> realtime -> syncOnLogin -> saveTranslations/saveVideos
-> push backend -> realtime -> syncOnLogin -> toast infinito

Depois:
backend change -> realtime -> syncOnLogin -> write cache only
-> sem push de volta -> sem loop
```

Também vou aproveitar o `refresh()` já existente no hook de HeyGen para transformar o erro de timeout em estado recuperável, sem exigir recarregar a página inteira.