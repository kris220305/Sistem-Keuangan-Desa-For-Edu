import { anyApi } from "convex/server";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { getSessionId, upsertSession } from "@/lib/session-manager";
import { loadState } from "@/data/app-state";
import type { MutasiKasItem } from "@/data/mutasi-kas";

export function syncMutasiKasToSession(mutasiKas: MutasiKasItem[]) {
  try {
    if (localStorage.getItem("siskeudes_admin_impersonate")) return;
    const payload = {
      ...loadState(),
      mutasiKas,
    } as unknown as Record<string, unknown>;
    const workMode = localStorage.getItem("siskeudes_work_mode") || "individual";
    const groupId = localStorage.getItem("siskeudes_group_id");
    if (workMode === "group" && groupId && isConvexEnabled && convex) {
      const sessionId = getSessionId();
      void convex.mutation(anyApi.groupStates.merge, {
        groupId: groupId as never,
        sessionId,
        state: payload,
      });
    } else {
      void upsertSession({ form_data: payload });
    }
  } catch {
  }
}

export function saveMutasiKasAndSync(mutasiKas: MutasiKasItem[], saveLocal: (items: MutasiKasItem[]) => void) {
  saveLocal(mutasiKas);
  try {
    window.dispatchEvent(new CustomEvent("siskeudes:mutasi-kas-updated"));
  } catch {
  }
  syncMutasiKasToSession(mutasiKas);
}
