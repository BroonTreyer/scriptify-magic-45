import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CriativoOS" },
      { name: "description", content: "Entre ou crie sua conta no CriativoOS." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta.");
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Confirme seu e-mail.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Link de recuperação enviado para seu e-mail.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Falha ao entrar com Google.");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch {
      toast.error("Falha ao entrar com Google.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="font-display text-2xl tracking-tight text-foreground">
            CRIATIVO·<span className="text-primary">OS</span>
          </span>
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-xl font-bold text-foreground mb-1">
            {mode === "signin" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot" && "Recuperar senha"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" && "Acesse seu workspace."}
            {mode === "signup" && "Comece a gerar scripts em segundos."}
            {mode === "forgot" && "Enviamos um link no seu e-mail."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                required
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              />
            )}
            <input
              type="email"
              required
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={6}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm"
              />
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {busy
                ? "Aguarde..."
                : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                ? "Criar conta"
                : "Enviar link"}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                ou
                <div className="flex-1 h-px bg-border" />
              </div>
              <button
                onClick={google}
                disabled={busy}
                className="w-full py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Continuar com Google
              </button>
            </>
          )}

          <div className="mt-6 text-center text-xs text-muted-foreground space-y-2">
            {mode === "signin" && (
              <>
                <button onClick={() => setMode("forgot")} className="hover:underline block w-full">
                  Esqueci minha senha
                </button>
                <button onClick={() => setMode("signup")} className="hover:underline">
                  Não tem conta? Criar uma
                </button>
              </>
            )}
            {mode === "signup" && (
              <button onClick={() => setMode("signin")} className="hover:underline">
                Já tem conta? Entrar
              </button>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("signin")} className="hover:underline">
                Voltar para entrar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}