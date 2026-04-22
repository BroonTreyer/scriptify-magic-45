import { createFileRoute } from "@tanstack/react-router";
import type { BriefingInput } from "@/lib/criativo-types";
import { buildPrompt } from "@/server/generate-scripts";

export const Route = createFileRoute("/api/public/generate-scripts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada no servidor." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let briefing: BriefingInput;
        try {
          const body = (await request.json()) as { briefing?: BriefingInput };
          if (!body.briefing) throw new Error("briefing ausente");
          briefing = body.briefing;
        } catch {
          return new Response(JSON.stringify({ error: "Body inválido." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 16000,
            stream: true,
            messages: [
              { role: "user", content: buildPrompt(briefing) },
              { role: "assistant", content: "{" },
            ],
          }),
        });

        if (!claudeRes.ok || !claudeRes.body) {
          const errText = await claudeRes.text().catch(() => "");
          console.error("Anthropic API error", claudeRes.status, errText);
          let msg = `Erro na API do Claude (${claudeRes.status}).`;
          if (claudeRes.status === 401) msg = "Chave da Anthropic inválida.";
          else if (claudeRes.status === 429 || claudeRes.status === 529)
            msg = "Claude está sobrecarregado. Tente novamente em alguns segundos.";
          return new Response(JSON.stringify({ error: msg }), {
            status: claudeRes.status,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(claudeRes.body, {
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});