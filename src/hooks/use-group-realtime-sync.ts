import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session-manager";
import { toast } from "sonner";
import { loadState, mergeStates, type AppState } from "@/data/app-state";
import { isConvexEnabled } from "@/integrations/convex/client";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

/**
 * Subscribes to realtime updates of user_sessions rows that belong to the
 * current user's group, AND performs an initial pull so latecomers immediately
 * see what teammates already saved.
 *
 * Improvements vs previous version:
 *  - Initial pull on mount + when group_id changes (no more "kosong padahal teman sudah ngerjakan")
 *  - Soft state apply (no full window.location.reload) → dispatches "siskeudes:state-updated"
 *    so pages re-read localStorage without a hard reload (less patah-patah on slow devices)
 *  - Smarter debounce: collapses bursts of incoming updates into a single apply
 *  - Conflict detection: if a teammate writes within 2s of my own write, show a warning toast
 */

const LAST_LOCAL_WRITE_KEY = "siskeudes_last_local_write_at";

function getLastLocalWriteAt(): number {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(LAST_LOCAL_WRITE_KEY) || "0") || 0));
  } catch {
    return 0;
  }
}

function applyIncomingState(formData: Record<string, unknown>) {
  try {
    const { mutasiKas, ...rest } = formData as { mutasiKas?: unknown };
    const local = loadState();
    const merged = mergeStates(local, rest as Partial<AppState>);
    const mergedStr = JSON.stringify(merged);
    const currentStr = JSON.stringify(local);
    if (mergedStr === currentStr) {
      // still sync mutasi-kas separately if it changed
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

function useGroupRealtimeSyncConvex() {
  const sessionId = getSessionId();
  const [groupId, setGroupId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("siskeudes_group_id");
    } catch {
      return null;
    }
  });

  const doc = useQuery(
    anyApi.groupStates.get,
    { groupId: (groupId || undefined) as never },
  ) as
    | { state?: unknown; updatedAt?: number; lastSessionId?: string }
    | null
    | undefined;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siskeudes_group_id") {
        try {
          setGroupId(localStorage.getItem("siskeudes_group_id"));
        } catch {
          setGroupId(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!groupId) return;
    if (!doc || !doc.state || typeof doc.state !== "object") return;
    if (doc.lastSessionId && doc.lastSessionId === sessionId) return;
    const lastWriteAt = getLastLocalWriteAt();
    const msSinceWrite = Date.now() - lastWriteAt;
    if (lastWriteAt > 0 && msSinceWrite >= 0 && msSinceWrite < 2500) {
      toast.warning("Ada update dari anggota lain saat Anda baru mengisi. Update diterapkan sebentar lagi.", { duration: 2200 });
      const t = setTimeout(() => {
        const applied = applyIncomingState(doc.state as Record<string, unknown>);
        if (applied) toast.info("Data kelompok diperbarui", { duration: 800 });
      }, 2600);
      return () => clearTimeout(t);
    }
    {
      const applied = applyIncomingState(doc.state as Record<string, unknown>);
      if (applied) toast.info("Data kelompok diperbarui", { duration: 800 });
    }
  }, [groupId, doc?.updatedAt]);

  useEffect(() => {
    const onManualPull = () => {
      if (!doc || !doc.state || typeof doc.state !== "object") return;
      applyIncomingState(doc.state as Record<string, unknown>);
    };
    window.addEventListener("siskeudes:request-group-pull", onManualPull);
    return () => window.removeEventListener("siskeudes:request-group-pull", onManualPull);
  }, [doc?.updatedAt]);
}

export const useGroupRealtimeSync = useGroupRealtimeSyncConvex;
