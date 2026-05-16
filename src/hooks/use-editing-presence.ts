import { useEffect, useRef, useCallback, useState } from "react";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import { useGroupContext } from "./use-group-context";

/**
 * Hook for editing presence — shows who is editing which module in the group.
 * 
 * Uses imperative convex.query polling (every 10s) instead of useQuery to avoid
 * requiring ConvexProvider in test environments. The presence data is ephemeral
 * and doesn't need sub-second reactivity.
 * 
 * Usage:
 *   const { presence, setMyModule } = useEditingPresence();
 *   // Call setMyModule("pendapatan") when user starts editing
 *   // Call setMyModule(null) when user leaves the page
 *   // presence = [{ sessionId, userName, module, editingAt }]
 */

interface PresenceEntry {
  sessionId: string;
  userName: string;
  module: string;
  editingAt: number;
}

export function useEditingPresence() {
  const { groupId, sessionId } = useGroupContext();
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentModule = useRef<string | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);

  // Poll presence every 10s (lightweight — presence is ephemeral data)
  useEffect(() => {
    if (!groupId || !isConvexEnabled || !convex) {
      setPresence([]);
      return;
    }

    const fetchPresence = async () => {
      try {
        const result = await convex!.query(anyApi.editingPresence.getGroupPresence, {
          groupId: groupId as never,
        } as any);
        setPresence((result as PresenceEntry[]) || []);
      } catch {
        // Ignore presence fetch errors
      }
    };

    fetchPresence();
    pollTimer.current = setInterval(fetchPresence, 10_000);

    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [groupId]);

  // Filter out our own presence for display
  const othersPresence = presence.filter((p) => p.sessionId !== sessionId);

  const setMyModule = useCallback((module: string | null) => {
    if (!groupId || !isConvexEnabled || !convex) return;
    currentModule.current = module;

    if (module) {
      convex!.mutation(anyApi.editingPresence.setEditing, {
        sessionId,
        groupId: groupId as never,
        module,
      } as any).catch((e: unknown) => { console.warn('[presence] setEditing failed:', e); });
    } else {
      convex!.mutation(anyApi.editingPresence.clearEditing, {
        sessionId,
      } as any).catch((e: unknown) => { console.warn('[presence] clearEditing failed:', e); });
    }
  }, [groupId, sessionId]);

  // Heartbeat: re-send presence every 20s to keep it alive
  useEffect(() => {
    if (!groupId || !isConvexEnabled || !convex) return;

    heartbeatTimer.current = setInterval(() => {
      if (currentModule.current) {
        convex!.mutation(anyApi.editingPresence.setEditing, {
          sessionId,
          groupId: groupId as never,
          module: currentModule.current,
        } as any).catch((e: unknown) => { console.warn('[presence] heartbeat failed:', e); });
      }
    }, 20_000);

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
      // Clear presence on unmount
      if (currentModule.current && isConvexEnabled && convex) {
        convex!.mutation(anyApi.editingPresence.clearEditing, {
          sessionId,
        } as any).catch((e: unknown) => { console.warn('[presence] cleanup failed:', e); });
      }
    };
  }, [groupId, sessionId]);

  return { presence: othersPresence, setMyModule };
}

/**
 * Get a human-readable module name for display
 */
export function getModuleDisplayName(module: string): string {
  const map: Record<string, string> = {
    pendapatan: "Pendapatan",
    belanja: "Belanja",
    pembiayaan: "Pembiayaan",
    penerimaan: "Penerimaan",
    silpa: "SiLPA",
    spp_panjar: "SPP Panjar",
    spp_definitif: "SPP Definitif",
    spp_pembiayaan: "SPP Pembiayaan",
    spj: "SPJ Kegiatan",
    pajak: "Penyetoran Pajak",
    mutasi_kas: "Mutasi Kas",
    saldo_awal: "Saldo Awal",
    jurnal_umum: "Jurnal Umum",
    kegiatan: "Detail Kegiatan",
    data_umum: "Data Umum",
  };
  return map[module] || module;
}
