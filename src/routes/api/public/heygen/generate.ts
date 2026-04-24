import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";
import { z } from "zod";

const Schema = z.object({
  avatar_id: z.string().min(1).max(200),
  voice_id: z.string().min(1).max(200),
  text: z.string().min(1).max(1500),
  speed: z.number().min(0.5).max(1.5),
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

export const Route = createFileRoute("/api/public/heygen/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const __auth = await requireAuth(request);
        if (__auth instanceof Response) return __auth;
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "HeyGen não configurado. Adicione a chave em Settings." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let parsed;
        try {
          const body = await request.json();
          parsed = Schema.parse(body);
        } catch (e) {
          return new Response(
            JSON.stringify({
              error: "Parâmetros inválidos.",
              detail: e instanceof Error ? e.message : String(e),
            }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        const dimension = dimensionFor(parsed.ratio, parsed.resolution);

        const res = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
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
                  type: "text",
                  input_text: parsed.text,
                  voice_id: parsed.voice_id,
                  speed: parsed.speed,
                },
                background: { type: "color", value: "#1a1a1a" },
              },
            ],
            dimension,
            caption: true,
          }),
        });

        const raw = await res.text();
        let json: { data?: { video_id?: string }; error?: { code?: string; message?: string }; message?: string } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* ignore */
        }

        if (!res.ok) {
          let msg = `Erro HeyGen (${res.status}).`;
          if (res.status === 401) msg = "Chave HeyGen inválida. Verifique em heygen.com.";
          else if (res.status === 402) msg = "Créditos insuficientes no HeyGen. Recarregue em heygen.com.";
          else if (json.error?.message) msg = json.error.message;
          else if (json.message) msg = json.message;

          const lower = (msg + " " + raw).toLowerCase();
          if (lower.includes("insufficient") || lower.includes("credit")) {
            msg = "Créditos insuficientes no HeyGen. Recarregue em heygen.com.";
          }

          return new Response(JSON.stringify({ error: msg, code: json.error?.code, detail: raw }), {
            status: res.status,
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