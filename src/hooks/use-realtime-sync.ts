import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncOnLogin } from "@/lib/cloud-sync";

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

    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void syncOnLogin().then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("criativo-os:sync"));
          }
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
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
