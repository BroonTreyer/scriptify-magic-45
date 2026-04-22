

# CriativoOS v2 — Plano completo: Creatify + Vidnoz + AssemblyAI

Vou montar **TUDO num plano só**, em ordem de execução. Cada bloco entrega valor sozinho. Mantém o visual atual (preto/vermelho, Bebas/DM Sans/Space Mono).

---

## Bloco 1 — URL → Briefing automático ⭐ (maior salto de UX)

**Inspiração:** Creatify URL-to-video.

- Novo campo no topo da etapa 1: input de URL + botão "🔗 EXTRAIR DA URL".
- Backend: nova rota `src/routes/api/public/extract-url.ts` que usa **Firecrawl** (`scrape` com `formats: ['markdown', 'json', 'branding']`) pra raspar a página.
- Resposta vai pro **Claude (`claude-sonnet-4-5`)** com tool use estruturado (`input_schema` JSON) pra extrair: `produto`, `publico`, `dor`, `transformacao`, `prova`, `tom sugerido`. Preenche os campos do briefing automaticamente.
- Mantém edição manual depois do auto-fill.
- Conector: **Firecrawl** (já documentado no contexto).

---

## Bloco 2 — Batch Mode + comparação A/B ⭐

**Inspiração:** Creatify Batch Mode.

- Nova etapa opcional após scripts: "🎬 GERAR EM LOTE".
- UI: matriz `scripts × avatares × vozes` com checkboxes. Ex: 3 scripts × 2 avatares × 2 vozes = 12 vídeos numa tacada.
- Fila de jobs no client (estado `batchJobs[]`), polling paralelo (max 3 concorrentes pra não estourar HeyGen).
- Tela de comparação lado-a-lado: grid de vídeos com filtros (por script, por avatar, por voz), botão "marcar vencedor" (estrela), exporta CSV com metadados.
- Persiste no `localStorage` reutilizando `video-storage.ts`.

---

## Bloco 3 — Avatar + Voz customizados

**Inspiração:** Creatify Custom Avatar + Vidnoz Voice Clone.

### 3a. Avatar customizado (HeyGen Photo Avatar)
- Upload de foto → nova rota `src/routes/api/public/heygen/photo-avatar.ts` chama `POST /v2/photo_avatar/photo/generate` + `/v2/photo_avatar/avatar_group/create`.
- Polling até pronto, salva `avatar_id` em localStorage (`my-avatars`).
- Aparece como primeira aba "MEUS AVATARES" no `HeygenDrawer`, antes do grid público.

### 3b. Voz clonada (ElevenLabs Instant Voice Clone)
- Upload de áudio (30s+) → rota `src/routes/api/public/elevenlabs/clone-voice.ts` chama `POST /v1/voices/add`.
- Salva `voice_id` em localStorage.
- Quando uma voz clonada está selecionada, o backend de geração de vídeo vira: ElevenLabs gera o áudio MP3 → upload pra HeyGen como `audio` input em vez de `text`. Nova rota `heygen/generate-with-audio.ts`.
- Conector: **ElevenLabs**.

---

## Bloco 4 — Editor + música + legendas estilizadas

**Inspiração:** Vidnoz editor + Creatify music library.

Stack nova: **Remotion** (renderização React → MP4 server-side). Como Remotion exige Node real (Chromium), uso fallback: edição **client-side com ffmpeg.wasm** pra cortes simples + Lovable AI pra gerar SRT estilizado.

- Novo botão "🎞️ EDITAR" em cada vídeo gerado → abre editor full-screen.
- **Cortes:** trim início/fim com slider de range sobre a timeline.
- **Música:** biblioteca curada (~30 trilhas free, royalty-free do Pixabay/Mixkit, hospedadas como assets) + opção "GERAR MÚSICA IA" via ElevenLabs Music API (prompt → MP3).
- **Legendas:** transcrição via AssemblyAI (ver bloco 6) → editor de SRT → renderiza como burn-in com 4 templates (TikTok bounce, MrBeast, minimal, neon vermelho).
- **B-roll:** upload de imagens/vídeos → Remotion compõe.
- Render final: ffmpeg.wasm no client pra cortes/música; pra burn-in legenda usa Remotion Lambda OU mantém legenda como overlay HTML5 se for só preview.
- **Honestidade:** Remotion no Worker do Cloudflare não roda (precisa Chromium). Opções: (a) renderizar só client-side (limitação: vídeos curtos, navegador trava), (b) usar Shotstack/Creatomate API (paga, ~$0.05/min). Vou propor **(b) com Shotstack** como conector externo, é o caminho viável. Se não quiser custo, fica só preview client-side sem burn-in real.

---

## Bloco 5 — Multi-idioma + tradução de vídeo

**Inspiração:** Vidnoz translator + Creatify multilingual.

- Toggle no briefing: "Idiomas" → multi-select (PT-BR, EN, ES, FR, IT, DE).
- Ao gerar scripts, Claude devolve N versões traduzidas + culturalmente adaptadas (não tradução literal).
- Para cada idioma: aba separada nos resultados.
- **Tradução de vídeo existente:** botão "🌍 TRADUZIR" em cada vídeo gerado → chama HeyGen Video Translate API (`POST /v2/video_translate`) que faz lip-sync no idioma alvo. Polling, aparece como vídeo novo vinculado ao original.

---

## Bloco 6 — STT/transcrição UGC

**Inspiração:** AssemblyAI Universal-3.

- Nova etapa lateral "📼 ANALISAR UGC" no header.
- Upload de vídeo/áudio (depoimento de cliente, vídeo do concorrente) → rota `src/routes/api/public/assemblyai/transcribe.ts`.
- Usa AssemblyAI batch (`scribe_v2` equivalent) com **diarização** + **audio events** + **keyterms**.
- Resultado: transcrição com speakers separados + insights via Lovable AI ("o que esse cliente realmente sentiu", extrai dores literais).
- Botão "USAR NO BRIEFING": copia frases-chave pros campos de dor/transformação/prova.
- Conector: **ElevenLabs STT** (substitui AssemblyAI — já temos no stack via knowledge, e o `scribe_v2` faz o mesmo: diarização + audio events + 99 idiomas). Economiza um conector.

---

## Bloco 7 — Análise pós-publicação

**Não existe pronto nas 3 ferramentas referência. É diferencial real.**

- Conexão Meta Ads + TikTok Ads via OAuth (per-user, não connector — cada user conecta a própria conta).
- Tabela `ad_campaigns` (Lovable Cloud): `script_id`, `video_id`, `platform`, `ad_id`, `spend`, `impressions`, `clicks`, `ctr`, `cvr`, `roas`, `synced_at`.
- Cron edge function (a cada 6h) puxa métricas das contas conectadas.
- Dashboard "📊 PERFORMANCE": ranking de criativos por ROAS, IA analisa padrões ("seus melhores hooks usam vergonha oculta + duração 25s") e sugere próximas variações no Batch Mode.
- **Honesto:** isso requer Lovable Cloud habilitado + apps aprovadas no Meta/TikTok Business (processo de 1-2 semanas de aprovação deles, não nosso). Vou implementar a infra e deixar o user fazer o approval no painel deles.

---

## Bloco 8 — Polish geral

- **Histórico unificado:** o sheet atual (`BriefingHistorySheet`) vira "HISTÓRICO" com abas: Briefings | Vídeos | Batches | UGC.
- **Persistência migrada pro Cloud:** o que hoje vive em localStorage migra opcionalmente pra Lovable Cloud (sync entre dispositivos). Mantém localStorage como fallback offline.
- **Auth:** login email/Google via Lovable Cloud — necessário pra Meta/TikTok OAuth.
- **Onboarding:** tour de 4 passos na primeira visita explicando URL→Briefing → Scripts → Batch → Editor.

---

## Arquitetura nova (resumo)

```text
src/
├── lib/
│   ├── briefing-storage.ts        (existe)
│   ├── video-storage.ts           (existe)
│   ├── batch-storage.ts           (novo — Bloco 2)
│   ├── custom-avatars-storage.ts  (novo — Bloco 3a)
│   ├── custom-voices-storage.ts   (novo — Bloco 3b)
│   └── ugc-storage.ts             (novo — Bloco 6)
├── components/
│   ├── HeygenDrawer.tsx           (atualiza — abas Meus/Públicos)
│   ├── UrlExtractor.tsx           (novo — Bloco 1)
│   ├── BatchMatrix.tsx            (novo — Bloco 2)
│   ├── BatchComparison.tsx        (novo — Bloco 2)
│   ├── PhotoAvatarUpload.tsx      (novo — Bloco 3a)
│   ├── VoiceCloneUpload.tsx       (novo — Bloco 3b)
│   ├── VideoEditor.tsx            (novo — Bloco 4)
│   ├── LanguageSelector.tsx       (novo — Bloco 5)
│   ├── UGCAnalyzer.tsx            (novo — Bloco 6)
│   └── PerformanceDashboard.tsx   (novo — Bloco 7)
└── routes/api/public/
    ├── extract-url.ts                          (Bloco 1)
    ├── heygen/photo-avatar.ts                  (Bloco 3a)
    ├── heygen/generate-with-audio.ts           (Bloco 3b)
    ├── heygen/translate.ts                     (Bloco 5)
    ├── elevenlabs/clone-voice.ts               (Bloco 3b)
    ├── elevenlabs/tts.ts                       (Bloco 3b)
    ├── elevenlabs/music.ts                     (Bloco 4)
    ├── elevenlabs/transcribe.ts                (Bloco 6)
    ├── shotstack/render.ts                     (Bloco 4 — opcional)
    └── ads/{meta,tiktok}/{oauth,sync}.ts       (Bloco 7)
```

## Conectores/secrets necessários

| Conector | Bloco | Custo aproximado |
|---|---|---|
| **Firecrawl** | 1 | $0.01/scrape |
| **HeyGen** (já tem) | 3a, 5 | crédito existente |
| **ElevenLabs** | 3b, 4, 6 | $0.30/1k chars TTS, $0.40/min STT |
| **Shotstack** (opcional) | 4 | $0.05/min render |
| **Lovable Cloud** | 7, 8 | grátis até X |
| **Meta/TikTok Business** | 7 | grátis (approval externa) |

## Ordem de execução (proponho fazer nesta sequência, valida cada bloco antes do próximo)

1. **Bloco 1** (URL → briefing) — 1 sessão, ganho enorme de UX
2. **Bloco 2** (Batch Mode) — 2 sessões, multiplica produção
3. **Bloco 3a** (Photo Avatar) — 1 sessão
4. **Bloco 3b** (Voice Clone + áudio→HeyGen) — 2 sessões
5. **Bloco 6** (UGC com ElevenLabs STT) — 1 sessão
6. **Bloco 5** (Multi-idioma + translate) — 2 sessões
7. **Bloco 4** (Editor — confirma se quer Shotstack pago ou client-only) — 3-4 sessões
8. **Bloco 7** (Performance — depende de Cloud + auth) — 4-5 sessões
9. **Bloco 8** (Polish + Cloud sync) — 2 sessões

## Pontos abertos pra confirmar antes de começar

- **Bloco 4:** Shotstack (paga, qualidade pro) ou client-only (grátis, limitado)?
- **Bloco 7:** Quer auth (login obrigatório) agora ou depois? Performance precisa.
- **STT no Bloco 6:** confirmo uso ElevenLabs (já no nosso stack) em vez de AssemblyAI separado?

Começo pelo **Bloco 1** assim que aprovar.

