import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncOnLogin } from "@/lib/cloud-sync";
import { toast } from "sonner";

// Tabelas observadas via realtime. `metrics` foi removida de propósito:
// é gravada pelo próprio dispositivo via debounce em useRealMetrics e
// causaria loop de toast (push → realtime → toast → recount → push…).
const TABLES = [
  "briefings",
  "videos",
  "batches",
  "translations",
  "custom_avatars",
  "custom_voices",
] as const;

// Apenas estas tabelas merecem toast "Atualizado em outro dispositivo".
// `custom_avatars`/`custom_voices` sincronizam silenciosamente.
const NOTIFY_TABLES = new Set<string>([
  "briefings",
  "videos",
  "batches",
  "translations",
]);

/**
 * Assina mudanças nas tabelas do app filtradas por user_id e dispara
 * `syncOnLogin` (debounced) para reidratar o cache local.
 *
 * Notifica também via window.dispatchEvent("criativo-os:sync") para que
 * componentes interessados possam re-render listas (BriefingHistorySheet etc).
 */
export function useRealtimeSync(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let firstLoad = true;
    // Ignore eventos disparados durante a janela inicial de hidratação,
    // para não tostar todo briefing/video que o syncOnLogin reescreve.
    // 8s cobre o caso de syncOnLogin demorar (várias chamadas em paralelo).
    const suppressUntil = Date.now() + 8000;
    const dirtyTables = new Set<string>();

    const trigger = (table: string) => {
      if (Date.now() < suppressUntil) return;
      dirtyTables.add(table);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void syncOnLogin().then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("criativo-os:sync"));
          }
          const notify = Array.from(dirtyTables).filter((t) =>
            NOTIFY_TABLES.has(t),
          );
          if (!firstLoad && notify.length > 0) {
            toast.info("Atualizado em outro dispositivo", {
              description: notify.join(", "),
              duration: 3000,
            });
          }
          firstLoad = false;
          dirtyTables.clear();
        });
      }, 800);
    };

    const channel = supabase.channel(`co-rt-${userId}`);
    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${userId}`,
        },
        () => trigger(table),
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
