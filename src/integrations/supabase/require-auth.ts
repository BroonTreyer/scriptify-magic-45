import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-route auth helper. Use inside `/api/public/*` handlers to require
 * a valid Supabase JWT (Bearer token) from the caller.
 *
 * Usage:
 *   POST: async ({ request }) => {
 *     const auth = await requireAuth(request);
 *     if (auth instanceof Response) return auth;
 *     // auth.userId is the authenticated user's id
 *   }
 */
export async function requireAuth(
  request: Request,
): Promise<{ userId: string; token: string } | Response> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: Supabase env missing." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: missing Bearer token." }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: empty token." }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid token." }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }
    return { userId: data.claims.sub, token };
  } catch {
    return new Response(
      JSON.stringify({ error: "Unauthorized: token validation failed." }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
}