## Objetivo
Validar end-to-end real se o pipeline funciona: gerar copy → clonar/usar voz (ElevenLabs) → unificar áudio + avatar no HeyGen → buscar vídeo final. Identificar falhas concretas (créditos, prompt, formato, tamanho de texto, timeout, etc).

## Estratégia de teste
Como os endpoints `/api/public/*` exigem auth do Supabase, vou rodar dois fluxos complementares:

1. **Smoke test direto nas APIs externas** (sandbox → HeyGen/ElevenLabs) usando as secrets do projeto (`HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`). Isso isola se o problema é no provedor ou no código.
2. **Teste do endpoint server interno** via `invoke-server-function` para os endpoints que não exigem auth (ou usando token de sessão se necessário).

## Etapas

### 1. Verificar conectividade e créditos
- `GET https://api.heygen.com/v2/avatars` → confere chave + lista 1 avatar real
- `GET https://api.heygen.com/v2/voices` → idem para voz HeyGen nativa
- `GET https://api.elevenlabs.io/v1/voices` → confere chave ElevenLabs + lista vozes (clonadas inclusive)
- `GET https://api.heygen.com/v2/user/remaining_quota` (créditos)

### 2. Testar geração de copy (Anthropic)
- Chamar Claude com `buildPrompt` e um briefing de exemplo, validar:
  - JSON válido (analise + scripts + guiaProducao)
  - Tamanho da copy de cada script ≤ 1500 chars (limite do HeyGen `text` schema)
  - Pontuação adequada para narração (sem `[bracket]` ou markdown que o TTS leria)
  - Linguagem PT-BR que combine com vozes filtradas (`language === "portuguese"`)

### 3. Testar TTS ElevenLabs (`text-to-speech`)
- Pegar 1 voice_id PT-BR + texto curto da copy gerada
- POST `eleven_multilingual_v2` com `mp3_44100_128`
- Salvar `/tmp/sample.mp3` e validar tamanho > 0 + duração

### 4. Testar upload de asset HeyGen
- POST `https://upload.heygen.com/v1/asset` com o MP3
- Validar retorno de `audio_asset_id`

### 5. Testar geração de vídeo HeyGen com áudio (rota unificada)
- POST `https://api.heygen.com/v2/video/generate` com:
  - `character.avatar_id` real
  - `voice.type=audio` + `audio_asset_id`
  - dimension 720x1280 (9:16, 720p — mais barato)
- Capturar `video_id`

### 6. Polling de status
- Loop `GET /v1/video_status.get?video_id=...` a cada 10s, máx 5 min
- Validar `status=completed` + `video_url` acessível

### 7. Diagnóstico
Para cada etapa, registrar:
- Latência
- Status code + payload de erro
- Custo aproximado (créditos consumidos)

## Riscos / o que pode falhar
- **HeyGen sem créditos** → resposta 402 (já mapeado no código)
- **Voice cloning** não testado neste run (precisa upload de áudio do usuário) — só vozes nativas
- **Timeout 15s** nas rotas `voices`/`avatars` se HeyGen demorar — já tratado no código
- **Texto > 1500 chars** quebra o schema do `generate.ts` — vou validar
- **Markdown na copy** (asteriscos, colchetes) atrapalha narração — vou flagar

## Entregáveis
1. Relatório em `/mnt/documents/pipeline-report.md` com status de cada etapa, tempos, e bugs encontrados.
2. Vídeo final baixado em `/mnt/documents/test-output.mp4` (se tudo passar).
3. Lista de correções sugeridas no código (sem aplicar — você decide).

## Custo estimado
- Anthropic: ~$0,02 (1 briefing)
- ElevenLabs: ~50 créditos (1 frase curta)
- HeyGen: ~0,5 crédito de vídeo (clipe de ~10s em 720p)

Posso prosseguir?