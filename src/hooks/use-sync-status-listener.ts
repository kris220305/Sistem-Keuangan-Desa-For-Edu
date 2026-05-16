import { useEffect } from "react";
import { useSyncStatus } from "./use-sync-status";

/**
 * Listens to "siskeudes:sync-status" custom events dispatched by app-state.ts
 * and updates the SyncStatus context accordingly.
 * 
 * Mount this once in the app (e.g., in AppLayout or a top-level component).
 */
export function useSyncStatusListener() {
  const { markSyncing, markSynced, markFailed } = useSyncStatus();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      switch (detail.status) {
        case "syncing":
          markSyncing();
          break;
        case "synced":
          markSynced();
          break;
        case "failed":
          markFailed(detail.error || "Unknown error");
          break;
      }
    };
    window.addEventListener("siskeudes:sync-status", handler);
    return () => window.removeEventListener("siskeudes:sync-status", handler);
  }, [markSyncing, markSynced, markFailed]);
}
