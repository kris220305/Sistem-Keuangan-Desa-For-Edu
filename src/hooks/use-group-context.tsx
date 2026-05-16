import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getSessionId } from "@/lib/session-manager";

/**
 * GroupContext — single source of truth for the current groupId in React.
 * Eliminates stale groupId from localStorage reads in hooks.
 * Dispatches "siskeudes:group-changed" on every change so legacy listeners still work.
 */

interface GroupContextValue {
  groupId: string | null;
  sessionId: string;
  workMode: "individual" | "group";
  setGroupId: (id: string | null) => void;
  setWorkMode: (mode: "individual" | "group") => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [sessionId] = useState(() => getSessionId());
  const [groupId, setGroupIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("siskeudes_group_id") || null;
    } catch {
      return null;
    }
  });
  const [workMode, setWorkModeState] = useState<"individual" | "group">(() => {
    try {
      const m = localStorage.getItem("siskeudes_work_mode");
      return m === "group" ? "group" : "individual";
    } catch {
      return "individual";
    }
  });

  const setGroupId = useCallback((id: string | null) => {
    setGroupIdState(id);
    try {
      if (id) {
        localStorage.setItem("siskeudes_group_id", id);
      } else {
        localStorage.removeItem("siskeudes_group_id");
      }
    } catch { /* ignore */ }
    // Dispatch event for legacy listeners
    window.dispatchEvent(new CustomEvent("siskeudes:group-changed", { detail: { groupId: id } }));
  }, []);

  const setWorkMode = useCallback((mode: "individual" | "group") => {
    setWorkModeState(mode);
    try {
      localStorage.setItem("siskeudes_work_mode", mode);
    } catch { /* ignore */ }
  }, []);

  // Listen for external changes (other tabs, legacy code)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siskeudes_group_id") {
        setGroupIdState(e.newValue || null);
      }
      if (e.key === "siskeudes_work_mode") {
        setWorkModeState(e.newValue === "group" ? "group" : "individual");
      }
    };
    const onGroupChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && "groupId" in detail) {
        setGroupIdState(detail.groupId || null);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("siskeudes:group-changed", onGroupChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("siskeudes:group-changed", onGroupChanged);
    };
  }, []);

  return (
    <GroupContext.Provider value={{ groupId, sessionId, workMode, setGroupId, setWorkMode }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroupContext(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    // Fallback for components outside provider (admin pages, etc.)
    return {
      groupId: null,
      sessionId: getSessionId(),
      workMode: "individual",
      setGroupId: () => {},
      setWorkMode: () => {},
    };
  }
  return ctx;
}
