import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/integrations/supabase/require-auth";
import { z } from "zod";
import type { BriefingInput } from "@/lib/criativo-types";
import { buildPrompt } from "@/server/generate-scripts";

const BriefingSchema = z.object({
  produto: z.string().min(1).max(2000),
  url: z.string().max(500).optional().default(""),
  publico: z.string().min(1).max(2000),
  dor: z.string().min(1).max(2000),
  transformacao: z.string().min(1).max(2000),
  prova: z.string().max(2000).optional().default(""),
  tom: z.string().min(1).max(80),
  plataforma: z.string().min(1).max(80),
  duracao: z.string().min(1).max(40),
  concorrente: z.string().max(500).optional().default(""),
  // Aceita number ou string ("1".."10") — UI envia string
  numScripts: z.union([z.number(), z.string()]).transform((v) => String(v))
    .refine((s) => /^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= 10, {
      message: "numScripts deve ser entre 1 e 10",
    }),
});

const Body = z.object({ briefing: BriefingSchema });

export const Route = createFileRoute("/api/public/generate-scripts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const __auth = await requireAuth(request);
        if (__auth instanceof Response) return __auth;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada no servidor." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        let briefing: BriefingInput;
        try {
          const parsed = Body.parse(await request.json());
          briefing = parsed.briefing as unknown as BriefingInput;
        } catch (e) {
          return new Response(JSON.stringify({
            error: "Body inválido.",
            detail: e instanceof Error ? e.message : String(e),
          }), {
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
          else if (claudeRes.status === 402)
            msg = "Créditos da Anthropic esgotados. Recarregue em console.anthropic.com.";
          else if (claudeRes.status === 429 || claudeRes.status === 529)
            msg = "Claude sobrecarregado ou rate-limit atingido. Aguarde alguns segundos e tente novamente.";
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