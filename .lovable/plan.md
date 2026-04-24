
# Fase G — Correções e Finalização

## 1. Fixes Críticos de Auth (401 Unauthorized)
Trocar `fetch` por `apiFetch` (injeta JWT) nos 4 pontos restantes:
- `src/components/UGCStudio.tsx` (~L234) — geração de vídeo HeyGen
- `src/components/HeygenDrawer.tsx` (~L188) — geração de vídeo HeyGen
- `src/components/PhotoAvatarUpload.tsx` (~L50) — polling de status do treinamento
- `src/components/BatchMatrix.tsx` (~L193) — polling de status de batch

## 2. Sincronização Cloud Completa
Em `src/lib/cloud-sync.ts`:
- Implementar `fetchBatches()` e adicionar ao `syncOnLogin`
- Implementar `pushDeleteBatch(id)`, `pushDeleteVideo(id)`, `pushDeleteTranslations(briefingId)`

Em `src/lib/batch-storage.ts`, `src/lib/video-storage.ts`, `src/lib/translation-storage.ts`:
- Disparar as funções de deletion na cloud quando o usuário remover localmente

## 3. Profiles no Header
Em `src/hooks/use-auth.tsx`:
- Buscar `profiles` (full_name, avatar_url) após login e expor no contexto

Em `src/routes/index.tsx` (header):
- Mostrar avatar + nome do usuário logado (com fallback para email)

## 4. Validação Final
- `npx tsc --noEmit` para garantir build limpo
- `rg` final para confirmar zero `fetch("/api/public/...` fora de `apiFetch`

## Resultado Esperado
- Geração de vídeos funciona (sem 401)
- Polling de batches e photo-avatar funciona (sem 401)
- Batches sincronizam entre dispositivos
- Deletes locais propagam pra cloud
- Header mostra identidade do usuário
