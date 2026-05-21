import { anyApi } from "convex/server";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { getSessionId, upsertSession } from "@/lib/session-manager";
import { loadState } from "@/data/app-state";
import type { MutasiKasItem } from "@/data/mutasi-kas";
import { toast } from "sonner";
import { formatBytes, isWithinConvexDocumentSafeLimit } from "@/lib/payload-size";

export function syncMutasiKasToSession(mutasiKas: MutasiKasItem[]) {
  try {
    // Allow admin impersonation to sync (so admin corrections are saved)
    const payload = {
      ...loadState(),
      mutasiKas,
    } as unknown as Record<string, unknown>;
    const payloadSize = isWithinConvexDocumentSafeLimit(payload);
    if (!payloadSize.ok) {
      toast.error(`Data mutasi kas terlalu besar untuk sync (${formatBytes(payloadSize.bytes)}).`);
      return;
    }
    const workMode = localStorage.getItem("siskeudes_work_mode") || "individual";
    const groupId = localStorage.getItem("siskeudes_group_id");
    if (workMode === "group" && groupId && isConvexEnabled && convex) {
      const sessionId = getSessionId();
      convex.mutation(anyApi.groupStates.merge, {
        groupId: groupId as never,
        sessionId,
        state: payload,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[mutasi-kas-sync] groupStates.merge failed:', msg);
        if (msg.includes('Insufficient permissions')) {
          toast.error('Gagal sync mutasi kas: Anda belum memiliki permission write.');
        } else {
          toast.error('Gagal sync mutasi kas ke server.');
        }
      });
    } else {
      upsertSession({ form_data: payload }).catch((err) => {
        console.error('[mutasi-kas-sync] upsertSession failed:', err instanceof Error ? err.message : err);
      });
    }
  } catch (err) {
    console.error('[mutasi-kas-sync] unexpected error:', err);
  }
}

export function saveMutasiKasAndSync(mutasiKas: MutasiKasItem[], saveLocal: (items: MutasiKasItem[]) => void) {
  saveLocal(mutasiKas);
  try {
    window.dispatchEvent(new CustomEvent("siskeudes:mutasi-kas-updated"));
  } catch { /* ignore */ }
  syncMutasiKasToSession(mutasiKas);
}
