import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — CriativoOS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  briefings_count: number;
  videos_count: number;
  batches_count: number;
};

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        const ok = !!roleData;
        if (cancel) return;
        setIsAdmin(ok);
        if (!ok) {
          setBusy(false);
          return;
        }
        const { data, error: e } = await supabase.rpc(
          "admin_list_users" as never,
        );
        if (cancel) return;
        if (e) {
          setError(e.message);
          setRows([]);
        } else {
          setRows((data as AdminUserRow[]) ?? []);
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancel) setBusy(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center font-display tracking-widest opacity-60"
        style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
      >
        CARREGANDO...
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
      >
        <div className="max-w-md text-center">
          <div
            className="font-display text-3xl tracking-widest mb-3"
            style={{ color: "var(--co-red)" }}
          >
            403
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--co-text-dim)" }}>
            Você não tem permissão para acessar este painel.
          </p>
          <Link
            to="/"
            className="px-4 py-2 rounded font-mono text-xs uppercase tracking-widest"
            style={{
              border: "1px solid var(--co-border-strong)",
              color: "var(--co-text)",
            }}
          >
            VOLTAR
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ background: "var(--co-bg)", color: "var(--co-text)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="font-display text-3xl tracking-widest"
              style={{ color: "var(--co-text)" }}
            >
              ADMIN <span style={{ color: "var(--co-red)" }}>·</span> USUÁRIOS
            </h1>
            <p
              className="text-[11px] font-mono uppercase tracking-widest mt-1"
              style={{ color: "var(--co-text-dim)" }}
            >
              {rows.length} {rows.length === 1 ? "conta" : "contas"}
            </p>
          </div>
          <Link
            to="/"
            className="px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider"
            style={{
              border: "1px solid var(--co-border)",
              color: "var(--co-text-dim)",
            }}
          >
            ← Início
          </Link>
        </div>

        {error && (
          <div
            className="p-3 mb-4 rounded text-xs font-mono"
            style={{
              background: "color-mix(in oklab, var(--co-red) 12%, transparent)",
              color: "var(--co-red)",
            }}
          >
            {error}
          </div>
        )}

        {busy ? (
          <div className="text-center py-12 font-mono text-xs opacity-60">
            Carregando…
          </div>
        ) : (
          <div
            className="rounded overflow-hidden"
            style={{ border: "1px solid var(--co-border)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{
                    background: "var(--co-surface)",
                    color: "var(--co-text-dim)",
                  }}
                >
                  <th className="text-left px-3 py-2">Usuário</th>
                  <th className="text-left px-3 py-2">Criado</th>
                  <th className="text-right px-3 py-2">Briefings</th>
                  <th className="text-right px-3 py-2">Vídeos</th>
                  <th className="text-right px-3 py-2">Batches</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.user_id}
                    style={{ borderTop: "1px solid var(--co-border)" }}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {r.full_name || "—"}
                      </div>
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: "var(--co-text-dim)" }}
                      >
                        {r.email || r.user_id.slice(0, 8)}
                      </div>
                    </td>
                    <td
                      className="px-3 py-2 text-[11px] font-mono"
                      style={{ color: "var(--co-text-dim)" }}
                    >
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.briefings_count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.videos_count}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.batches_count}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-xs font-mono opacity-60"
                    >
                      Sem usuários.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}