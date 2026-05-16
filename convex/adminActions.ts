import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";
import { AnggaranSchema } from "./validators/AnggaranSchema";

/**
 * Admin actions that actually write data to groupStates and userSessions.
 * Replaces the old approach of only bumping demo_seed_version / wipe_all_version.
 */

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
    const now = Date.now();

    // Clear all groupStates
    let groupStatesDeleted = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("groupStates").take(200);
      if (!batch.length) break;
      for (const gs of batch) {
        await db.delete(gs._id);
        groupStatesDeleted++;
      }
    }

    // Clear all groupStateChunks
    for (let i = 0; i < 10; i++) {
      const chunks = await db.query("groupStateChunks").take(200);
      if (!chunks.length) break;
      for (const c of chunks) await db.delete(c._id);
    }

    // Clear all userSessions formData and formProgress
    let sessionsCleared = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("userSessions").take(200);
      if (!batch.length) break;
      const needsPatch = batch.filter((s) => s.formData || (s.formProgress && Object.keys(s.formProgress as object).length > 0));
      if (!needsPatch.length) break;
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
    const settings = await db
      .query("siteSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "singleton"))
      .unique();
    if (settings) {
      await db.patch(settings._id, { wipeAllVersion: now, updatedAt: now });
    }

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
