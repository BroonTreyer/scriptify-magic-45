

## C + D — Histórico de briefings + melhorias no drawer HeyGen

Vou fazer os dois juntos porque são independentes e cada um é pequeno. Visual mantém o mesmo (preto/vermelho, Bebas/DM Sans/Space Mono).

---

### C. Histórico de briefings em localStorage

**Objetivo:** Salvar cada briefing completo (input + análise + scripts + guia) com nome automático, e permitir reabrir um briefing anterior pra continuar produzindo vídeos dos scripts dele.

**Novo arquivo: `src/lib/briefing-storage.ts`**
- Tipo `SavedBriefing = { id, name, createdAt, briefing: BriefingInput, result: GenerateResult, scriptsHash: string }`.
- `listBriefings(): SavedBriefing[]` — lê tudo, ordena por `createdAt` desc.
- `saveBriefing(briefing, result): SavedBriefing` — gera id (timestamp + random), nome automático (`<produto> — <DD/MM HH:mm>`), salva. Limite: últimos **20** briefings (descarta o mais antigo).
- `deleteBriefing(id)` — remove.
- `renameBriefing(id, name)` — atualiza nome.
- Mesmos cuidados de `video-storage.ts` (try/catch, fallback silencioso, quota cleanup).

**Mudanças em `src/routes/index.tsx`:**
- Quando `generateScripts` retorna sucesso → chamar `saveBriefing(briefingInput, result)` automaticamente.
- Novo botão no header (ícone de relógio/histórico, à esquerda do título ou no canto superior direito): abre um **Sheet** lateral (esquerda) com a lista de briefings salvos.
- Cada item da lista mostra: nome, data, nº de scripts, contagem de vídeos gerados (`X/Y vídeos`). Ações: **Abrir** (carrega briefing+scripts no estado, pula pra etapa 3, recarrega vídeos via `loadVideos(scriptsHash)`), **Renomear** (input inline), **Deletar** (confirma).
- Botão "Novo briefing" no topo do Sheet → reseta tudo pra etapa 1.

**Componente novo:** `src/components/BriefingHistorySheet.tsx` — usa o `Sheet` do shadcn (já instalado), recebe `open`, `onOpenChange`, `onLoad(briefing)` como props.

---

### D. Melhorias no drawer HeyGen

Tudo em `src/components/HeygenDrawer.tsx`, sem mudar APIs.

1. **Busca de avatares**
   - Input com placeholder "Buscar avatar..." acima do grid.
   - Filtra `avatars` por `avatar_name` (case-insensitive, substring).
   - Estado local `avatarQuery`. Limpa ao fechar drawer.

2. **Vozes agrupadas por gênero**
   - Após carregar `voices`, separar em `Masculino` / `Feminino` / `Outro` (baseado em `voice.gender`).
   - Renderizar com `<h4>` de seção pra cada grupo, lista dentro.
   - Mantém o preview de áudio existente.

3. **Contador de caracteres do script**
   - Logo acima do botão "GERAR VÍDEO ⚡", mostrar `<span>847 / 1500</span>`.
   - Vermelho se ≥ 1500 (truncado), cinza caso contrário.
   - Já temos `buildScriptText` retornando o texto final → usar `.length`.

4. **Preview visual da dimensão**
   - Ao lado dos botões 9:16 / 1:1 / 16:9, mostrar um mini-retângulo com a proporção selecionada (div com `aspect-video` / `aspect-square` / `aspect-[9/16]`, max-h ~60px, border vermelho).
   - Atualiza ao mudar `ratio`.

---

### Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `src/lib/briefing-storage.ts` | novo |
| `src/components/BriefingHistorySheet.tsx` | novo |
| `src/routes/index.tsx` | edita (auto-save + botão histórico + handler de load) |
| `src/components/HeygenDrawer.tsx` | edita (busca + grupos + contador + preview) |

### Fora de escopo

- Backend / sincronização entre dispositivos (continua só local).
- Export/import de briefings (JSON download). Posso adicionar depois se pedir.
- Edição do briefing salvo (só renomear). Pra editar conteúdo, gerar novo briefing.

