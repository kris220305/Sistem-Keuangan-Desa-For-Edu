import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import { formatBytes, isWithinConvexDocumentSafeLimit } from "@/lib/payload-size";

const SESSION_KEY = "siskeudes_session_id";
const HAS_CONVEX_SESSION_KEY = "siskeudes_has_convex_session";
const DEFAULT_MAX_GROUP_MEMBERS = 20;
const DEFAULT_MIN_GROUP_MEMBERS = 1;

function getConvex() {
  if (!convex) throw new Error("Convex belum dikonfigurasi.");
  return convex;
}

function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem("siskeudes_admin_token");
  } catch {
    return null;
  }
}

// ============ VILLAGE GROUP LIMITS (admin-controlled, realtime-synced) ============

export interface VillageGroupLimit {
  village_id: string;
  village_name: string;
  min_members: number;
  max_members: number;
}

export async function getVillageGroupLimit(villageId: string): Promise<VillageGroupLimit> {
  if (isConvexEnabled && convex) {
    try {
      return await getConvex().query(anyApi.groupLimits.getForVillage, { villageId, villageName: "" } as any);
    } catch (err) {
      console.error('[session] getVillageGroupLimit failed:', err instanceof Error ? err.message : err);
    }
  }
  return {
    village_id: villageId,
    village_name: "",
    min_members: DEFAULT_MIN_GROUP_MEMBERS,
    max_members: DEFAULT_MAX_GROUP_MEMBERS,
  };
}

export async function getAllVillageGroupLimits(): Promise<VillageGroupLimit[]> {
  if (isConvexEnabled && convex) {
    try {
      return await getConvex().query(anyApi.groupLimits.listAll, {} as any);
    } catch {
      return [];
    }
  }
  return [];
}

export async function upsertVillageGroupLimit(input: VillageGroupLimit) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.groupLimits.upsert, {
    adminToken,
    village_id: input.village_id,
    village_name: input.village_name,
    min_members: Math.max(1, Math.floor(input.min_members)),
    max_members: Math.max(1, Math.floor(input.max_members)),
  } as any);
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function upsertSession(data: {
  user_name?: string;
  village_id?: string;
  village_name?: string;
  form_progress?: Record<string, boolean>;
  form_data?: Record<string, unknown>;
  work_mode?: string;
  group_id?: string | null;
}) {
  const sessionId = getSessionId();
  const groupId = (() => {
    if (data.group_id === null) return undefined;
    if (typeof data.group_id === "string" && data.group_id) return data.group_id;
    try {
      const raw = localStorage.getItem("siskeudes_group_id");
      return raw || undefined;
    } catch {
      return undefined;
    }
  })();

  if (!isConvexEnabled || !convex) return;
  try {
    await getConvex().mutation(anyApi.sessions.upsert, {
      sessionId,
      userName: data.user_name,
      villageId: data.village_id,
      villageName: data.village_name,
      workMode: data.work_mode,
      groupId: groupId ? (groupId as never) : undefined,
      formProgress: data.form_progress,
      formData: data.form_data,
    });
    try { localStorage.setItem(HAS_CONVEX_SESSION_KEY, "true"); } catch {}
  } catch (err) {
    console.error('[session] upsertSession failed:', err instanceof Error ? err.message : err);
  }
}

export async function heartbeat() {
  const sessionId = getSessionId();
  const userName = (() => {
    try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; }
  })();
  const villageId = (() => {
    try { return localStorage.getItem("siskeudes_selected_village") || ""; } catch { return ""; }
  })();
  const villageName = (() => {
    try { return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}").namaDesa || ""; } catch { return ""; }
  })();
  const workMode = (() => {
    try { return localStorage.getItem("siskeudes_work_mode") || "individual"; } catch { return "individual"; }
  })();
  const groupId = (() => {
    try { return localStorage.getItem("siskeudes_group_id") || undefined; } catch { return undefined; }
  })();

  if (isConvexEnabled && convex) {
    try {
      await getConvex().mutation(anyApi.sessions.upsert, {
        sessionId,
        userName,
        villageId,
        villageName,
        workMode,
        groupId: groupId ? (groupId as never) : undefined,
      });
      try { localStorage.setItem(HAS_CONVEX_SESSION_KEY, "true"); } catch {}
    } catch (err) {
      console.error('[heartbeat] upsert failed:', err instanceof Error ? err.message : err);
    }
  }
}

export function hasConvexServerSession(): boolean {
  try { return localStorage.getItem(HAS_CONVEX_SESSION_KEY) === "true"; } catch { return false; }
}

export async function getSiteSettings() {
  if (!isConvexEnabled || !convex) return null;
  try {
    return await getConvex().query(anyApi.siteSettings.get, {} as any);
  } catch {
    return null;
  }
}

export async function updateSiteSettings(updates: {
  is_locked?: boolean;
  max_users?: number;
  demo_seed_version?: number;
  wipe_all_version?: number;
}) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.siteSettings.update, { adminToken, ...updates } as any);
}

export async function getAllSessions() {
  if (isConvexEnabled && convex) {
    try {
      const adminToken = getAdminToken();
      if (!adminToken) return [];
      const out: any[] = [];
      let paginationToken: string | null | undefined = undefined;
      for (let i = 0; i < 200; i++) {
        const res = await getConvex().query(anyApi.sessions.listAll, {
          adminToken,
          limit: 50,
          paginationToken: paginationToken || undefined,
        } as any);
        const page = (res as any)?.items || [];
        out.push(...page);
        if ((res as any)?.done) break;
        paginationToken = (res as any)?.paginationToken;
        if (!paginationToken) break;
      }
      return out;
    } catch {
      return [];
    }
  }
  return [];
}

export async function deleteSession(sessionId: string) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.adminActions.kickUser, { adminToken, sessionId } as any);
}

export async function getActiveSessions(minutesThreshold = 5) {
  if (isConvexEnabled && convex) {
    try {
      const adminToken = getAdminToken();
      if (adminToken) {
        return await getConvex().query(anyApi.sessions.listActive, { adminToken, minutesThreshold } as any);
      }
      return await getConvex().query(anyApi.sessions.listActivePublic, { minutesThreshold } as any);
    } catch {
      return [];
    }
  }
  return [];
}

export async function deleteAllSessions() {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.adminActions.kickAllUsers, { adminToken } as any);
}

export async function resetUserProgress(sessionId: string) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.adminActions.resetUserProgress, { adminToken, sessionId } as any);
}

export async function resetAllProgress() {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.adminActions.resetAllProgress, { adminToken } as any);
}

export async function deleteReport(id: string) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.reportSubmissions.remove, { adminToken, id: id as never } as any);
}

export async function deleteAllReports() {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.reportSubmissions.removeAll, { adminToken } as any);
}

export async function deleteReportPdf(id: string) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.reportSubmissions.deletePdf, { adminToken, id: id as never } as any);
}

export async function deleteAllReportPdfs() {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const adminToken = getAdminToken();
  if (!adminToken) throw new Error("Admin token tidak tersedia");
  await getConvex().mutation(anyApi.reportSubmissions.deleteAllPdfs, { adminToken } as any);
}

export async function trackFormProgress(formKey: string) {
  // Update progress di row sendiri. Anggota lain mendapat notifikasi via
  // Convex realtime subscription tanpa perlu menulis ke baris mereka.
  await upsertSession({ form_progress: { [formKey]: true } });
}

// ============ GROUP FUNCTIONS ============

export interface GroupRow {
  id: string;
  name: string;
  village_id: string;
  village_name: string;
  created_at: string;
}

export interface GroupWithMemberCount extends GroupRow {
  member_count: number;
  max_members?: number;
  is_full: boolean;
}

export async function getGroupForVillage(villageId: string) {
  if (isConvexEnabled && convex) {
    try {
      return await getConvex().query(anyApi.groups.listForVillage, { villageId } as any);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get all groups (across all villages) along with member counts.
 * Used so any user can browse other groups' work even from a different desa.
 */
export async function getAllGroupsWithCounts(): Promise<GroupWithMemberCount[]> {
  if (isConvexEnabled && convex) {
    try {
      return await getConvex().query(anyApi.groups.listAllWithCounts, {} as any);
    } catch {
      return [];
    }
  }
  return [];
}

export async function getGroupMembers(groupId: string) {
  if (isConvexEnabled && convex) {
    try {
      return await getConvex().query(anyApi.groups.members, { groupId: groupId as never } as any);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Auto join: pick first non-full group for the village, or create a new one named "Kelompok A/B/C..."
 */
export async function createOrJoinGroup(villageId: string, villageName: string, userName: string): Promise<string> {
  return joinGroupSmart(villageId, villageName, userName, undefined);
}

/**
 * Join a specific group by id, or auto-pick if not provided.
 * Always leaves any previous group first to keep membership unique per session.
 */
export async function joinGroupSmart(
  villageId: string,
  villageName: string,
  userName: string,
  preferredGroupId?: string,
): Promise<string> {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const sessionId = getSessionId();
  const limit = await getVillageGroupLimit(villageId);
  const maxMembers = limit.max_members || DEFAULT_MAX_GROUP_MEMBERS;
  try { localStorage.removeItem("siskeudes_group_id"); } catch {}

  const res = await getConvex().mutation(anyApi.groups.joinGroup, {
    villageId,
    villageName,
    userName,
    sessionId,
    preferredGroupId: preferredGroupId ? (preferredGroupId as never) : undefined,
    maxMembers,
  } as any);

  const groupId = (res as any)?.groupId as string;
  if (!groupId) throw new Error("Gagal bergabung ke kelompok");
  localStorage.setItem("siskeudes_group_id", groupId);
  await upsertSession({ work_mode: "group", group_id: groupId });
  // Dispatch group-changed event so all hooks/components react immediately
  window.dispatchEvent(new CustomEvent("siskeudes:group-changed", { detail: { groupId } }));
  return groupId;
}

/**
 * Remove the current session from its group. If the group becomes empty, delete it.
 */
export async function leaveCurrentGroup() {
  if (!isConvexEnabled || !convex) return;
  const sessionId = getSessionId();
  try { localStorage.removeItem("siskeudes_group_id"); } catch {}
  try {
    await getConvex().mutation(anyApi.groups.leaveGroup, { sessionId } as any);
  } catch (err) {
    console.error('[session] leaveGroup failed:', err);
  }
  await upsertSession({ work_mode: "individual", group_id: null });
  // Dispatch group-changed event
  window.dispatchEvent(new CustomEvent("siskeudes:group-changed", { detail: { groupId: null } }));
}

export async function isCurrentUserLeader(): Promise<boolean> {
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return false;

  if (isConvexEnabled && convex) {
    try {
      return await convex.query(anyApi.groups.isLeader, { groupId: groupId as never, sessionId });
    } catch {
      return false;
    }
  }

  return false;
}

export async function submitReport(reportData: Record<string, unknown>) {
  if (!isConvexEnabled || !convex) throw new Error("Convex belum dikonfigurasi.");
  const payloadSize = isWithinConvexDocumentSafeLimit(reportData);
  if (!payloadSize.ok) {
    throw new Error(`Data laporan terlalu besar (${formatBytes(payloadSize.bytes)}). Kurangi data sebelum mengirim laporan.`);
  }
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  const villageName = localStorage.getItem("siskeudes_desa_profile")
    ? JSON.parse(localStorage.getItem("siskeudes_desa_profile")!).namaDesa || ""
    : "";
  const villageId = localStorage.getItem("siskeudes_selected_village") || "";
  const userName = localStorage.getItem("siskeudes_user_name") || "";

  const res = await getConvex().mutation(anyApi.reportSubmissions.submit, {
    sessionId,
    groupId: groupId ? (groupId as never) : undefined,
    submittedBy: userName,
    villageId,
    villageName,
    reportData,
  } as any);
  return res as any;
}

export async function getSubmittedReports() {
  if (!isConvexEnabled || !convex) return [];
  const adminToken = getAdminToken();
  if (!adminToken) return [];
  try {
    return await getConvex().query(anyApi.reportSubmissions.listAll, { adminToken } as any);
  } catch {
    return [];
  }
}

/**
 * Snapshot the current app state into the user_sessions row (and to all group members if in group mode).
 */
export async function syncFormDataToGroup() {
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return;
  if (!isConvexEnabled || !convex) return;
  const sessionId = getSessionId();
  const appState = localStorage.getItem("siskeudes_app_state");
  if (!appState) return;
  const parsedState = JSON.parse(appState);
  const payloadSize = isWithinConvexDocumentSafeLimit(parsedState);
  if (!payloadSize.ok) {
    throw new Error(`Data kelompok terlalu besar untuk sync (${formatBytes(payloadSize.bytes)}).`);
  }
  try {
    await getConvex().mutation(anyApi.groupStates.merge, {
      groupId: groupId as never,
      sessionId,
      state: parsedState as any,
    } as any);
  } catch (err) {
    console.error('[sync] syncFormDataToGroup failed:', err instanceof Error ? err.message : err);
    throw err; // Re-throw so callers can handle
  }
}

export async function loadGroupFormData(): Promise<Record<string, unknown> | null> {
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return null;

  if (isConvexEnabled && convex) {
    try {
      const doc = await convex.query(anyApi.groupStates.get, { groupId: groupId as never });
      const st = (doc as { state?: unknown } | null)?.state;
      if (!st || typeof st !== "object") return null;
      if (Object.keys(st as object).length === 0) return null;
      return st as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Get a group's combined form_data (read-only preview) by inspecting any member.
 * Used to "lihat pekerjaan kelompok lain" without joining.
 */
export async function previewGroupFormData(groupId: string): Promise<Record<string, unknown> | null> {
  if (isConvexEnabled && convex) {
    try {
      const doc = await convex.query(anyApi.groupStates.get, { groupId: groupId as never });
      const st = (doc as { state?: unknown } | null)?.state;
      if (!st || typeof st !== "object") return null;
      if (Object.keys(st as object).length === 0) return null;
      return st as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
}
