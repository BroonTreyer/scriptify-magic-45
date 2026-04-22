import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  videoUrl: z.string().url(),
  language: z.string().min(2).max(8).optional(),
});

type Word = { text: string; start?: number; end?: number };

export const Route = createFileRoute("/api/public/elevenlabs/transcribe-url")({
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

        // 1) Baixa o vídeo do HeyGen (server-side pra evitar CORS)
        const dlRes = await fetch(parsed.videoUrl);
        if (!dlRes.ok || !dlRes.body) {
          return new Response(
            JSON.stringify({ error: `Falha ao baixar vídeo (${dlRes.status}).` }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }
        const buf = await dlRes.arrayBuffer();
        if (buf.byteLength > 80 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "Vídeo maior que 80MB." }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }

        // 2) Encaminha pra ElevenLabs Scribe pedindo timestamps
        const fwd = new FormData();
        fwd.append("file", new Blob([buf], { type: "video/mp4" }), "video.mp4");
        fwd.append("model_id", "scribe_v1");
        fwd.append("language_code", parsed.language || "por");
        fwd.append("tag_audio_events", "false");
        fwd.append("diarize", "false");
        fwd.append("timestamps_granularity", "word");

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: fwd,
        });
        const raw = await res.text();
        let json: {
          text?: string;
          words?: Array<{ text?: string; start?: number; end?: number; type?: string }>;
          detail?: { message?: string } | string;
          message?: string;
        } = {};
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

        const words: Word[] = (json.words || [])
          .filter((w) => w && (w.type ?? "word") === "word" && typeof w.text === "string")
          .map((w) => ({
            text: w.text!.trim(),
            start: typeof w.start === "number" ? w.start : undefined,
            end: typeof w.end === "number" ? w.end : undefined,
          }))
          .filter((w) => w.text.length > 0);

        // 3) Agrupa palavras em "caption chunks" curtos (≤4 palavras, ≤2s)
        type Chunk = { text: string; start: number; end: number };
        const chunks: Chunk[] = [];
        let cur: Chunk | null = null;
        for (const w of words) {
          if (w.start === undefined || w.end === undefined) continue;
          if (!cur) {
            cur = { text: w.text, start: w.start, end: w.end };
            continue;
          }
          const wordCount = cur.text.split(/\s+/).length;
          const span = w.end - cur.start;
          if (wordCount >= 4 || span > 2.0) {
            chunks.push(cur);
            cur = { text: w.text, start: w.start, end: w.end };
          } else {
            cur.text = `${cur.text} ${w.text}`;
            cur.end = w.end;
          }
        }
        if (cur) chunks.push(cur);

        return new Response(
          JSON.stringify({ text: json.text, chunks }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
