import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";
import { AnggaranSchema } from "./validators/AnggaranSchema";

/**
 * Admin actions that actually write data to groupStates and userSessions.
 * Replaces the old approach of only bumping demo_seed_version / wipe_all_version.
 */

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
  const settings = await db
    .query("siteSettings")
    .withIndex("by_key", (q: any) => q.eq("key", "singleton"))
    .unique();
  if (settings) await db.patch(settings._id, { wipeAllVersion: now, updatedAt: now });
  return now;
}

async function clearAllGroupStates(db: any) {
  let groupStatesDeleted = 0;
  let chunksDeleted = 0;

  for (let i = 0; i < 10; i++) {
    const batch = await db.query("groupStates").take(200);
    if (!batch.length) break;
    for (const gs of batch) {
      await db.delete(gs._id);
      groupStatesDeleted++;
    }
    if (batch.length < 200) break;
  }

  for (let i = 0; i < 10; i++) {
    const chunks = await db.query("groupStateChunks").take(200);
    if (!chunks.length) break;
    for (const c of chunks) {
      await db.delete(c._id);
      chunksDeleted++;
    }
    if (chunks.length < 200) break;
  }

  return { groupStatesDeleted, chunksDeleted };
}

export const seedDemoData = mutationGeneric({
  args: {
    adminToken: v.string(),
    demoState: AnggaranSchema,
  },
  handler: async ({ db }, { adminToken, demoState }) => {
    const admin = await assertAdmin(db, adminToken);
    const now = Date.now();

    // Write demo data to ALL existing groupStates
    const groups = await db.query("groups").take(200);
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

    // Also write to all userSessions formData (for individual mode users)
    let sessionsUpdated = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("userSessions").withIndex("by_lastActive").order("desc").take(200);
      if (!batch.length) break;
      for (const s of batch) {
        if (!s.formData || JSON.stringify(s.formData) !== JSON.stringify(demoState)) {
          await db.patch(s._id, { formData: demoState });
          sessionsUpdated++;
        }
      }
      if (batch.length < 200) break;
      // Only process first batch for safety
      break;
    }

    // Bump siteSettings demo_seed_version so SiteLockGuard triggers client-side reload
    const settings = await db
      .query("siteSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "singleton"))
      .unique();
    if (settings) {
      await db.patch(settings._id, { demoSeedVersion: now, updatedAt: now });
    }

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.seedDemoData",
        targetType: "global",
        targetId: "*",
        fieldName: "demoSeed",
        oldValue: null,
        newValue: { groupsUpdated, sessionsUpdated },
      });
    } catch { /* ignore audit failure */ }

    return { ok: true, groupsUpdated, sessionsUpdated };
  },
});

export const wipeAllData = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);

    const { groupStatesDeleted } = await clearAllGroupStates(db);

    // Clear all userSessions formData and formProgress
    let sessionsCleared = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("userSessions").take(200);
      if (!batch.length) break;
      const needsPatch = batch.filter((s) => s.formData || (s.formProgress && Object.keys(s.formProgress as object).length > 0));
      for (const s of needsPatch) {
        await db.patch(s._id, { formData: null, formProgress: {} });
        sessionsCleared++;
      }
      if (batch.length < 200) break;
    }

    // Clear all reportSubmissions
    let reportsDeleted = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("reportSubmissions").take(200);
      if (!batch.length) break;
      for (const r of batch) {
        await db.delete(r._id);
        reportsDeleted++;
      }
    }

    // Bump siteSettings wipe_all_version so SiteLockGuard triggers client-side wipe
    await bumpWipeVersion(db);

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.wipeAllData",
        targetType: "global",
        targetId: "*",
        fieldName: "wipe",
        oldValue: { groupStatesDeleted, sessionsCleared, reportsDeleted },
        newValue: null,
      });
    } catch { /* ignore audit failure */ }

    return { ok: true, groupStatesDeleted, sessionsCleared, reportsDeleted };
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
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);
    let sessionsDeleted = 0;
    let groupsDeleted = 0;
    let membersDeleted = 0;

    for (let i = 0; i < 10; i++) {
      const members = await db.query("groupMembers").take(200);
      if (!members.length) break;
      for (const m of members) {
        await db.delete(m._id);
        membersDeleted++;
      }
      if (members.length < 200) break;
    }

    for (let i = 0; i < 10; i++) {
      const groups = await db.query("groups").take(200);
      if (!groups.length) break;
      for (const g of groups) {
        await deleteGroupData(db, g._id);
        await db.delete(g._id);
        groupsDeleted++;
      }
      if (groups.length < 200) break;
    }

    for (let i = 0; i < 10; i++) {
      const sessions = await db.query("userSessions").take(200);
      if (!sessions.length) break;
      for (const s of sessions) {
        await db.delete(s._id);
        sessionsDeleted++;
      }
      if (sessions.length < 200) break;
    }

    await bumpWipeVersion(db);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.kickAllUsers",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "deleted",
        oldValue: { sessionsDeleted, groupsDeleted, membersDeleted },
        newValue: null,
      });
    } catch {}
    return { ok: true, sessionsDeleted, groupsDeleted, membersDeleted };
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
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);
    const { groupStatesDeleted, chunksDeleted } = await clearAllGroupStates(db);
    let sessionsCleared = 0;

    for (let i = 0; i < 10; i++) {
      const batch = await db.query("userSessions").take(200);
      if (!batch.length) break;
      for (const s of batch) {
        await db.patch(s._id, { formProgress: {}, formData: null });
        sessionsCleared++;
      }
      if (batch.length < 200) break;
    }

    await bumpWipeVersion(db);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "admin.resetAllProgress",
        targetType: "userSessions",
        targetId: "*",
        fieldName: "formProgress",
        oldValue: { sessionsCleared, groupStatesDeleted, chunksDeleted },
        newValue: {},
      });
    } catch {}
    return { ok: true, sessionsCleared, groupStatesDeleted, chunksDeleted };
  },
});
