import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

/**
 * SyncStatus context — provides UI indicators for sync state.
 * Components can show syncing/synced/failed status.
 */

export type SyncState = "idle" | "syncing" | "synced" | "failed";

interface SyncStatusContextValue {
  syncState: SyncState;
  lastError: string | null;
  lastSyncAt: number | null;
  markSyncing: () => void;
  markSynced: () => void;
  markFailed: (error: string) => void;
  markIdle: () => void;
}

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  };

  const markSyncing = useCallback(() => {
    clearResetTimer();
    setSyncState("syncing");
    setLastError(null);
  }, []);

  const markSynced = useCallback(() => {
    clearResetTimer();
    setSyncState("synced");
    setLastError(null);
    setLastSyncAt(Date.now());
    // Auto-reset to idle after 3s
    resetTimer.current = setTimeout(() => setSyncState("idle"), 3000);
  }, []);

  const markFailed = useCallback((error: string) => {
    clearResetTimer();
    setSyncState("failed");
    setLastError(error);
  }, []);

  const markIdle = useCallback(() => {
    clearResetTimer();
    setSyncState("idle");
    setLastError(null);
  }, []);

  return (
    <SyncStatusContext.Provider value={{ syncState, lastError, lastSyncAt, markSyncing, markSynced, markFailed, markIdle }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus(): SyncStatusContextValue {
  const ctx = useContext(SyncStatusContext);
  if (!ctx) {
    return {
      syncState: "idle",
      lastError: null,
      lastSyncAt: null,
      markSyncing: () => {},
      markSynced: () => {},
      markFailed: () => {},
      markIdle: () => {},
    };
  }
  return ctx;
}
