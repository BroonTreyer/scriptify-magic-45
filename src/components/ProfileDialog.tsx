import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/hooks/use-auth";

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User;
  profile: Profile | null;
  onSaved: (p: Profile) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(profile?.full_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setError(null);
  }, [open, profile]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: e } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName.trim() || null,
            avatar_url: avatarUrl.trim() || null,
          },
          { onConflict: "id" },
        );
      if (e) throw e;
      onSaved({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--co-bg)",
          borderColor: "var(--co-border)",
          color: "var(--co-text)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="font-display text-xl tracking-wider"
            style={{ color: "var(--co-text)" }}
          >
            EDITAR <span style={{ color: "var(--co-red)" }}>PERFIL</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full border object-cover"
                style={{ borderColor: "var(--co-border)" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className="h-14 w-14 rounded-full border flex items-center justify-center text-lg font-mono uppercase"
                style={{
                  borderColor: "var(--co-border)",
                  background: "var(--co-surface)",
                }}
              >
                {(fullName || user.email || "?").slice(0, 1)}
              </div>
            )}
            <div className="text-xs font-mono opacity-70 break-all">
              {user.email}
            </div>
          </div>

          <div>
            <label
              className="text-[10px] font-mono uppercase tracking-widest block mb-1"
              style={{ color: "var(--co-text-dim)" }}
            >
              Nome completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text)",
              }}
            />
          </div>

          <div>
            <label
              className="text-[10px] font-mono uppercase tracking-widest block mb-1"
              style={{ color: "var(--co-text-dim)" }}
            >
              URL do avatar
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={500}
              placeholder="https://…"
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{
                background: "var(--co-surface)",
                border: "1px solid var(--co-border)",
                color: "var(--co-text)",
              }}
            />
          </div>

          {error && (
            <div
              className="text-xs font-mono p-2 rounded"
              style={{
                background: "color-mix(in oklab, var(--co-red) 12%, transparent)",
                color: "var(--co-red)",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 py-2 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ background: "var(--co-red)", color: "#fff" }}
            >
              {saving ? "SALVANDO..." : "SALVAR"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded font-mono text-xs uppercase"
              style={{
                border: "1px solid var(--co-border)",
                color: "var(--co-text-dim)",
              }}
            >
              CANCELAR
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
