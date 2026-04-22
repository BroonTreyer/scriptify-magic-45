import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/elevenlabs/transcribe")({
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

        const file = form.get("file");
        const language = (form.get("language") || "por").toString().trim();
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "Áudio ausente." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        // ElevenLabs aceita até ~3GB / 4.5h, mas vamos limitar prudente
        if (file.size > 50 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Áudio maior que 50MB." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const fwd = new FormData();
        fwd.append("file", file, file.name || "audio.webm");
        fwd.append("model_id", "scribe_v1");
        fwd.append("language_code", language);
        fwd.append("tag_audio_events", "false");
        fwd.append("diarize", "false");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fwd,
        });
        const raw = await res.text();
        let json: { text?: string; language_code?: string; detail?: { message?: string } | string; message?: string } = {};
        try {
          json = JSON.parse(raw);
        } catch {
          /* ignore */
        }

        if (!res.ok || typeof json.text !== "string") {
          let msg = `Erro na transcrição (${res.status}).`;
          if (res.status === 401) msg = "Chave ElevenLabs inválida.";
          else if (res.status === 402) msg = "Créditos insuficientes na ElevenLabs.";
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
          JSON.stringify({ text: json.text, language_code: json.language_code }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
