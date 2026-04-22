import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/heygen/status/$videoId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "HeyGen não configurado. Adicione a chave em Settings." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const videoId = params.videoId;
        if (!videoId || !/^[A-Za-z0-9_-]{1,200}$/.test(videoId)) {
          return new Response(JSON.stringify({ error: "video_id inválido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const res = await fetch(
          `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
          { headers: { "x-api-key": apiKey, accept: "application/json" } },
        );

        const raw = await res.text();
        let json: {
          data?: {
            status?: string;
            video_url?: string;
            thumbnail_url?: string;
            duration?: number;
            error?: { message?: string } | string;
          };
          error?: { message?: string };
        } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* noop */
        }

        if (!res.ok) {
          let msg = `Erro HeyGen (${res.status}).`;
          if (res.status === 401) msg = "Chave HeyGen inválida. Verifique em heygen.com.";
          else if (json.error?.message) msg = json.error.message;
          return new Response(JSON.stringify({ error: msg, detail: raw }), {
            status: res.status,
            headers: { "content-type": "application/json" },
          });
        }

        const d = json.data ?? {};
        const errMsg =
          typeof d.error === "string" ? d.error : (d.error?.message ?? undefined);

        return new Response(
          JSON.stringify({
            status: d.status ?? "pending",
            video_url: d.video_url,
            thumbnail_url: d.thumbnail_url,
            duration: d.duration,
            error: errMsg,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});