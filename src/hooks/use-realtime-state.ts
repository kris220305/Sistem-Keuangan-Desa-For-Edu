import { useState, useEffect, useCallback } from "react";
import { loadState, type AppState } from "@/data/app-state";

/**
 * Hook that provides the current AppState and automatically re-reads it
 * when "siskeudes:state-updated" is dispatched (i.e., when a realtime update
 * from another group member arrives).
 * 
 * This replaces the pattern of:
 *   const [state, setState] = useState(loadState());
 *   // ...never updates when teammates change data
 * 
 * Usage:
 *   const { state, reload } = useRealtimeState();
 *   // state.pendapatan, state.belanja, etc. are always fresh
 */
export function useRealtimeState() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setState(loadState());
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const onStateUpdated = () => {
      reload();
    };
    window.addEventListener("siskeudes:state-updated", onStateUpdated);
    // Also listen for group-changed to reload state
    window.addEventListener("siskeudes:group-changed", onStateUpdated);
    return () => {
      window.removeEventListener("siskeudes:state-updated", onStateUpdated);
      window.removeEventListener("siskeudes:group-changed", onStateUpdated);
    };
  }, [reload]);

  return { state, reload, version };
}
