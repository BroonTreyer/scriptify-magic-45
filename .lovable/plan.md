

## Integração HeyGen — Produzir vídeo direto no CriativoOS

### ⚠ Aviso importante sobre segurança da chave

Você pediu `VITE_HEYGEN_API_KEY` (browser-direct). Isso **expõe sua chave do HeyGen no bundle público** — qualquer um abre o site, pega a chave do JS, e gasta seus créditos. Mesma situação que conversamos com a Anthropic.

**Recomendação:** seguir o mesmo padrão seguro já usado pra Anthropic — chave fica no servidor (`HEYGEN_API_KEY`, sem `VITE_`) e o browser chama rotas proxy `/api/public/heygen/*`. Mantém a UX idêntica.

Vou implementar do jeito **seguro** por padrão. Se preferir browser-direct, é só pedir e troco.

### Setup de chave

Vou pedir o secret `HEYGEN_API_KEY` na hora da implementação (via tool de adicionar secret). Você cola a chave uma vez e fica disponível no servidor.

---

### Arquivos novos

**`src/lib/heygen-types.ts`** — tipos compartilhados
- `HeygenAvatar`, `HeygenVoice`, `HeygenVideoConfig`, `HeygenVideoStatus`, `GeneratedVideo`

**`src/routes/api/public/heygen/avatars.ts`** — proxy `GET`
- Chama `https://api.heygen.com/v2/avatars` com header `x-api-key`
- Retorna lista normalizada `[{ avatar_id, avatar_name, preview_image_url }]`
- Cache server-side em memória por 5min (lista raramente muda)

**`src/routes/api/public/heygen/voices.ts`** — proxy `GET`
- Chama `https://api.heygen.com/v2/voices`
- Filtra `language === "Portuguese"` server-side
- Retorna `[{ voice_id, name, gender, preview_audio }]`

**`src/routes/api/public/heygen/generate.ts`** — proxy `POST`
- Recebe `{ avatar_id, voice_id, text, speed, ratio, resolution }`
- Valida com Zod (texto ≤ 1500 chars, ratio em `["9:16","1:1","16:9"]`, speed 0.8–1.2)
- Monta dimension: 9:16 → 1080×1920, 1:1 → 1080×1080, 16:9 → 1920×1080 (1080p) ou metade (720p)
- Chama `POST https://api.heygen.com/v2/video/generate` com o body que você listou
- Retorna `{ video_id }`
- Tratamento de erros HeyGen: 401 (chave inválida), 402/insufficient credits, 400 (validação), genérico

**`src/routes/api/public/heygen/status.$videoId.ts`** — proxy `GET`
- Chama `https://api.heygen.com/v1/video_status.get?video_id={id}`
- Retorna `{ status, video_url?, thumbnail_url?, duration?, error? }`

**`src/components/HeygenDrawer.tsx`** — painel lateral (drawer) usando `src/components/ui/drawer.tsx` que já existe
- Estado interno: `selectedAvatar`, `selectedVoice`, `resolution`, `ratio`, `speed`, `phase` (`config | generating | polling | done | error`), `videoId`, `videoUrl`, `errorMsg`
- Carrega avatares e vozes via `fetch` no mount (loading skeletons)
- Grid 3 colunas de avatares (clicável, borda vermelha quando selecionado)
- Lista de vozes PT-BR com botão ▶ preview (`<audio>` lazy)
- Toggle 720p/1080p, toggle 9:16/1:1/16:9, slider 0.8–1.2 step 0.02 (default 0.92)
- Botão "GERAR VÍDEO ⚡" → POST `/generate` → guarda `video_id` → inicia polling 5s
- Polling com `useEffect` + `setTimeout` (não interval — evita race), para em `completed`/`failed` ou após 5min (timeout msg específico)
- Estados de UI:
  - `pending`: "Na fila..." + dots animados
  - `processing`: "Renderizando..." + barra animada (progresso indeterminado, gradiente vermelho deslizante)
  - `completed`: `<video controls>` inline + botão "BAIXAR VÍDEO" (link `download`)
  - `failed`: caixa vermelha com mensagem
- Texto enviado: `[hook, agitacao, virada, prova, cta].filter(Boolean).join(" ")`. Se > 1500 chars, trunca preservando frases inteiras até onde couber e mostra warning "Texto truncado para caber no limite do HeyGen (1500 chars)"
- Quando `done`, chama `onVideoReady({ videoId, videoUrl, generatedAt })` pra atualizar o card pai

### Arquivos editados

**`src/routes/index.tsx`**
- Adicionar estado `generatedVideos: Record<number, GeneratedVideo>` (key = índice do script) no `CriativoOS`
- Adicionar estado `producingIndex: number | null` (controla qual drawer está aberto)
- No `ScriptCardImpl`: receber props `onProduce`, `generatedVideo`
  - Botão extra "🎬 PRODUZIR VÍDEO" ao lado do "COPIAR" (mesmo estilo, destaque vermelho)
  - Se `generatedVideo` existir, mostrar badge verde "✓ VÍDEO GERADO" + link download + timestamp formatado (ex: "há 3 min" ou "22/04 14:30")
- Renderizar `<HeygenDrawer>` controlado pelo `CriativoOS` quando `producingIndex !== null`, passando o script selecionado
- `onVideoReady` salva no `generatedVideos[index]`

### Fluxo end-to-end

```text
[Card Script]
   │
   ├─ COPIAR (já existe)
   └─ 🎬 PRODUZIR VÍDEO ──► [Drawer abre]
                              │
                              ├─ GET /avatars  ─► grid 3 col
                              ├─ GET /voices   ─► lista PT-BR
                              ├─ Configs       ─► 720/1080, 9:16/1:1/16:9, slider
                              │
                              └─ GERAR ⚡ ─► POST /generate ─► video_id
                                              │
                                              └─ poll /status a cada 5s
                                                    ├─ pending/processing → spinner+barra
                                                    ├─ completed → <video> + download
                                                    └─ failed → erro vermelho
                                                          │
                                                    onVideoReady ─► card mostra badge verde
```

### Tratamento de erros (centralizado nos proxies)

| Cenário | Mensagem |
|---|---|
| `HEYGEN_API_KEY` ausente | "HeyGen não configurado. Adicione a chave em Settings." |
| 401 do HeyGen | "Chave HeyGen inválida. Verifique em heygen.com." |
| 402 / insufficient credits | "Créditos insuficientes no HeyGen. Recarregue em heygen.com." |
| 400 / validação | mostra mensagem da API |
| Polling > 5min | "A renderização está demorando. Verifique em heygen.com." |
| Erro genérico | mostra `code` + `message` do HeyGen |

### O que NÃO muda

- Visual (preto, vermelho, fontes Bebas / DM Sans / Space Mono)
- Fluxo de geração de scripts (Anthropic) intocado
- Etapas 1, 2 e 4 sem mudança
- Schema dos tipos existentes em `criativo-types.ts`

### Confirmação antes de implementar

Sigo com **proxy seguro server-side + secret `HEYGEN_API_KEY`** (vou solicitar a chave na próxima etapa). Se quiser browser-direct expondo `VITE_HEYGEN_API_KEY` mesmo assim, me avisa antes.

