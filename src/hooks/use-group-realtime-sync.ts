import { useEffect, useRef } from "react";
import { getSessionId } from "@/lib/session-manager";
import { toast } from "sonner";
import { loadState, mergeStates, type AppState } from "@/data/app-state";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useGroupContext } from "@/hooks/use-group-context";

/**
 * Subscribes to realtime updates of groupStates via Convex useQuery subscription.
 * 
 * Key improvements:
 *  - Uses GroupContext instead of reading localStorage directly (no stale groupId)
 *  - Listens to "siskeudes:group-changed" event via context
 *  - Applies incoming state via merge, dispatches "siskeudes:state-updated"
 *  - Conflict detection: if teammate writes within 2s of local write, delays apply
 *  - No polling — pure reactive subscription
 */

const LAST_LOCAL_WRITE_KEY = "siskeudes_last_local_write_at";

function getLastLocalWriteAt(): number {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(LAST_LOCAL_WRITE_KEY) || "0") || 0));
  } catch {
    return 0;
  }
}

function applyIncomingState(formData: Record<string, unknown>): boolean {
  try {
    const { mutasiKas, ...rest } = formData as { mutasiKas?: unknown };
    const local = loadState();
    const merged = mergeStates(local, rest as Partial<AppState>);
    const mergedStr = JSON.stringify(merged);
    const currentStr = JSON.stringify(local);
    if (mergedStr === currentStr) {
      // Still sync mutasi-kas separately if it changed
      if (mutasiKas) {
        const cur = localStorage.getItem("siskeudes_mutasi_kas");
        const inc = JSON.stringify(mutasiKas);
        if (cur !== inc) {
          localStorage.setItem("siskeudes_mutasi_kas", inc);
          window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
          return true;
        }
      }
      return false;
    }

    // Pause outgoing sync briefly to prevent echo loop:
    // incoming server state → localStorage write → saveState debounce → re-push to server
    localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 3000));

    localStorage.setItem("siskeudes_state", mergedStr);
    localStorage.setItem("siskeudes_app_state", mergedStr);
    if (mutasiKas) {
      localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify(mutasiKas));
    }
    window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
    return true;
  } catch {
    return false;
  }
}

export function useGroupRealtimeSync() {
  const { groupId, sessionId } = useGroupContext();
  const prevUpdatedAt = useRef<number | null>(null);
  const initialPullDone = useRef(false);

  // Reactive subscription to groupStates — this is the core realtime mechanism.
  // When ANY user in the group writes via groupStates.merge, Convex pushes the update
  // to all subscribers automatically.
  const doc = useQuery(
    anyApi.groupStates.get,
    groupId ? { groupId: groupId as never } : "skip",
  ) as
    | { state?: unknown; updatedAt?: number; lastSessionId?: string }
    | null
    | undefined;

  // Initial pull: when first subscribing to a group, apply server state to localStorage
  // This ensures latecomers immediately see what teammates already saved.
  useEffect(() => {
    if (!groupId) {
      initialPullDone.current = false;
      return;
    }
    if (initialPullDone.current) return;
    if (doc === undefined) return; // Still loading
    if (!doc || !doc.state || typeof doc.state !== "object") {
      initialPullDone.current = true;
      return;
    }
    initialPullDone.current = true;
    prevUpdatedAt.current = doc.updatedAt ?? null;
    // Apply server state on initial load (even if it's our own last write)
    applyIncomingState(doc.state as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, doc]);

  // Apply incoming state when doc changes (after initial pull)
  useEffect(() => {
    if (!groupId) return;
    if (!initialPullDone.current) return;

    // Handle document deletion (admin wipe): doc becomes null after being non-null
    if (doc === null && prevUpdatedAt.current !== null) {
      prevUpdatedAt.current = null;
      // Clear local state — admin wiped the group data
      localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 3000));
      localStorage.removeItem("siskeudes_state");
      localStorage.removeItem("siskeudes_app_state");
      localStorage.removeItem("siskeudes_mutasi_kas");
      window.dispatchEvent(new CustomEvent("siskeudes:state-updated"));
      toast.info("Data kelompok direset oleh admin.", { duration: 2000 });
      return;
    }

    if (!doc || !doc.state || typeof doc.state !== "object") return;
    
    // Skip if this is our own write
    if (doc.lastSessionId && doc.lastSessionId === sessionId) return;
    
    // Skip if updatedAt hasn't changed (initial mount with same data)
    if (doc.updatedAt === prevUpdatedAt.current) return;
    prevUpdatedAt.current = doc.updatedAt ?? null;

    const lastWriteAt = getLastLocalWriteAt();
    const msSinceWrite = Date.now() - lastWriteAt;
    
    if (lastWriteAt > 0 && msSinceWrite >= 0 && msSinceWrite < 2500) {
      // Conflict: user just wrote locally, delay applying remote update
      toast.warning("Ada update dari anggota lain saat Anda baru mengisi. Update diterapkan sebentar lagi.", { duration: 2200 });
      const t = setTimeout(() => {
        const applied = applyIncomingState(doc.state as Record<string, unknown>);
        if (applied) toast.info("Data kelompok diperbarui", { duration: 800 });
      }, 2600);
      return () => clearTimeout(t);
    }
    
    const applied = applyIncomingState(doc.state as Record<string, unknown>);
    if (applied) toast.info("Data kelompok diperbarui", { duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, doc, sessionId]);

  // Handle manual pull requests
  useEffect(() => {
    const onManualPull = () => {
      if (!doc || !doc.state || typeof doc.state !== "object") return;
      applyIncomingState(doc.state as Record<string, unknown>);
    };
    window.addEventListener("siskeudes:request-group-pull", onManualPull);
    return () => window.removeEventListener("siskeudes:request-group-pull", onManualPull);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.updatedAt]);
}
