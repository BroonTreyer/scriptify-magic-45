import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Nova senha — CriativoOS" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h1 className="text-xl font-bold text-foreground mb-1">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Escolha uma senha forte com pelo menos 6 caracteres.
        </p>
        <input
          type="password"
          required
          minLength={6}
          placeholder="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm mb-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}