import { useEffect, useRef, useState } from "react";
import {
  listCustomAvatars,
  upsertCustomAvatar,
  removeCustomAvatar,
  type CustomAvatar,
} from "@/lib/custom-avatars-storage";

type Phase = "idle" | "uploading" | "training" | "ready" | "error";

export function PhotoAvatarUpload({
  onSelect,
  selectedAvatarId,
}: {
  onSelect: (avatarId: string, name: string) => void;
  selectedAvatarId: string;
}) {
  const [list, setList] = useState<CustomAvatar[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [trainingGroupId, setTrainingGroupId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setList(listCustomAvatars());
  }, []);

  // Resume polling for any "training" avatar after reopen
  useEffect(() => {
    const training = list.find((a) => a.status === "training" && a.groupId);
    if (training && !trainingGroupId) {
      setTrainingGroupId(training.groupId!);
      setPhase("training");
    }
  }, [list, trainingGroupId]);

  // Poll training
  useEffect(() => {
    if (phase !== "training" || !trainingGroupId) return;
    let cancelled = false;
    const start = Date.now();

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/public/heygen/photo-avatar/status/${encodeURIComponent(trainingGroupId)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Erro ao consultar status.");

        if (json.status === "ready" && json.avatar_id) {
          const updated: CustomAvatar = {
            avatar_id: json.avatar_id,
            avatar_name: json.name || name || "Meu Avatar",
            preview_image_url: json.preview_image_url || filePreview || "",
            createdAt: new Date().toISOString(),
            groupId: trainingGroupId,
            status: "ready",
          };
          // Substitui por groupId (o avatar antigo training tinha avatar_id = groupId)
          const all = listCustomAvatars().filter((a) => a.groupId !== trainingGroupId);
          all.unshift(updated);
          // saveCustomAvatars equivalente
          upsertCustomAvatar(updated);
          setList(listCustomAvatars());
          setPhase("ready");
          setTrainingGroupId(null);
          setFilePreview(null);
          setName("");
          onSelect(updated.avatar_id, updated.avatar_name);
          return;
        }
        if (json.status === "failed") {
          setError("Treinamento falhou. Tente outra foto.");
          setPhase("error");
          return;
        }
        if (Date.now() - start > 10 * 60 * 1000) {
          setError("Treinamento demorando demais. Verifique em heygen.com.");
          setPhase("error");
          return;
        }
        pollTimerRef.current = setTimeout(tick, 8000);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    };

    pollTimerRef.current = setTimeout(tick, 4000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [phase, trainingGroupId, name, filePreview, onSelect]);

  const handleFile = async (file: File) => {
    if (!name.trim()) {
      setError("Dá um nome pro avatar antes.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Imagem maior que 10MB.");
      return;
    }
    setError(null);
    setPhase("uploading");

    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
      reader.readAsDataURL(file);
    });
    setFilePreview(dataUrl);

    try {
      const res = await fetch("/api/public/heygen/photo-avatar/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          imageBase64: dataUrl,
          imageMime: file.type || "image/jpeg",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao criar avatar.");

      // Salva placeholder "training" usando groupId como id temporário
      const placeholder: CustomAvatar = {
        avatar_id: `pending-${json.group_id}`,
        avatar_name: name.trim(),
        preview_image_url: json.preview_image_url || dataUrl,
        createdAt: new Date().toISOString(),
        groupId: json.group_id,
        status: "training",
      };
      upsertCustomAvatar(placeholder);
      setList(listCustomAvatars());
      setTrainingGroupId(json.group_id);
      setPhase("training");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const labelStyle: React.CSSProperties = { color: "var(--co-text-dim)" };

  return (
    <div className="space-y-4">
      {/* Lista de avatares já criados */}
      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {list.map((a) => {
            const active = selectedAvatarId === a.avatar_id;
            const training = a.status === "training";
            return (
              <div
                key={a.avatar_id}
                className="rounded overflow-hidden relative"
                style={{
                  border: active ? "2px solid var(--co-red)" : "1px solid var(--co-border)",
                  background: "var(--co-surface)",
                }}
              >
                <button
                  type="button"
                  disabled={training}
                  onClick={() => onSelect(a.avatar_id, a.avatar_name)}
                  className="block w-full text-left disabled:opacity-60"
                >
                  <div className="aspect-square overflow-hidden bg-black">
                    {a.preview_image_url && (
                      <img
                        src={a.preview_image_url}
                        alt={a.avatar_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div
                    className="px-2 py-1.5 text-[10px] font-mono truncate"
                    style={{ color: active ? "var(--co-red)" : "var(--co-text-dim)" }}
                  >
                    {training ? "TREINANDO..." : a.avatar_name}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeCustomAvatar(a.avatar_id);
                    setList(listCustomAvatars());
                  }}
                  className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(0,0,0,0.7)",
                    color: "var(--co-red)",
                    border: "1px solid var(--co-red)",
                  }}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload form */}
      <div
        className="rounded p-4 space-y-3"
        style={{ background: "var(--co-surface)", border: "1px dashed var(--co-border-strong)" }}
      >
        <div className="text-[11px] font-bold font-mono uppercase tracking-widest" style={labelStyle}>
          + Novo avatar a partir de foto
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex: João CEO)"
          disabled={phase === "uploading" || phase === "training"}
          className="w-full px-3 py-2 rounded text-[12px] font-mono outline-none disabled:opacity-50"
          style={{
            background: "var(--co-bg)",
            border: "1px solid var(--co-border)",
            color: "var(--co-text)",
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={phase === "uploading" || phase === "training" || !name.trim()}
          className="w-full py-3 rounded font-mono text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          style={{ background: "var(--co-red)", color: "#fff" }}
        >
          {phase === "uploading"
            ? "ENVIANDO..."
            : phase === "training"
              ? "TREINANDO..."
              : "📷 ESCOLHER FOTO"}
        </button>
        <div className="text-[10px] font-mono" style={labelStyle}>
          Foto frontal nítida · rosto visível · JPG/PNG · até 10MB · treinamento ~3-5min
        </div>
        {phase === "training" && (
          <div
            className="h-1.5 rounded overflow-hidden"
            style={{ background: "var(--co-border)" }}
          >
            <div
              className="h-full"
              style={{
                width: "40%",
                background: "linear-gradient(90deg, transparent, var(--co-red), transparent)",
                animation: "co-slide 1.6s linear infinite",
              }}
            />
          </div>
        )}
        {error && (
          <div
            className="px-3 py-2 rounded text-[11px] font-mono"
            style={{
              background: "color-mix(in oklab, var(--co-red) 10%, transparent)",
              border: "1px solid var(--co-red)",
              color: "var(--co-red)",
            }}
          >
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}