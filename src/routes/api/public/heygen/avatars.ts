import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";

type CacheEntry = { at: number; data: unknown };
let cache: CacheEntry | null = null;
const TTL = 5 * 60 * 1000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const Route = createFileRoute("/api/public/heygen/avatars")({
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

        let res: Response;
        try {
          res = await fetchWithTimeout("https://api.heygen.com/v2/avatars", {
            headers: { "x-api-key": apiKey, accept: "application/json" },
          });
        } catch (error) {
          const timedOut = error instanceof Error && error.name === "AbortError";
          return new Response(
            JSON.stringify({
              error: timedOut
                ? "O HeyGen demorou demais para retornar os avatares. Tente novamente em instantes."
                : "Não foi possível carregar os avatares do HeyGen agora.",
            }),
            {
              status: timedOut ? 504 : 502,
              headers: { "content-type": "application/json" },
            },
          );
        }

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
          data?: { avatars?: Array<{ avatar_id: string; avatar_name: string; preview_image_url: string }> };
        };
        const avatars = (json.data?.avatars ?? []).map((a) => ({
          avatar_id: a.avatar_id,
          avatar_name: a.avatar_name,
          preview_image_url: a.preview_image_url,
        }));

        const payload = { avatars };
        cache = { at: Date.now(), data: payload };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});