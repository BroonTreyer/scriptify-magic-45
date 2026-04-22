import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  deleteBriefing,
  listBriefings,
  renameBriefing,
  type SavedBriefing,
} from "@/lib/briefing-storage";
import { loadVideos } from "@/lib/video-storage";

export function BriefingHistorySheet({
  open,
  onOpenChange,
  onLoad,
  onNew,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoad: (b: SavedBriefing) => void;
  onNew: () => void;
}) {
  const [items, setItems] = useState<SavedBriefing[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(listBriefings());
    setEditing(null);
    setConfirming(null);
  }, [open]);

  const refresh = () => setItems(listBriefings());

  const labelStyle = { color: "var(--co-text-dim)" } as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md overflow-y-auto p-0"
        style={{
          background: "var(--co-bg)",
          borderColor: "var(--co-border)",
          color: "var(--co-text)",
        }}
      >
        <SheetHeader
          className="px-6 pt-6 pb-4 border-b"
          style={{ borderColor: "var(--co-border)" }}
        >
          <SheetTitle
            className="font-display text-2xl tracking-wider"
            style={{ color: "var(--co-text)" }}
          >
            🕘 HISTÓRICO DE <span style={{ color: "var(--co-red)" }}>BRIEFINGS</span>
          </SheetTitle>
          <div className="text-[11px] font-mono uppercase tracking-wider mt-1" style={labelStyle}>
            {items.length} {items.length === 1 ? "briefing salvo" : "briefings salvos"} · máx. 20
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-4">
          <button
            type="button"
            onClick={() => {
              onNew();
              onOpenChange(false);
            }}
            className="w-full py-3 rounded font-mono text-xs font-bold uppercase tracking-widest"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            ⚡ NOVO BRIEFING
          </button>

          {items.length === 0 && (
            <div
              className="rounded p-6 text-center text-xs font-mono"
              style={{
                background: "var(--co-surface)",
                border: "1px dashed var(--co-border)",
                color: "var(--co-text-dim)",
              }}
            >
              Nenhum briefing salvo ainda. Gere scripts e eles aparecerão aqui.
            </div>
          )}

          <div className="space-y-2">
            {items.map((b) => (
              <BriefingItem
                key={b.id}
                item={b}
                editing={editing === b.id}
                editValue={editValue}
                confirming={confirming === b.id}
                onStartEdit={() => {
                  setEditing(b.id);
                  setEditValue(b.name);
                }}
                onCancelEdit={() => setEditing(null)}
                onChangeEdit={setEditValue}
                onSaveEdit={() => {
                  renameBriefing(b.id, editValue);
                  setEditing(null);
                  refresh();
                }}
                onAskDelete={() => setConfirming(b.id)}
                onCancelDelete={() => setConfirming(null)}
                onConfirmDelete={() => {
                  deleteBriefing(b.id);
                  setConfirming(null);
                  refresh();
                }}
                onLoad={() => {
                  onLoad(b);
                  onOpenChange(false);
                }}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BriefingItem({
  item,
  editing,
  editValue,
  confirming,
  onStartEdit,
  onCancelEdit,
  onChangeEdit,
  onSaveEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onLoad,
}: {
  item: SavedBriefing;
  editing: boolean;
  editValue: string;
  confirming: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onLoad: () => void;
}) {
  const videoCount = useMemo(() => {
    const v = loadVideos(item.scriptsHash);
    return Object.keys(v).length;
  }, [item.scriptsHash]);

  const total = item.result.scripts.length;
  const date = new Date(item.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="rounded p-3"
      style={{
        background: "var(--co-surface)",
        border: "1px solid var(--co-border)",
      }}
    >
      {editing ? (
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onChangeEdit(e.target.value)}
            autoFocus
            className="flex-1 px-2 py-1.5 rounded text-[13px] outline-none"
            style={{
              background: "var(--co-bg)",
              border: "1px solid var(--co-red)",
              color: "var(--co-text)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit();
              else if (e.key === "Escape") onCancelEdit();
            }}
          />
          <button
            type="button"
            onClick={onSaveEdit}
            className="px-3 rounded text-[10px] font-mono uppercase"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            OK
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-3 rounded text-[10px] font-mono uppercase"
            style={{ border: "1px solid var(--co-border)", color: "var(--co-text-dim)" }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="text-[13px] font-semibold mb-1" style={{ color: "var(--co-text)" }}>
          {item.name}
        </div>
      )}
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-3"
        style={{ color: "var(--co-text-dim)" }}
      >
        {date} · {total} {total === 1 ? "script" : "scripts"} ·{" "}
        <span style={{ color: videoCount > 0 ? "var(--co-green)" : "var(--co-text-dim)" }}>
          {videoCount}/{total} vídeos
        </span>
      </div>
      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirmDelete}
            className="flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            CONFIRMAR DELETE
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="px-3 rounded text-[10px] font-mono uppercase"
            style={{ border: "1px solid var(--co-border)", color: "var(--co-text-dim)" }}
          >
            CANCELAR
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLoad}
            className="flex-1 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest"
            style={{ background: "var(--co-red)", color: "#fff" }}
          >
            ABRIR
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            className="px-3 py-1.5 rounded text-[10px] font-mono uppercase"
            style={{ border: "1px solid var(--co-border-strong)", color: "var(--co-text-dim)" }}
          >
            RENOMEAR
          </button>
          <button
            type="button"
            onClick={onAskDelete}
            className="px-3 py-1.5 rounded text-[10px] font-mono uppercase"
            style={{ border: "1px solid var(--co-border-strong)", color: "var(--co-text-dim)" }}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
