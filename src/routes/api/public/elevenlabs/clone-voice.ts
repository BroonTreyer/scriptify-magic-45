import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// multipart/form-data: name, gender (opcional), file (audio)
export const Route = createFileRoute("/api/public/elevenlabs/clone-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ElevenLabs não configurado." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "FormData inválido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const name = (form.get("name") || "").toString().trim();
        const gender = (form.get("gender") || "Outro").toString().trim();
        const file = form.get("file");

        const Schema = z.object({
          name: z.string().min(1).max(80),
          gender: z.enum(["Feminino", "Masculino", "Outro"]),
        });
        const parsed = Schema.safeParse({ name, gender });
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Parâmetros inválidos.", detail: parsed.error.message }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "Arquivo de áudio ausente." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (file.size > 11 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Áudio maior que 11MB." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        // Repassa pra ElevenLabs
        const fwd = new FormData();
        fwd.append("name", parsed.data.name);
        fwd.append("files", file, file.name || "sample.mp3");
        fwd.append(
          "description",
          `Voz clonada via CriativoOS — ${parsed.data.gender}`,
        );

        const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fwd,
        });
        const raw = await res.text();
        let json: { voice_id?: string; detail?: { message?: string } | string; message?: string } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* ignore */
        }

        if (!res.ok || !json.voice_id) {
          let msg = `Erro ao clonar voz (${res.status}).`;
          if (res.status === 401) msg = "Chave ElevenLabs inválida.";
          else if (typeof json.detail === "string") msg = json.detail;
          else if (json.detail && typeof json.detail === "object" && json.detail.message)
            msg = json.detail.message;
          else if (json.message) msg = json.message;
          return new Response(JSON.stringify({ error: msg, detail: raw }), {
            status: res.status || 502,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            voice_id: json.voice_id,
            name: parsed.data.name,
            gender: parsed.data.gender,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});