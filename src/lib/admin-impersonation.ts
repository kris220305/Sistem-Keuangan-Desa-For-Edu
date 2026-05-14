import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

const BACKUP_KEY = "siskeudes_admin_backup";
const IMPERSONATE_KEY = "siskeudes_admin_impersonate";

// Keys that hold per-user state we need to swap when impersonating
const USER_KEYS = [
  "siskeudes_state",
  "siskeudes_app_state",
  "siskeudes_desa_profile",
  "siskeudes_selected_village",
  "siskeudes_user_name",
  "siskeudes_work_mode",
  "siskeudes_group_id",
  "siskeudes_mutasi_kas",
];

interface ImpersonationInfo {
  session_id: string;
  user_name: string;
  village_name: string;
  village_id: string;
  started_at: number;
}

function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem("siskeudes_admin_token");
  } catch {
    return null;
  }
}

function snapshotLocalStorage(): Record<string, string | null> {
  const snap: Record<string, string | null> = {};
  for (const k of USER_KEYS) snap[k] = localStorage.getItem(k);
  return snap;
}

function restoreSnapshot(snap: Record<string, string | null>) {
  for (const k of USER_KEYS) {
    const val = snap[k];
    if (val === null || val === undefined) localStorage.removeItem(k);
    else localStorage.setItem(k, val);
  }
}

/**
 * Apply the user's session form_data to local storage so the user pages
 * render the impersonated user's work.
 */
function applyUserData(formData: Record<string, unknown> | null, villageId: string, villageName: string, userName: string) {
  for (const k of USER_KEYS) localStorage.removeItem(k);

  if (formData && typeof formData === "object") {
    const fd = formData as Record<string, unknown>;
    const mutasiKas = Array.isArray(fd.mutasiKas) ? fd.mutasiKas : [];
    const { mutasiKas: _ignored, ...appStateOnly } = fd;

    localStorage.setItem("siskeudes_state", JSON.stringify(appStateOnly));
    localStorage.setItem("siskeudes_app_state", JSON.stringify(appStateOnly));
    localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify(mutasiKas));

    if (fd.desaProfile && typeof fd.desaProfile === "object") {
      localStorage.setItem("siskeudes_desa_profile", JSON.stringify(fd.desaProfile));
    } else {
      localStorage.setItem("siskeudes_desa_profile", JSON.stringify({ namaDesa: villageName }));
    }
  } else {
    localStorage.setItem("siskeudes_desa_profile", JSON.stringify({ namaDesa: villageName }));
    localStorage.setItem("siskeudes_mutasi_kas", JSON.stringify([]));
  }

  localStorage.setItem("siskeudes_selected_village", villageId);
  localStorage.setItem("siskeudes_user_name", userName);
  localStorage.setItem("siskeudes_work_mode", "individual");
}

export async function startImpersonation(session: {
  session_id: string;
  user_name: string;
  village_id: string;
  village_name: string;
  form_data: Record<string, unknown> | null;
}) {
  // Backup admin's own state (only if we don't already have one — avoid overwriting)
  if (!localStorage.getItem(BACKUP_KEY)) {
    const snap = snapshotLocalStorage();
    const adminToken = getAdminToken();
    if (isConvexEnabled && convex && adminToken) {
      try {
        await convex.mutation(anyApi.impersonation.saveBackup, { adminToken, snapshot: snap } as any);
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ remote: true }));
      } catch {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(snap));
      }
    } else {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(snap));
    }
  }

  applyUserData(session.form_data ?? null, session.village_id, session.village_name, session.user_name);

  const info: ImpersonationInfo = {
    session_id: session.session_id,
    user_name: session.user_name,
    village_name: session.village_name,
    village_id: session.village_id,
    started_at: Date.now(),
  };
  localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(info));
  const adminToken = getAdminToken();
  if (isConvexEnabled && convex && adminToken) {
    try {
      await convex.mutation(anyApi.impersonation.recordEvent, {
        adminToken,
        targetSessionId: session.session_id,
        actionType: "start",
        payload: info,
      } as any);
    } catch {}
  }
}

export async function stopImpersonation() {
  const info = getImpersonation();
  const adminToken = getAdminToken();
  let restored = false;
  if (isConvexEnabled && convex && adminToken) {
    try {
      const snap = await convex.query(anyApi.impersonation.getBackup, { adminToken } as any);
      if (snap && typeof snap === "object") {
        restoreSnapshot(snap as any);
        restored = true;
      }
      await convex.mutation(anyApi.impersonation.clearBackup, { adminToken } as any);
    } catch {}
  }

  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup && !restored) {
    try {
      const parsed = JSON.parse(backup);
      if (parsed && typeof parsed === "object" && (parsed as any).remote) {
        for (const k of USER_KEYS) localStorage.removeItem(k);
      } else {
        restoreSnapshot(parsed);
      }
    } catch {
      // If backup corrupt, just clear user keys
      for (const k of USER_KEYS) localStorage.removeItem(k);
    }
    localStorage.removeItem(BACKUP_KEY);
  } else {
    for (const k of USER_KEYS) localStorage.removeItem(k);
  }
  localStorage.removeItem(IMPERSONATE_KEY);
  if (isConvexEnabled && convex && adminToken && info) {
    try {
      await convex.mutation(anyApi.impersonation.recordEvent, {
        adminToken,
        targetSessionId: info.session_id,
        actionType: "stop",
        payload: { stopped_at: Date.now() },
      } as any);
    } catch {}
  }
}

export function getImpersonation(): ImpersonationInfo | null {
  const raw = localStorage.getItem(IMPERSONATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ImpersonationInfo; } catch { return null; }
}

/**
 * Refresh the impersonated user's data from Convex. Used by the live banner.
 */
export async function refreshImpersonatedData(): Promise<{ ok: boolean; changed: boolean }> {
  const info = getImpersonation();
  if (!info) return { ok: false, changed: false };

  if (!isConvexEnabled || !convex) return { ok: false, changed: false };

  const data = await convex.query(anyApi.sessions.getBySessionId, { sessionId: info.session_id } as any);
  if (!data) return { ok: false, changed: false };

  const nextVillageId = (data as any).village_id || info.village_id;
  const nextVillageName = (data as any).village_name || info.village_name;
  const nextUserName = (data as any).user_name || info.user_name;
  const nextFormData = ((data as any).form_data as Record<string, unknown>) ?? null;

  const currentState = localStorage.getItem("siskeudes_state") || "{}";
  const currentMutasi = localStorage.getItem("siskeudes_mutasi_kas") || "[]";
  const nextMutasi = JSON.stringify((nextFormData as Record<string, unknown> | null)?.mutasiKas ?? []);
  const nextAppState = JSON.stringify(
    nextFormData && typeof nextFormData === "object"
      ? Object.fromEntries(Object.entries(nextFormData).filter(([key]) => key !== "mutasiKas"))
      : {}
  );

  const changed =
    currentState !== nextAppState ||
    currentMutasi !== nextMutasi ||
    info.village_id !== nextVillageId ||
    info.village_name !== nextVillageName ||
    info.user_name !== nextUserName;

  applyUserData(nextFormData, nextVillageId, nextVillageName, nextUserName);
  return { ok: true, changed };
}
