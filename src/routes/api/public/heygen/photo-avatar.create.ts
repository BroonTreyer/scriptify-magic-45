import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(1).max(80),
  age: z.enum(["Young Adult", "Early Middle Age", "Late Middle Age", "Senior", "Unspecified"]).default("Unspecified"),
  gender: z.enum(["Woman", "Man", "Unspecified"]).default("Unspecified"),
  ethnicity: z
    .enum([
      "White",
      "Black",
      "South Asian",
      "South East Asian",
      "East Asian",
      "Middle Eastern",
      "Hispanic",
      "Pacific",
      "Mixed",
      "Unspecified",
    ])
    .default("Unspecified"),
  // base64 data URL ou pure base64 (sem prefix)
  imageBase64: z.string().min(100),
  imageMime: z.string().default("image/jpeg"),
});

export const Route = createFileRoute("/api/public/heygen/photo-avatar/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const __auth = await requireAuth(request);
        if (__auth instanceof Response) return __auth;
        const apiKey = process.env.HEYGEN_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "HeyGen não configurado." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let parsed: z.infer<typeof Schema>;
        try {
          const body = await request.json();
          parsed = Schema.parse(body);
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "Parâmetros inválidos.", detail: e instanceof Error ? e.message : String(e) }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        // 1) Upload da imagem para o HeyGen Asset endpoint
        const cleanBase64 = parsed.imageBase64.includes(",")
          ? parsed.imageBase64.split(",")[1]
          : parsed.imageBase64;
        const imgBuf = Buffer.from(cleanBase64, "base64");

        const uploadRes = await fetch("https://upload.heygen.com/v1/asset", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": parsed.imageMime,
          },
          body: imgBuf,
        });
        const uploadRaw = await uploadRes.text();
        let uploadJson: { data?: { image_key?: string; url?: string }; message?: string } = {};
        try {
          uploadJson = JSON.parse(uploadRaw);
        } catch {
          /* ignore */
        }
        if (!uploadRes.ok || !uploadJson.data?.image_key) {
          return new Response(
            JSON.stringify({
              error: `Falha no upload da imagem (${uploadRes.status}).`,
              detail: uploadJson.message || uploadRaw,
            }),
            { status: uploadRes.status || 502, headers: { "content-type": "application/json" } },
          );
        }

        const imageKey = uploadJson.data.image_key;

        // 2) Criar grupo de avatar a partir da foto
        const groupRes = await fetch("https://api.heygen.com/v2/photo_avatar/avatar_group/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            name: parsed.name,
            image_key: imageKey,
          }),
        });
        const groupRaw = await groupRes.text();
        let groupJson: {
          data?: { group_id?: string; id?: string; image_url?: string };
          message?: string;
          error?: { message?: string };
        } = {};
        try {
          groupJson = JSON.parse(groupRaw);
        } catch {
          /* ignore */
        }
        if (!groupRes.ok || !groupJson.data) {
          return new Response(
            JSON.stringify({
              error: `Falha ao criar grupo de avatar (${groupRes.status}).`,
              detail: groupJson.error?.message || groupJson.message || groupRaw,
            }),
            { status: groupRes.status || 502, headers: { "content-type": "application/json" } },
          );
        }

        const groupId = groupJson.data.group_id || groupJson.data.id;
        if (!groupId) {
          return new Response(
            JSON.stringify({ error: "HeyGen não retornou group_id.", detail: groupRaw }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        // 3) Treinar o grupo
        const trainRes = await fetch("https://api.heygen.com/v2/photo_avatar/train", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ group_id: groupId }),
        });
        const trainRaw = await trainRes.text();
        if (!trainRes.ok) {
          return new Response(
            JSON.stringify({
              error: `Falha ao iniciar treinamento (${trainRes.status}).`,
              detail: trainRaw,
            }),
            { status: trainRes.status || 502, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            group_id: groupId,
            preview_image_url: groupJson.data.image_url || "",
            name: parsed.name,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});