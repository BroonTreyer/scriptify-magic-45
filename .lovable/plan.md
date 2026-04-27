
# Correções dos 5 gaps da auditoria

## 1. Aplicar cooldowns faltantes
- `src/components/UrlExtractor.tsx`: envolver chamada de `/api/public/extract-url` com `tryCooldown("extract-url", COOLDOWN.extractUrl)`; mostrar toast quando bloqueado.
- `src/components/BatchMatrix.tsx` (e outros call-sites de tradução): envolver `/api/public/translate-script` com `tryCooldown("translate", COOLDOWN.translate)`.

## 2. Sincronização de métricas na cloud
- Criar tabela `metrics` (migration): `id uuid pk`, `user_id uuid not null`, `briefing_id uuid`, `script_hash text`, `data jsonb`, `updated_at timestamptz`. RLS owner-scoped (select/insert/update/delete próprios).
- Habilitar realtime + REPLICA IDENTITY FULL.
- Em `src/hooks/use-real-metrics.ts`: ler/escrever no Supabase além do localStorage (cache local mantido); push em mudanças, hidratar no `syncOnLogin`.
- Adicionar `fetchMetrics()` em `src/lib/cloud-sync.ts` e incluir no fluxo de login + realtime hook.

## 3. Limpeza de avatares antigos no Storage
- Em `src/components/ProfileDialog.tsx`, no upload novo:
  1. Listar arquivos em `${user.id}/` no bucket `avatars`.
  2. Após upload bem-sucedido, deletar todos os arquivos cujo path ≠ novo path.
- Best-effort (erros de cleanup não bloqueiam o save).

## 4. Trim em `full_name` vindo do auth metadata
- Atualizar a função `public.handle_new_user()` (migration): aplicar `btrim(...)` em `full_name` e `avatar_url` antes do insert; converter strings vazias em NULL via `NULLIF(btrim(...), '')`.

## 5. UI de gestão de admins
- Em `src/routes/admin.tsx`: adicionar botão "Promover/Remover admin" por usuário.
- Criar RPC `admin_set_role(_target uuid, _role app_role, _grant boolean)` com SECURITY DEFINER que valida `has_role(auth.uid(), 'admin')`, faz insert/delete em `user_roles`. Bloquear self-demote (`_target <> auth.uid()`).
- Estender `admin_list_users()` para retornar `is_admin boolean` (subquery em `user_roles`).
- Atualizar tipo `AdminUserRow` no front e renderizar badge + botão.

## Validação final
- `npx tsc --noEmit` limpo.
- `bunx vitest run` verde.
- Linter Supabase sem novos warnings.
