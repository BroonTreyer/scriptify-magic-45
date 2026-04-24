
# Implementação Lovable Cloud — Fases A→F

**Decisões registradas:**
- Região: **Americas**
- Profiles: **Sim** (nome + avatar)
- Auth: **Email/senha + Google**
- Escopo: **A→F completo** (rate limiting REMOVIDO — regra do sistema, será resolvido quando houver primitivas)

---

## Fase A — Habilitar Cloud
- Provisionar Lovable Cloud na região Americas.
- Verificar que `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ficam disponíveis.

## Fase B — Schema de banco (migrations)

**Tabelas:**
1. `profiles` — `id (uuid PK = auth.users.id)`, `full_name`, `avatar_url`, `created_at`, `updated_at`. RLS: usuário lê/atualiza só o próprio.
2. `user_roles` — enum `app_role ('admin','user')`, função `has_role(uuid, app_role) SECURITY DEFINER` (padrão obrigatório).
3. `briefings` — `id`, `user_id (FK auth.users)`, `data jsonb`, `scripts jsonb`, `created_at`. RLS: `auth.uid() = user_id`.
4. `videos` — `id`, `user_id`, `script_hash text`, `briefing_id`, `video_url`, `video_id`, `metadata jsonb`, `created_at`. RLS por user.
5. `translations` — `id`, `user_id`, `briefing_id`, `script_hash`, `language`, `translated_text`, `created_at`. RLS por user. Unique `(user_id, script_hash, language)`.
6. `custom_avatars` — `id`, `user_id`, `avatar_id`, `avatar_name`, `preview_image_url`, `group_id`, `status`, `error`, `created_at`. RLS por user.
7. `custom_voices` — `id`, `user_id`, `voice_id`, `name`, `gender`, `provider`, `created_at`. RLS por user.
8. `batches` — `id`, `user_id`, `briefing_id`, `matrix jsonb`, `status`, `created_at`. RLS por user.

**Trigger:** `handle_new_user()` em `auth.users` AFTER INSERT → cria row em `profiles` com `full_name` do `raw_user_meta_data`.

## Fase C — Autenticação
- `src/integrations/supabase/client.ts` (browser, com `localStorage`).
- `src/integrations/supabase/auth-middleware.ts` (server, `requireSupabaseAuth`).
- `src/integrations/supabase/client.server.ts` (admin, service role).
- `src/routes/auth.tsx` — login + signup + Google OAuth, `emailRedirectTo: window.location.origin`.
- `src/routes/reset-password.tsx` — público, hash `type=recovery`, `updateUser({password})`.
- `src/routes/_authenticated.tsx` — pathless layout, `beforeLoad` redireciona para `/auth` se não logado.
- Mover `src/routes/index.tsx` → `src/routes/_authenticated/index.tsx`.
- Atualizar `__root.tsx` com `AuthProvider` + `onAuthStateChange` (listener ANTES de `getSession`).
- Header: avatar + nome + dropdown com "Sair".

## Fase D — Migração de storages para Supabase

Refatorar para async com fallback localStorage:
- `briefing-storage.ts`, `video-storage.ts`, `translation-storage.ts` (chave por hash, mantém correção da auditoria), `batch-storage.ts`, `custom-avatars-storage.ts`, `custom-voices-storage.ts`.
- `useRealMetrics` passa a contar do banco quando autenticado.
- **Migração one-time**: ao primeiro login bem-sucedido, ler tudo do localStorage e fazer upsert no Supabase; marcar `criativo-os:migrated-v1=true`.
- Storages exibem dados do banco quando logado, localStorage como cache offline.

## Fase E — Endpoints protegidos

Mover de `/api/public/*` para server functions com `requireSupabaseAuth`:
- `heygen/avatars`, `heygen/voices`, `heygen/generate`, `heygen/generate-with-audio`, `heygen/status.$videoId`, `heygen/photo-avatar.create`, `heygen/photo-avatar.status.$groupId`
- `elevenlabs/clone-voice`, `elevenlabs/transcribe`, `elevenlabs/transcribe-url`
- `generate-scripts`, `translate-script`

**Mantém público:** `extract-url` (uso pré-login no formulário do briefing — ou move junto se preferir; decido manter público pra não quebrar UX do hero).

**Sem rate limiting** (instrução do sistema). Auth+RLS já bloqueia abuso anônimo.

## Fase F — Verificação
- `npx tsc --noEmit` deve passar.
- Smoke test manual: signup → confirma email → cria briefing → gera scripts → fecha browser → reabre → login → dados persistem → logout → tela de auth volta.
- Atualizar `mem://index.md` com decisões: "Cloud habilitado", "Auth obrigatório", "Storages com fallback localStorage".

---

**Riscos conhecidos:**
- Migração one-time pode falhar parcialmente se houver dados corrompidos no localStorage — vou logar erros e seguir.
- Endpoints HeyGen agora exigem login → preview público sem login não funciona mais para gerar vídeos (esperado).
- `extract-url` continua público — risco financeiro residual baixo (Lovable AI tem quota).

**Out of scope (Bloco 7 / Meta Ads):** não entra nesta entrega. Fica para sprint futura.
