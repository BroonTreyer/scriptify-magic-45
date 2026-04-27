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
    // 15s cobre syncOnLogin lento + ecos de upserts em lote (translations,
    // videos) gerados pelo próprio cliente durante o push fire-and-forget.
    let suppressUntil = Date.now() + 15000;
    const dirtyTables = new Set<string>();
    // Última notificação exibida — usado para deduplicar toasts repetidos
    // disparados em curta janela (ex: vários upserts de translations seguidos).
    let lastToastSig = "";
    let lastToastAt = 0;

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
            const sig = notify.sort().join(",");
            const now = Date.now();
            // Dedupe: não repete o mesmo toast em < 10s.
            if (sig !== lastToastSig || now - lastToastAt > 10000) {
              lastToastSig = sig;
              lastToastAt = now;
              toast.info("Atualizado em outro dispositivo", {
                description: notify.join(", "),
                duration: 3000,
              });
            }
          }
          firstLoad = false;
          dirtyTables.clear();
          // Após cada syncOnLogin, estende o silêncio por 5s pra absorver
          // o eco realtime dos próprios upserts feitos durante a hidratação.
          suppressUntil = Math.max(suppressUntil, Date.now() + 5000);
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
