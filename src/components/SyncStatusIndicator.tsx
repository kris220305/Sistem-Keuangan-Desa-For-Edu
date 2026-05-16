import { useSyncStatus } from "@/hooks/use-sync-status";
import { Cloud, CloudOff, Loader2, Check } from "lucide-react";

/**
 * Small floating indicator showing sync status.
 * Shows: syncing spinner, synced checkmark, failed X, or idle cloud.
 */
export default function SyncStatusIndicator() {
  const { syncState, lastError } = useSyncStatus();

  if (syncState === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm border transition-all duration-300"
      style={{
        background: syncState === "failed" ? "hsl(0 70% 15% / 0.9)" : "hsl(152 30% 15% / 0.9)",
        borderColor: syncState === "failed" ? "hsl(0 50% 30%)" : "hsl(152 30% 25%)",
        color: syncState === "failed" ? "hsl(0 80% 70%)" : "hsl(152 50% 80%)",
      }}
    >
      {syncState === "syncing" && (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>Menyimpan...</span>
        </>
      )}
      {syncState === "synced" && (
        <>
          <Check size={12} />
          <span>Tersimpan</span>
        </>
      )}
      {syncState === "failed" && (
        <>
          <CloudOff size={12} />
          <span title={lastError || undefined}>Gagal sync</span>
        </>
      )}
    </div>
  );
}
