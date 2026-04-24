import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncOnLogin } from "@/lib/cloud-sync";
import { toast } from "sonner";

const TABLES = [
  "briefings",
  "videos",
  "batches",
  "translations",
  "custom_avatars",
  "custom_voices",
] as const;

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
    let suppressUntil = Date.now() + 4000;
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
          if (!firstLoad && dirtyTables.size > 0) {
            toast.info("Atualizado em outro dispositivo", {
              description: Array.from(dirtyTables).join(", "),
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
