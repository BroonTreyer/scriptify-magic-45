import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/heygen/photo-avatar/status/$groupId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "HeyGen não configurado." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
        const groupId = params.groupId;
        if (!groupId) {
          return new Response(JSON.stringify({ error: "groupId ausente." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        // Listar avatares no grupo — quando training=completed o avatar aparece pronto
        const res = await fetch(
          `https://api.heygen.com/v2/avatar_group/${encodeURIComponent(groupId)}/avatars`,
          {
            headers: { "x-api-key": apiKey, accept: "application/json" },
          },
        );
        const raw = await res.text();
        let json: {
          data?: {
            avatar_list?: Array<{
              id?: string;
              avatar_id?: string;
              image_url?: string;
              name?: string;
              status?: string;
            }>;
          };
          message?: string;
        } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* ignore */
        }

        if (!res.ok) {
          return new Response(
            JSON.stringify({
              error: `Erro ao consultar status (${res.status}).`,
              detail: json.message || raw,
            }),
            { status: res.status, headers: { "content-type": "application/json" } },
          );
        }

        const list = json.data?.avatar_list ?? [];
        const trained = list.find(
          (a) => (a.status || "").toLowerCase() === "completed" || (a.status || "").toLowerCase() === "ready",
        );
        const failed = list.find((a) => (a.status || "").toLowerCase() === "failed");

        if (trained && (trained.id || trained.avatar_id)) {
          return new Response(
            JSON.stringify({
              status: "ready",
              avatar_id: trained.id || trained.avatar_id,
              preview_image_url: trained.image_url || "",
              name: trained.name || "",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (failed) {
          return new Response(
            JSON.stringify({ status: "failed", error: "Treinamento falhou no HeyGen." }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ status: "training" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});