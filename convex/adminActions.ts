import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";
import { AnggaranSchema } from "./validators/AnggaranSchema";

/**
 * Admin actions that actually write data to groupStates and userSessions.
 * Replaces the old approach of only bumping demo_seed_version / wipe_all_version.
 */

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 50;

const SETTINGS_KEY = "singleton";

async function ensureSettingsRow(db: any) {
  const existing = await db
    .query("siteSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SETTINGS_KEY))
    .unique();
  if (existing) return existing;
  const now = Date.now();
  const id = await db.insert("siteSettings", {
    key: SETTINGS_KEY,
    isLocked: false,
    maxUsers: 200,
    demoSeedVersion: 0,
    wipeAllVersion: 0,
    updatedAt: now,
  });
  return await db.get(id);
}

function normalizeBatchSize(batchSize: number | undefined) {
  if (!Number.isFinite(batchSize ?? DEFAULT_BATCH_SIZE)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(batchSize ?? DEFAULT_BATCH_SIZE)));
}

async function deleteGroupData(db: any, groupId: any) {
  const state = await db
    .query("groupStates")
    .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
    .unique();
  if (state) await db.delete(state._id);

  for (let i = 0; i < 10; i++) {
    const chunks = await db
      .query("groupStateChunks")
      .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
      .take(200);
    if (!chunks.length) break;
    for (const c of chunks) await db.delete(c._id);
    if (chunks.length < 200) break;
  }
}

async function recountMembers(db: any, groupId: any) {
  const members = await db
    .query("groupMembers")
    .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
    .take(200);
  return members.length;
}

async function detachSessionFromGroups(db: any, sessionId: string) {
  const memberships = await db
    .query("groupMembers")
    .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
    .collect();

  let groupsTouched = 0;
  for (const m of memberships) {
    const groupId = m.groupId;
    await db.delete(m._id);
    const group = await db.get(groupId);
    if (!group) continue;

    const nextCount = await recountMembers(db, groupId);
    if (nextCount === 0) {
      await deleteGroupData(db, groupId);
      await db.delete(groupId);
    } else {
      const leader = await db
        .query("groupMembers")
        .withIndex("by_groupId_isLeader", (q: any) => q.eq("groupId", groupId).eq("isLeader", true))
        .first();
      const firstMember = leader || await db
        .query("groupMembers")
        .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
        .first();
      if (firstMember && !firstMember.isLeader) await db.patch(firstMember._id, { isLeader: true });
      await db.patch(groupId, {
        memberCount: nextCount,
        currentLeaderId: firstMember?._id,
      });
    }
    groupsTouched++;
  }
  return groupsTouched;
}

async function bumpWipeVersion(db: any) {
  const now = Date.now();
  const settings = await ensureSettingsRow(db);
  if (settings) await db.patch(settings._id, { wipeAllVersion: now, updatedAt: now });
  return now;
}

async function bumpDemoVersion(db: any) {
  const now = Date.now();
  const settings = await ensureSettingsRow(db);
  if (settings) await db.patch(settings._id, { demoSeedVersion: now, updatedAt: now });
  return now;
}

async function clearGroupStatesBatch(db: any, batchSize: number) {
  let groupStatesDeleted = 0;
  let chunksDeleted = 0;

  const states = await db.query("groupStates").take(batchSize);
  for (const gs of states) {
    await db.delete(gs._id);
    groupStatesDeleted++;
  }

  const chunks = await db.query("groupStateChunks").take(batchSize);
  for (const c of chunks) {
    await db.delete(c._id);
    chunksDeleted++;
  }

  return {
    groupStatesDeleted,
    chunksDeleted,
    hasMoreGroupStates: states.length === batchSize,
    hasMoreChunks: chunks.length === batchSize,
  };
}

async function deleteReportsBatch(db: any, storage: any, batchSize: number) {
  const reports = await db.query("reportSubmissions").take(batchSize);
  let reportsDeleted = 0;
  for (const r of reports) {
    if (r.pdfStorageId) {
      try { await storage.delete(r.pdfStorageId); } catch {}
    }
    await db.delete(r._id);
    reportsDeleted++;
  }
  return { reportsDeleted, hasMoreReports: reports.length === batchSize };
}

async function deleteAllUsersBatch(db: any, batchSize: number) {
  const members = await db.query("groupMembers").take(batchSize);
  let membersDeleted = 0;
  for (const m of members) {
    await db.delete(m._id);
    membersDeleted++;
  }

  const groups = await db.query("groups").take(batchSize);
  let groupsDeleted = 0;
  for (const g of groups) {
    await db.delete(g._id);
    groupsDeleted++;
  }

  const sessions = await db.query("userSessions").take(batchSize);
  let sessionsDeleted = 0;
  for (const s of sessions) {
    await db.delete(s._id);
    sessionsDeleted++;
  }

  return {
    membersDeleted,
    groupsDeleted,
    sessionsDeleted,
    hasMoreMembers: members.length === batchSize,
    hasMoreGroups: groups.length === batchSize,
    hasMoreSessions: sessions.length === batchSize,
  };
}

export const seedDemoData = mutationGeneric({
  args: {
    adminToken: v.string(),
    demoState: AnggaranSchema,
    batchSize: v.optional(v.number()),
  },
  handler: async ({ db }, { adminToken, demoState, batchSize }) => {
    const admin = await assertAdmin(db, adminToken);
    const now = Date.now();
    const limit = normalizeBatchSize(batchSize);

    // Write demo data to a small batch of groups. Clients also react to
    // demoSeedVersion, so this does not need one giant transaction.
    const groups = await db.query("groups").take(limit);
    let groupsUpdated = 0;
    for (const g of groups) {
      const existing = await db
        .query("groupStates")
        .withIndex("by_groupId", (q) => q.eq("groupId", g._id))
        .unique();
      const payload = {
        groupId: g._id,
        state: demoState,
        updatedAt: now,
        lastSessionId: "admin:seed",
      };
      if (existing) {
        await db.patch(existing._id, payload);
      } else {
        await db.insert("groupStates", payload);
      }
      groupsUpdated++;
    }

    const done = true;
    await bumpDemoVersion(db);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.seedDemoData",
        targetType: "global",
        targetId: "*",
        fieldName: "demoSeed",
        oldValue: null,
        newValue: { groupsUpdated, done },
      });
    } catch { /* ignore audit failure */ }

    return { ok: true, done, groupsUpdated, sessionsUpdated: 0 };
  },
});

export const wipeAllData = mutationGeneric({
  args: { adminToken: v.string(), batchSize: v.optional(v.number()) },
  handler: async ({ db, storage }, { adminToken, batchSize }) => {
    const admin = await assertAdmin(db, adminToken);
    const limit = normalizeBatchSize(batchSize);

    const cleared = await clearGroupStatesBatch(db, limit);
    const reports = await deleteReportsBatch(db, storage, limit);
    const done = !cleared.hasMoreGroupStates && !cleared.hasMoreChunks && !reports.hasMoreReports;

    if (done) await bumpWipeVersion(db);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.wipeAllData",
        targetType: "global",
        targetId: "*",
        fieldName: "wipe",
        oldValue: {
          groupStatesDeleted: cleared.groupStatesDeleted,
          chunksDeleted: cleared.chunksDeleted,
          reportsDeleted: reports.reportsDeleted,
          done,
        },
        newValue: null,
      });
    } catch { /* ignore audit failure */ }

    return {
      ok: true,
      done,
      groupStatesDeleted: cleared.groupStatesDeleted,
      chunksDeleted: cleared.chunksDeleted,
      sessionsCleared: 0,
      reportsDeleted: reports.reportsDeleted,
    };
  },
});

export const kickUser = mutationGeneric({
  args: { adminToken: v.string(), sessionId: v.string() },
  handler: async ({ db }, { adminToken, sessionId }) => {
    const admin = await assertAdmin(db, adminToken);
    const existing = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .unique();
    const groupsTouched = await detachSessionFromGroups(db, sessionId);
    if (existing) await db.delete(existing._id);
    await bumpWipeVersion(db);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.kickUser",
        targetType: "userSessions",
        targetId: sessionId,
        fieldName: "deleted",
        oldValue: existing ? { sessionId, userName: existing.userName, groupsTouched } : { sessionId, groupsTouched },
        newValue: null,
      });
    } catch {}
    return { ok: true, deleted: !!existing, groupsTouched };
  },
});

export const kickAllUsers = mutationGeneric({
  args: { adminToken: v.string(), batchSize: v.optional(v.number()) },
  handler: async ({ db }, { adminToken, batchSize }) => {
    const admin = await assertAdmin(db, adminToken);
    const limit = normalizeBatchSize(batchSize);
    const cleared = await clearGroupStatesBatch(db, limit);
    const deleted = await deleteAllUsersBatch(db, limit);
    const done =
      !cleared.hasMoreGroupStates &&
      !cleared.hasMoreChunks &&
      !deleted.hasMoreMembers &&
      !deleted.hasMoreGroups &&
      !deleted.hasMoreSessions;

    if (done) await bumpWipeVersion(db);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.kickAllUsers",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "deleted",
        oldValue: {
          sessionsDeleted: deleted.sessionsDeleted,
          groupsDeleted: deleted.groupsDeleted,
          membersDeleted: deleted.membersDeleted,
          groupStatesDeleted: cleared.groupStatesDeleted,
          chunksDeleted: cleared.chunksDeleted,
          done,
        },
        newValue: null,
      });
    } catch {}
    return {
      ok: true,
      done,
      sessionsDeleted: deleted.sessionsDeleted,
      groupsDeleted: deleted.groupsDeleted,
      membersDeleted: deleted.membersDeleted,
      groupStatesDeleted: cleared.groupStatesDeleted,
      chunksDeleted: cleared.chunksDeleted,
    };
  },
});

export const resetUserProgress = mutationGeneric({
  args: { adminToken: v.string(), sessionId: v.string() },
  handler: async ({ db }, { adminToken, sessionId }) => {
    const admin = await assertAdmin(db, adminToken);
    const existing = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q: any) => q.eq("sessionId", sessionId))
      .unique();
    if (!existing) return { ok: true, cleared: false, groupCleared: false };

    await db.patch(existing._id, { formProgress: {}, formData: null });
    let groupCleared = false;
    if (existing.groupId) {
      await deleteGroupData(db, existing.groupId);
      groupCleared = true;
    }
    await bumpWipeVersion(db);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.resetUserProgress",
        targetType: "userSessions",
        targetId: sessionId,
        fieldName: "formProgress",
        oldValue: { formProgress: existing.formProgress || {}, hadFormData: !!existing.formData, groupCleared },
        newValue: {},
      });
    } catch {}
    return { ok: true, cleared: true, groupCleared };
  },
});

export const resetAllProgress = mutationGeneric({
  args: { adminToken: v.string(), batchSize: v.optional(v.number()) },
  handler: async ({ db }, { adminToken, batchSize }) => {
    const admin = await assertAdmin(db, adminToken);
    const limit = normalizeBatchSize(batchSize);
    const cleared = await clearGroupStatesBatch(db, limit);
    const done = !cleared.hasMoreGroupStates && !cleared.hasMoreChunks;

    if (done) await bumpWipeVersion(db);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.resetAllProgress",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "formProgress",
        oldValue: {
          sessionsCleared: 0,
          groupStatesDeleted: cleared.groupStatesDeleted,
          chunksDeleted: cleared.chunksDeleted,
          done,
        },
        newValue: {},
      });
    } catch {}
    return {
      ok: true,
      done,
      sessionsCleared: 0,
      groupStatesDeleted: cleared.groupStatesDeleted,
      chunksDeleted: cleared.chunksDeleted,
    };
  },
});
