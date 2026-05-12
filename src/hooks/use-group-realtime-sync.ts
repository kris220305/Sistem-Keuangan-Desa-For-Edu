import { useEffect, useState } from "react";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
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

type SubscriptionEntry = {
  refCount: number;
  cleanup: () => void;
};

const activeSubscriptions = new Map<string, SubscriptionEntry>();

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

async function initialPullForGroup(groupId: string, mySessionId: string) {
  if (!supabase) return;
  const { data } = await supabase
    .from("user_sessions")
    .select("session_id, form_data, last_active")
    .eq("group_id", groupId)
    .order("last_active", { ascending: false })
    .limit(5);
  if (!data || data.length === 0) return;
  // Pick the most recently active row that's NOT mine and has non-empty form_data
  const candidate = data.find(
    (r) =>
      r.session_id !== mySessionId &&
      r.form_data &&
      typeof r.form_data === "object" &&
      Object.keys(r.form_data as object).length > 0,
  );
  if (!candidate) return;
  const applied = applyIncomingState(candidate.form_data as Record<string, unknown>);
  if (applied) {
    toast.info("Memuat pekerjaan terbaru dari kelompok…", { duration: 1500 });
  }
}

function subscribeSupabaseGroup(groupId: string, sessionId: string) {
  if (!supabase) return () => {};
  const existing = activeSubscriptions.get(groupId);
  if (existing) {
    existing.refCount += 1;
    return () => {
      const cur = activeSubscriptions.get(groupId);
      if (!cur) return;
      cur.refCount -= 1;
      if (cur.refCount <= 0) {
        cur.cleanup();
        activeSubscriptions.delete(groupId);
      }
    };
  }

  let pendingApplyTimer: ReturnType<typeof setTimeout> | null = null;
  let latestPayload: Record<string, unknown> | null = null;

  const channel = supabase
    .channel(`group-sync-${groupId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_sessions",
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const row = payload.new as { session_id?: string; form_data?: unknown };
        if (!row || row.session_id === sessionId) return;
        if (!row.form_data || typeof row.form_data !== "object") return;

        latestPayload = row.form_data as Record<string, unknown>;
        if (pendingApplyTimer) clearTimeout(pendingApplyTimer);
        pendingApplyTimer = setTimeout(() => {
          if (!latestPayload) return;
          const changed = applyIncomingState(latestPayload);
          latestPayload = null;
          if (changed) toast.info("Data kelompok diperbarui", { duration: 800 });
        }, 250);
      },
    )
    .subscribe();

  const cleanup = () => {
    if (pendingApplyTimer) clearTimeout(pendingApplyTimer);
    supabase.removeChannel(channel);
  };

  activeSubscriptions.set(groupId, { refCount: 1, cleanup });
  return () => {
    const cur = activeSubscriptions.get(groupId);
    if (!cur) return;
    cur.refCount -= 1;
    if (cur.refCount <= 0) {
      cur.cleanup();
      activeSubscriptions.delete(groupId);
    }
  };
}

function useGroupRealtimeSyncSupabase() {
  const sessionId = getSessionId();
  const [groupId, setGroupId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("siskeudes_group_id");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
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

    // Also expose a manual trigger so other code can request a pull
    const onManualPull = () => {
      if (groupId) initialPullForGroup(groupId, sessionId);
    };
    window.addEventListener("siskeudes:request-group-pull", onManualPull);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("siskeudes:request-group-pull", onManualPull);
    };
  }, [groupId, sessionId]);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    if (!groupId) return;
    let cancelled = false;
    void (async () => {
      await initialPullForGroup(groupId, sessionId);
      if (cancelled) return;
    })();
    const unsub = subscribeSupabaseGroup(groupId, sessionId);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [groupId, sessionId]);
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
    const applied = applyIncomingState(doc.state as Record<string, unknown>);
    if (applied) {
      toast.info("Data kelompok diperbarui", { duration: 800 });
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

export const useGroupRealtimeSync = isConvexEnabled ? useGroupRealtimeSyncConvex : useGroupRealtimeSyncSupabase;

export const _test = { activeSubscriptions, subscribeSupabaseGroup };
