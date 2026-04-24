import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";

type CacheEntry = { at: number; data: unknown };
let cache: CacheEntry | null = null;
const TTL = 5 * 60 * 1000;

export const Route = createFileRoute("/api/public/heygen/voices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const __auth = await requireAuth(request);
        if (__auth instanceof Response) return __auth;
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "HeyGen não configurado. Adicione a chave em Settings." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        if (cache && Date.now() - cache.at < TTL) {
          return new Response(JSON.stringify(cache.data), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        const res = await fetch("https://api.heygen.com/v2/voices", {
          headers: { "x-api-key": apiKey, accept: "application/json" },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let msg = `Erro HeyGen (${res.status}).`;
          if (res.status === 401) msg = "Chave HeyGen inválida. Verifique em heygen.com.";
          return new Response(JSON.stringify({ error: msg, detail: txt }), {
            status: res.status,
            headers: { "content-type": "application/json" },
          });
        }

        const json = (await res.json()) as {
          data?: {
            voices?: Array<{
              voice_id: string;
              name?: string;
              language?: string;
              gender?: string;
              preview_audio?: string;
            }>;
          };
        };
        const voices = (json.data?.voices ?? [])
          .filter((v) => (v.language ?? "").toLowerCase() === "portuguese")
          .map((v) => ({
            voice_id: v.voice_id,
            name: v.name ?? "Voz",
            gender: v.gender ?? "",
            preview_audio: v.preview_audio,
          }));

        const payload = { voices };
        cache = { at: Date.now(), data: payload };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});