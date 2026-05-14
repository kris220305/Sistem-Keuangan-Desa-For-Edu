import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

function normalizeLimit(limit: number | undefined) {
  const req = Math.floor(limit ?? 50);
  if (req > 50) throw new Error("Limit maksimal 50");
  if (req <= 0) return 1;
  return Math.min(50, req);
}

function cleanupCutoffMs(now: number) {
  return now - 7 * 24 * 60 * 60 * 1000;
}

export const upsert = mutationGeneric({
  args: {
    sessionId: v.string(),
    userName: v.optional(v.string()),
    villageId: v.optional(v.string()),
    villageName: v.optional(v.string()),
    workMode: v.optional(v.string()),
    groupId: v.optional(v.optional(v.id("groups"))),
    formProgress: v.optional(v.any()),
    formData: v.optional(v.any()),
  },
  handler: async ({ db }, args) => {
    const now = Date.now();
    const existing = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    const base = existing || {
      sessionId: args.sessionId,
      userName: "",
      villageId: "",
      villageName: "",
      workMode: "individual",
      groupId: undefined as unknown as undefined,
      lastActive: now,
      createdAt: now,
      formProgress: {},
    };

    const mergedProgress = (() => {
      const a = (base as { formProgress?: unknown }).formProgress;
      const b = args.formProgress;
      const aObj = typeof a === "object" && a !== null ? (a as Record<string, unknown>) : {};
      const bObj = typeof b === "object" && b !== null ? (b as Record<string, unknown>) : {};
      return { ...aObj, ...bObj };
    })();

    const next = {
      sessionId: base.sessionId,
      userName: args.userName ?? (base as any).userName ?? "",
      villageId: args.villageId ?? (base as any).villageId ?? "",
      villageName: args.villageName ?? (base as any).villageName ?? "",
      workMode: args.workMode ?? (base as any).workMode ?? "individual",
      groupId:
        args.groupId !== undefined ? (args.groupId as any) : ((base as any).groupId as any),
      lastActive: now,
      createdAt: (base as any).createdAt ?? now,
      formProgress: mergedProgress,
      formData: args.formData !== undefined ? args.formData : ((base as any).formData as any),
    };

    if (existing) {
      await db.patch(existing._id, next);
      return existing._id;
    }
    return await db.insert("userSessions", next);
  },
});

export const getBySessionId = queryGeneric({
  args: { sessionId: v.string() },
  handler: async ({ db }, { sessionId }) => {
    const s = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!s) return null;
    return {
      id: s._id,
      session_id: s.sessionId,
      user_name: s.userName,
      village_id: s.villageId,
      village_name: s.villageName,
      last_active: new Date(s.lastActive).toISOString(),
      created_at: new Date(s.createdAt).toISOString(),
      form_progress: (s.formProgress || {}) as Record<string, boolean>,
      form_data: (s.formData || null) as any,
      work_mode: s.workMode,
      group_id: s.groupId,
    };
  },
});

export const clearFormProgress = mutationGeneric({
  args: { adminToken: v.string(), sessionId: v.string() },
  handler: async ({ db }, { adminToken, sessionId }) => {
    const admin = await assertAdmin(db, adminToken);
    const s = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!s) return true;
    const oldValue = s.formProgress || {};
    await db.patch(s._id, { formProgress: {}, formData: null });
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "sessions.clearFormProgress",
        targetType: "userSessions",
        targetId: String(s._id),
        fieldName: "formProgress",
        oldValue,
        newValue: {},
      });
    } catch {}
    return true;
  },
});

export const listActive = queryGeneric({
  args: { adminToken: v.string(), minutesThreshold: v.optional(v.number()) },
  handler: async ({ db }, { adminToken, minutesThreshold }) => {
    await assertAdmin(db, adminToken);
    const mins = Math.max(1, Math.floor(minutesThreshold ?? 5));
    const cutoff = Date.now() - mins * 60 * 1000;

    const rows = await db
      .query("userSessions")
      .withIndex("by_lastActive", (q) => q.gt("lastActive", cutoff))
      .order("desc")
      .take(500);
    return rows.map((s) => ({
      id: s._id,
      session_id: s.sessionId,
      user_name: s.userName,
      village_id: s.villageId,
      village_name: s.villageName,
      last_active: new Date(s.lastActive).toISOString(),
      created_at: new Date(s.createdAt).toISOString(),
      form_progress: (s.formProgress || {}) as Record<string, boolean>,
      work_mode: s.workMode,
      group_id: s.groupId,
    }));
  },
});

export const listAll = queryGeneric({
  args: {
    adminToken: v.string(),
    limit: v.optional(v.number()),
    paginationToken: v.optional(v.string()),
  },
  handler: async ({ db }, { adminToken, limit, paginationToken }) => {
    await assertAdmin(db, adminToken);
    const numItems = normalizeLimit(limit);
    const res = await db
      .query("userSessions")
      .withIndex("by_lastActive")
      .order("desc")
      .paginate({
        cursor: paginationToken ?? null,
        numItems,
      });
    return {
      items: res.page.map((s: any) => ({
        id: s._id,
        session_id: s.sessionId,
        user_name: s.userName,
        village_id: s.villageId,
        village_name: s.villageName,
        last_active: new Date(s.lastActive).toISOString(),
        created_at: new Date(s.createdAt).toISOString(),
        form_progress: (s.formProgress || {}) as Record<string, boolean>,
        work_mode: s.workMode,
        group_id: s.groupId,
      })),
      paginationToken: res.continueCursor,
      done: res.isDone,
    };
  },
});

export const _test = { normalizeLimit, cleanupCutoffMs };

export const remove = mutationGeneric({
  args: { adminToken: v.string(), sessionId: v.string() },
  handler: async ({ db }, { adminToken, sessionId }) => {
    const admin = await assertAdmin(db, adminToken);
    const existing = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (existing) {
      await db.delete(existing._id);
      try {
        await writeAuditLog(db, {
          actorId: `admin:${(admin as any).tokenHash}`,
          actionType: "sessions.remove",
          targetType: "userSessions",
          targetId: String(existing._id),
          fieldName: "deleted",
          oldValue: { sessionId: existing.sessionId, userName: existing.userName, villageId: existing.villageId },
          newValue: null,
        });
      } catch {}
    }
    return true;
  },
});

export const removeAll = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);

    const groupIds = (await db.query("groups").collect()).map((g: any) => g._id);
    for (const gid of groupIds) {
      const members = await db
        .query("groupMembers")
        .withIndex("by_groupId", (q: any) => q.eq("groupId", gid))
        .collect();
      for (const m of members) await db.delete(m._id);
      const state = await db
        .query("groupStates")
        .withIndex("by_groupId", (q: any) => q.eq("groupId", gid))
        .unique();
      if (state) await db.delete(state._id);
      await db.delete(gid);
    }

    const sessions = await db.query("userSessions").collect();
    for (const s of sessions) await db.delete(s._id);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "sessions.removeAll",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "deleted",
        oldValue: { sessions: sessions.length, groups: groupIds.length },
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const clearAllFormProgress = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);
    const sessions = await db.query("userSessions").collect();
    for (const s of sessions) {
      await db.patch(s._id, { formProgress: {}, formData: null });
    }
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "sessions.clearAllFormProgress",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "formProgress",
        oldValue: { sessions: sessions.length },
        newValue: {},
      });
    } catch {}
    return true;
  },
});

export const cleanupOldSessions = mutationGeneric({
  args: { secret: v.string() },
  handler: async ({ db }, { secret }) => {
    const expected = process.env.CRON_SECRET || "";
    const jobName = "cleanupOldSessions";
    const now = Date.now();
    if (!expected || secret !== expected) throw new Error("Insufficient permissions");
    const cutoff = cleanupCutoffMs(now);

    let deletedCount = 0;
    try {
      console.log(`[${jobName}] start`, { cutoff });
      for (let i = 0; i < 200; i++) {
        const rows = await db
          .query("userSessions")
          .withIndex("by_lastActive", (q) => q.lt("lastActive", cutoff))
          .order("asc")
          .take(200);
        if (!rows.length) break;
        for (const r of rows) {
          await db.delete(r._id);
          deletedCount += 1;
        }
      }
      await db.insert("cronRuns", { jobName, ranAt: Date.now(), ok: true, deletedCount });
      console.log(`[${jobName}] done`, { deletedCount });
      return { ok: true, deletedCount };
    } catch (e) {
      await db.insert("cronRuns", {
        jobName,
        ranAt: Date.now(),
        ok: false,
        deletedCount,
        errorMessage: (e as Error)?.message || String(e),
      });
      console.log(`[${jobName}] error`, { deletedCount, error: (e as Error)?.message || String(e) });
      throw e;
    }
  },
});
