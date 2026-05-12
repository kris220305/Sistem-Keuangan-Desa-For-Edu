import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

const SESSION_KEY = "siskeudes_session_id";
const HAS_SERVER_SESSION_KEY = "siskeudes_has_server_session";
const DEFAULT_MAX_GROUP_MEMBERS = 20;
const DEFAULT_MIN_GROUP_MEMBERS = 1;

function getSupabase() {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  return supabase;
}

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

async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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
  if (!isSupabaseEnabled) {
    return {
      village_id: villageId,
      village_name: "",
      min_members: DEFAULT_MIN_GROUP_MEMBERS,
      max_members: DEFAULT_MAX_GROUP_MEMBERS,
    };
  }
  const { data } = await getSupabase()
    .from("village_group_limits")
    .select("village_id, village_name, min_members, max_members")
    .eq("village_id", villageId)
    .maybeSingle();
  if (data) return data as VillageGroupLimit;
  return {
    village_id: villageId,
    village_name: "",
    min_members: DEFAULT_MIN_GROUP_MEMBERS,
    max_members: DEFAULT_MAX_GROUP_MEMBERS,
  };
}

export async function getAllVillageGroupLimits(): Promise<VillageGroupLimit[]> {
  if (!isSupabaseEnabled) return [];
  const { data } = await getSupabase()
    .from("village_group_limits")
    .select("village_id, village_name, min_members, max_members");
  return (data as VillageGroupLimit[]) || [];
}

export async function upsertVillageGroupLimit(input: VillageGroupLimit) {
  if (!isSupabaseEnabled) throw new Error("Supabase belum dikonfigurasi.");
  const { error } = await getSupabase()
    .from("village_group_limits")
    .upsert(
      {
        village_id: input.village_id,
        village_name: input.village_name,
        min_members: Math.max(1, Math.floor(input.min_members)),
        max_members: Math.max(1, Math.floor(input.max_members)),
      } as never,
      { onConflict: "village_id" },
    );
  if (error) throw new Error(error.message);
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

  if (isConvexEnabled && convex) {
    try {
      await getConvex().mutation(anyApi.sessions.upsert, {
        sessionId,
        userName: data.user_name,
        villageId: data.village_id,
        villageName: data.village_name,
        workMode: data.work_mode,
        groupId: groupId ? (groupId as never) : undefined,
        formProgress: data.form_progress,
      });
    } catch {}
  }

  if (!isSupabaseEnabled) return;

  const { data: existing, error: existingError } = await getSupabase()
    .from("user_sessions")
    .select("id, form_progress")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const updateObj: Record<string, unknown> = {
    last_active: new Date().toISOString(),
  };
  if (data.user_name !== undefined) updateObj.user_name = data.user_name;
  if (data.village_id !== undefined) updateObj.village_id = data.village_id;
  if (data.village_name !== undefined) updateObj.village_name = data.village_name;
  if (data.form_data !== undefined) updateObj.form_data = JSON.parse(JSON.stringify(data.form_data));
  if (data.work_mode !== undefined) updateObj.work_mode = data.work_mode;
  if (data.group_id !== undefined) updateObj.group_id = data.group_id;

  if (existing) {
    const mergedProgress = {
      ...(typeof existing.form_progress === 'object' && existing.form_progress !== null ? existing.form_progress : {}),
      ...(data.form_progress || {}),
    };
    updateObj.form_progress = mergedProgress as unknown;
    const { error } = await getSupabase()
      .from("user_sessions")
      .update(updateObj as never)
      .eq("session_id", sessionId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await getSupabase().from("user_sessions").insert([{
      session_id: sessionId,
      user_name: data.user_name || "",
      village_id: data.village_id || "",
      village_name: data.village_name || "",
      form_progress: (data.form_progress || {}) as unknown as Record<string, never>,
      form_data: (data.form_data ? JSON.parse(JSON.stringify(data.form_data)) : {}) as unknown as Record<string, never>,
      work_mode: data.work_mode || "individual",
      group_id: data.group_id || null,
    }]);
    if (error) throw new Error(error.message);
  }

  try { localStorage.setItem(HAS_SERVER_SESSION_KEY, "true"); } catch {}

  // NOTE: Sebelumnya kita menulis form_data ke SEMUA baris anggota grup
  // (fan-out write) sehingga 1 keystroke = N×writes ke DB. Sekarang cukup
  // tulis row milik sendiri — anggota lain akan menerima perubahan via
  // realtime channel yang memfilter group_id (lihat use-group-realtime-sync).
  // Ini memangkas Disk IO secara drastis (≈ 90%+ pada grup 10 orang).
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
    } catch {}
  }

  if (!isSupabaseEnabled) return;

  const { error } = await getSupabase()
    .from("user_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (error) {
    const hasServerSession = (() => {
      try { return localStorage.getItem(HAS_SERVER_SESSION_KEY) === "true"; } catch { return false; }
    })();
    if (!hasServerSession) {
      try { await upsertSession({}); } catch {}
    }
  }
}

export async function getSiteSettings() {
  if (!isSupabaseEnabled) return null;
  const { data } = await getSupabase()
    .from("site_settings")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .single();
  return data;
}

export async function updateSiteSettings(updates: { is_locked?: boolean; max_users?: number }) {
  if (!isSupabaseEnabled) throw new Error("Supabase belum dikonfigurasi.");
  await getSupabase()
    .from("site_settings")
    .update(updates)
    .eq("id", "00000000-0000-0000-0000-000000000001");
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
  if (!isSupabaseEnabled) return [];
  const { data } = await getSupabase()
    .from("user_sessions")
    .select("*")
    .order("last_active", { ascending: false });
  return data || [];
}

export async function deleteSession(sessionId: string) {
  if (isConvexEnabled && convex) {
    try {
      const adminToken = getAdminToken();
      if (adminToken) await getConvex().mutation(anyApi.sessions.remove, { adminToken, sessionId } as any);
      await getConvex().mutation(anyApi.groups.leaveGroup, { sessionId });
    } catch {}
  }
  if (!isSupabaseEnabled) return;
  await getSupabase().from("user_sessions").delete().eq("session_id", sessionId);
}

export async function getActiveSessions(minutesThreshold = 5) {
  if (isConvexEnabled && convex) {
    try {
      const adminToken = getAdminToken();
      if (!adminToken) return [];
      return await getConvex().query(anyApi.sessions.listActive, { adminToken, minutesThreshold } as any);
    } catch {
      return [];
    }
  }
  if (!isSupabaseEnabled) return [];
  const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();
  const { data } = await getSupabase()
    .from("user_sessions")
    .select("*")
    .gte("last_active", threshold)
    .order("last_active", { ascending: false });
  return data || [];
}

export async function trackFormProgress(formKey: string) {
  // Cukup update progress di row sendiri. Anggota lain akan mendapat
  // notifikasi via realtime (postgres_changes) tanpa perlu kita menulis
  // ke baris mereka. Ini memangkas N+1 query/write per progress flag.
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
  if (!isSupabaseEnabled) return [];
  const { data } = await getSupabase()
    .from("groups")
    .select("*")
    .eq("village_id", villageId)
    .order("created_at", { ascending: true });
  return (data as GroupRow[]) || [];
}

/**
 * Get all groups (across all villages) along with member counts.
 * Used so any user can browse other groups' work even from a different desa.
 */
export async function getAllGroupsWithCounts(): Promise<GroupWithMemberCount[]> {
  if (!isSupabaseEnabled) return [];
  const { data: groups } = await getSupabase()
    .from("groups")
    .select("*")
    .order("village_name", { ascending: true })
    .order("name", { ascending: true });
  if (!groups) return [];

  const ids = groups.map((g) => g.id);
  const { data: members } = await getSupabase()
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);

  const counts = new Map<string, number>();
  (members || []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1));

  // Pull all per-village limits in one shot
  const limits = await getAllVillageGroupLimits();
  const limitMap = new Map(limits.map((l) => [l.village_id, l.max_members]));

  return (groups as GroupRow[]).map((g) => {
    const c = counts.get(g.id) || 0;
    const max = limitMap.get(g.village_id) ?? DEFAULT_MAX_GROUP_MEMBERS;
    return { ...g, member_count: c, max_members: max, is_full: c >= max };
  });
}

export async function getGroupMembers(groupId: string) {
  if (!isSupabaseEnabled) return [];
  const { data, error } = await getSupabase()
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

function letterFor(index: number): string {
  // 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
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
  if (!isSupabaseEnabled) throw new Error("Supabase belum dikonfigurasi.");
  const sessionId = getSessionId();

  // Fast detach (non-blocking cleanup happens elsewhere)
  const { data: detachedMemberships } = await withTimeout(
    getSupabase()
      .from("group_members")
      .delete()
      .eq("session_id", sessionId)
      .select("group_id, is_leader"),
    6000,
    () => ({ data: null } as unknown as { data: Array<{ group_id: string; is_leader: boolean }> | null }),
  );
  try { localStorage.removeItem("siskeudes_group_id"); } catch {}

  // Resolve max for this village (admin-controlled)
  const limit = await withTimeout(getVillageGroupLimit(villageId), 6000, () => ({
    village_id: villageId,
    village_name: "",
    min_members: DEFAULT_MIN_GROUP_MEMBERS,
    max_members: DEFAULT_MAX_GROUP_MEMBERS,
  }));
  const maxMembers = limit.max_members || DEFAULT_MAX_GROUP_MEMBERS;

  let groupId: string | null = null;
  let memberCount = 0;

  if (preferredGroupId) {
    const { count, error } = await withTimeout(
      getSupabase().from("group_members").select("id", { count: "exact", head: true }).eq("group_id", preferredGroupId),
      6000,
      () => ({ count: null, error: { message: "Timeout cek anggota kelompok" } } as never),
    );
    if (error) throw new Error(error.message);
    memberCount = count || 0;
    if (memberCount >= maxMembers) {
      throw new Error(`Kelompok ini sudah penuh (${maxMembers} anggota).`);
    }
    groupId = preferredGroupId;
  } else {
    const { data: groupsWithCounts, error: groupFetchError } = await withTimeout(
      getSupabase()
        .from("groups")
        .select("id, name, village_id, village_name, created_at, group_members(count)")
        .eq("village_id", villageId)
        .order("created_at", { ascending: true })
        .limit(50),
      8000,
      () => ({ data: null, error: { message: "Timeout memuat daftar kelompok" } } as never),
    );
    if (groupFetchError) throw new Error(groupFetchError.message);
    const groups = (groupsWithCounts || []) as Array<
      GroupRow & { group_members?: Array<{ count: number }> }
    >;
    const candidate = groups.find((g) => ((g.group_members?.[0]?.count ?? 0) < maxMembers));
    if (candidate) {
      groupId = candidate.id;
      memberCount = candidate.group_members?.[0]?.count ?? 0;
    }

    if (!groupId) {
      const groupName = `Kelompok ${letterFor(groups.length)}`;
      const { data: newGroup, error } = await withTimeout(
        getSupabase()
          .from("groups")
          .insert({ village_id: villageId, village_name: villageName, name: groupName } as never)
          .select()
          .single(),
        8000,
        () => ({ data: null, error: { message: "Timeout membuat kelompok" } } as never),
      );
      if (error || !newGroup) throw new Error(error?.message || "Gagal membuat kelompok");
      groupId = (newGroup as GroupRow).id;
      memberCount = 0;
    }
  }

  // Add member (first member becomes leader)
  const isFirst = memberCount === 0;
  const { error: memberError } = await withTimeout(
    getSupabase().from("group_members").insert({
      group_id: groupId,
      session_id: sessionId,
      user_name: userName,
      is_leader: isFirst,
    }),
    8000,
    () => ({ error: { message: "Timeout bergabung ke kelompok" } } as never),
  );
  if (memberError) {
    const code = (memberError as unknown as { code?: string }).code;
    const msg = (memberError as { message?: string }).message || "";
    const isDup =
      code === "23505" ||
      msg.toLowerCase().includes("duplicate key") ||
      msg.toLowerCase().includes("already exists");
    if (!isDup) throw new Error(memberError.message);
  }

  localStorage.setItem("siskeudes_group_id", groupId);

  if (detachedMemberships?.length) {
    void (async () => {
      for (const m of detachedMemberships) {
        try {
          const { count } = await supabase
            .from("group_members")
            .select("id", { count: "exact", head: true })
            .eq("group_id", m.group_id);
          if ((count || 0) === 0) {
            await getSupabase().from("groups").delete().eq("id", m.group_id);
          } else if (m.is_leader) {
            const { count: leaderCount } = await supabase
              .from("group_members")
              .select("id", { count: "exact", head: true })
              .eq("group_id", m.group_id)
              .eq("is_leader", true);
            if ((leaderCount || 0) === 0) {
              const { data: firstMember } = await supabase
                .from("group_members")
                .select("id")
                .eq("group_id", m.group_id)
                .order("joined_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (firstMember?.id) {
                await getSupabase().from("group_members").update({ is_leader: true }).eq("id", firstMember.id);
              }
            }
          }
        } catch {}
      }
    })();
  }
  return groupId;
}

/**
 * Remove the current session from its group. If the group becomes empty, delete it.
 */
export async function leaveCurrentGroup() {
  if (!isSupabaseEnabled) return;
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  if (!groupId) return;

  try { localStorage.removeItem("siskeudes_group_id"); } catch {}

  // Fast detach so UI doesn't hang. Cleanup is done in background.
  const { data: wasLeaderRows, error: deleteMemberError } = await withTimeout(
    getSupabase().from("group_members").delete().eq("group_id", groupId).eq("session_id", sessionId).select("is_leader"),
    6000,
    () => ({ data: null, error: { message: "Timeout keluar kelompok" } } as never),
  );
  if (deleteMemberError) throw new Error(deleteMemberError.message);
  const wasLeader = !!(wasLeaderRows && wasLeaderRows[0] && (wasLeaderRows[0] as { is_leader?: boolean }).is_leader);

  const { error: detachError } = await withTimeout(
    getSupabase().from("user_sessions").update({ group_id: null, work_mode: "individual" } as never).eq("session_id", sessionId),
    6000,
    () => ({ error: { message: "Timeout update sesi" } } as never),
  );
  if (detachError) throw new Error(detachError.message);

  void (async () => {
    try {
      const { count } = await supabase
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId);
      if ((count || 0) === 0) {
        await getSupabase().from("groups").delete().eq("id", groupId);
        return;
      }
      if (wasLeader) {
        const { count: leaderCount } = await supabase
          .from("group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .eq("is_leader", true);
        if ((leaderCount || 0) === 0) {
          const { data: firstMember } = await supabase
            .from("group_members")
            .select("id")
            .eq("group_id", groupId)
            .order("joined_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (firstMember?.id) {
            await getSupabase().from("group_members").update({ is_leader: true }).eq("id", firstMember.id);
          }
        }
      }
    } catch {}
  })();
}

async function randomizeLeader(groupId: string) {
  if (!isSupabaseEnabled) return;
  const { data: members } = await getSupabase()
    .from("group_members")
    .select("*")
    .eq("group_id", groupId);
  if (!members || members.length === 0) return;

  await getSupabase().from("group_members").update({ is_leader: false }).eq("group_id", groupId);
  const randomIndex = Math.floor(Math.random() * members.length);
  await getSupabase().from("group_members").update({ is_leader: true }).eq("id", members[randomIndex].id);
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

  if (!isSupabaseEnabled) return false;

  const { data } = await getSupabase()
    .from("group_members")
    .select("is_leader")
    .eq("group_id", groupId)
    .eq("session_id", sessionId)
    .maybeSingle();

  return data?.is_leader || false;
}

export async function submitReport(reportData: Record<string, unknown>) {
  if (!isSupabaseEnabled) throw new Error("Supabase belum dikonfigurasi.");
  const sessionId = getSessionId();
  const groupId = localStorage.getItem("siskeudes_group_id");
  const villageName = localStorage.getItem("siskeudes_desa_profile")
    ? JSON.parse(localStorage.getItem("siskeudes_desa_profile")!).namaDesa || ""
    : "";
  const villageId = localStorage.getItem("siskeudes_selected_village") || "";
  const userName = localStorage.getItem("siskeudes_user_name") || "";

  await getSupabase().from("report_submissions").insert({
    group_id: groupId,
    session_id: sessionId,
    submitted_by: userName,
    village_id: villageId,
    village_name: villageName,
    report_data: reportData as never,
  });
}

export async function getSubmittedReports() {
  if (!isSupabaseEnabled) return [];
  const { data } = await getSupabase()
    .from("report_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

/**
 * Snapshot the current app state into the user_sessions row (and to all group members if in group mode).
 */
export async function syncFormDataToGroup() {
  if (!isSupabaseEnabled) return;
  const sessionId = getSessionId();
  const appState = localStorage.getItem("siskeudes_app_state");
  if (!appState) return;
  const parsedState = JSON.parse(appState);
  // Cukup tulis row sendiri — anggota lain dapat update via realtime.
  await getSupabase().from("user_sessions").update({ form_data: parsedState as never }).eq("session_id", sessionId);
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

  if (!isSupabaseEnabled) return null;

  const sessionId = getSessionId();
  const { data: session } = await getSupabase()
    .from("user_sessions")
    .select("group_id, form_data")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!session?.group_id) return null;

  if (session.form_data && typeof session.form_data === "object" && Object.keys(session.form_data as object).length > 0) {
    return session.form_data as Record<string, unknown>;
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

  if (!isSupabaseEnabled) return null;

  const { data } = await getSupabase()
    .from("user_sessions")
    .select("form_data, last_active")
    .eq("group_id", groupId)
    .order("last_active", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.form_data || typeof data.form_data !== "object") return null;
  return data.form_data as Record<string, unknown>;
}
