import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { loadState, mergeStates, type AppState } from "@/data/app-state";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { useGroupContext } from "@/hooks/use-group-context";

/**
 * Subscribes to realtime updates of groupStates via Convex useQuery subscription.
 * 
 * - Uses GroupContext (no stale groupId)
 * - Applies incoming state immediately via CRDT merge
 * - Detects document deletion (admin wipe) and clears local state
 * - No polling, no delay — pure reactive subscription
 */

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

    // Pause outgoing sync briefly to prevent echo loop
    localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 800));

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
      localStorage.setItem("siskeudes_sync_pause_until", String(Date.now() + 1000));
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

    // Apply immediately — no delay. The CRDT merge handles conflicts safely.
    applyIncomingState(doc.state as Record<string, unknown>);
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
