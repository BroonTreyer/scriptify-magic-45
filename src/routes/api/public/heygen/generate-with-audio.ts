import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";
import { z } from "zod";

const Schema = z.object({
  avatar_id: z.string().min(1).max(200),
  // ID de voz da ElevenLabs (clonada)
  elevenlabs_voice_id: z.string().min(1).max(200),
  text: z.string().min(1).max(1500),
  speed: z.number().min(0.7).max(1.2),
  ratio: z.enum(["9:16", "1:1", "16:9"]),
  resolution: z.enum(["720p", "1080p"]),
});

function dimensionFor(ratio: "9:16" | "1:1" | "16:9", resolution: "720p" | "1080p") {
  const scale = resolution === "1080p" ? 1 : 720 / 1080;
  const base =
    ratio === "9:16"
      ? { width: 1080, height: 1920 }
      : ratio === "1:1"
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 };
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale),
  };
}

export const Route = createFileRoute("/api/public/heygen/generate-with-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const __auth = await requireAuth(request);
        if (__auth instanceof Response) return __auth;
        const heygenKey = process.env.HEYGEN_API_KEY;
        const elevenKey = process.env.ELEVENLABS_API_KEY;
        if (!heygenKey) {
          return new Response(JSON.stringify({ error: "HeyGen não configurado." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        if (!elevenKey) {
          return new Response(JSON.stringify({ error: "ElevenLabs não configurado." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let parsed: z.infer<typeof Schema>;
        try {
          parsed = Schema.parse(await request.json());
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: "Parâmetros inválidos.",
              detail: e instanceof Error ? e.message : String(e),
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        // 1) Gera áudio na ElevenLabs (MP3)
        const ttsRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(parsed.elevenlabs_voice_id)}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: parsed.text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.78,
                style: 0.4,
                use_speaker_boost: true,
                speed: parsed.speed,
              },
            }),
          },
        );
        if (!ttsRes.ok) {
          const t = await ttsRes.text().catch(() => "");
          let msg = `Erro na ElevenLabs (${ttsRes.status}).`;
          if (ttsRes.status === 401) msg = "Chave ElevenLabs inválida.";
          else if (ttsRes.status === 402) msg = "Créditos insuficientes na ElevenLabs.";
          return new Response(JSON.stringify({ error: msg, detail: t }), {
            status: ttsRes.status,
            headers: { "content-type": "application/json" },
          });
        }
        const mp3 = Buffer.from(await ttsRes.arrayBuffer());

        // 2) Faz upload do áudio para o HeyGen Asset
        const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
          method: "POST",
          headers: {
            "x-api-key": heygenKey,
            "Content-Type": "audio/mpeg",
          },
          body: mp3,
        });
        const uploadRaw = await uploadRes.text();
        let uploadJson: { data?: { id?: string; asset_id?: string; audio_asset_id?: string }; message?: string } = {};
        try {
          uploadJson = JSON.parse(uploadRaw);
        } catch {
          /* ignore */
        }
        const audioAssetId =
          uploadJson.data?.audio_asset_id ||
          uploadJson.data?.asset_id ||
          uploadJson.data?.id;
        if (!uploadRes.ok || !audioAssetId) {
          return new Response(
            JSON.stringify({
              error: `Falha no upload do áudio ao HeyGen (${uploadRes.status}).`,
              detail: uploadJson.message || uploadRaw,
            }),
            { status: uploadRes.status || 502, headers: { "content-type": "application/json" } },
          );
        }

        // 3) Gera vídeo no HeyGen com voice type="audio"
        const dimension = dimensionFor(parsed.ratio, parsed.resolution);
        const genRes = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": heygenKey,
          },
          body: JSON.stringify({
            video_inputs: [
              {
                character: {
                  type: "avatar",
                  avatar_id: parsed.avatar_id,
                  avatar_style: "normal",
                },
                voice: {
                  type: "audio",
                  audio_asset_id: audioAssetId,
                },
                background: { type: "color", value: "#1a1a1a" },
              },
            ],
            dimension,
            caption: true,
          }),
        });
        const raw = await genRes.text();
        let json: { data?: { video_id?: string }; error?: { code?: string; message?: string }; message?: string } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* ignore */
        }
        if (!genRes.ok) {
          let msg = `Erro HeyGen (${genRes.status}).`;
          if (genRes.status === 401) msg = "Chave HeyGen inválida.";
          else if (genRes.status === 402) msg = "Créditos insuficientes no HeyGen.";
          else if (json.error?.message) msg = json.error.message;
          else if (json.message) msg = json.message;
          return new Response(JSON.stringify({ error: msg, detail: raw }), {
            status: genRes.status,
            headers: { "content-type": "application/json" },
          });
        }
        const video_id = json.data?.video_id;
        if (!video_id) {
          return new Response(
            JSON.stringify({ error: "HeyGen não retornou video_id.", detail: raw }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ video_id }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});