import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper de fetch que injeta automaticamente o JWT do Supabase
 * no header `Authorization: Bearer <token>`.
 *
 * Use em todas as chamadas pra `/api/public/*` que exigem auth.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    /* no session — request will fail with 401 server-side */
  }

  const headers = new Headers(init.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}