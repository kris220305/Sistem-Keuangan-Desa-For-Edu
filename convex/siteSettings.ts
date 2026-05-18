import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

const SETTINGS_KEY = "singleton";

async function getRow(db: any) {
  return await db
    .query("siteSettings")
    .withIndex("by_key", (q: any) => q.eq("key", SETTINGS_KEY))
    .unique();
}

async function ensureRow(db: any) {
  const existing = await getRow(db);
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

export const get = queryGeneric({
  args: {},
  handler: async ({ db }) => {
    const row = await getRow(db);
    if (!row) {
      // Return safe defaults — row will be created on first mutation
      return {
        id: null,
        is_locked: false,
        max_users: 200,
        demo_seed_version: 0,
        wipe_all_version: 0,
        updated_at: new Date().toISOString(),
      };
    }
    return {
      id: row._id,
      is_locked: row.isLocked,
      max_users: row.maxUsers,
      demo_seed_version: row.demoSeedVersion ?? 0,
      wipe_all_version: row.wipeAllVersion ?? 0,
      updated_at: new Date(row.updatedAt).toISOString(),
    };
  },
});

export const update = mutationGeneric({
  args: {
    adminToken: v.string(),
    is_locked: v.optional(v.boolean()),
    max_users: v.optional(v.number()),
    demo_seed_version: v.optional(v.number()),
    wipe_all_version: v.optional(v.number()),
  },
  handler: async ({ db }, { adminToken, is_locked, max_users, demo_seed_version, wipe_all_version }) => {
    const admin = await assertAdmin(db, adminToken);
    const row = await ensureRow(db);
    if (!row) throw new Error("Site settings tidak tersedia");

    const patch: any = { updatedAt: Date.now() };
    if (typeof is_locked === "boolean") patch.isLocked = is_locked;
    if (typeof max_users === "number") patch.maxUsers = Math.max(1, Math.floor(max_users));
    if (typeof demo_seed_version === "number") patch.demoSeedVersion = Math.max(0, Math.floor(demo_seed_version));
    if (typeof wipe_all_version === "number") patch.wipeAllVersion = Math.max(0, Math.floor(wipe_all_version));

    const oldValue = {
      isLocked: row.isLocked,
      maxUsers: row.maxUsers,
      demoSeedVersion: row.demoSeedVersion ?? 0,
      wipeAllVersion: row.wipeAllVersion ?? 0,
    };
    await db.patch(row._id, patch);
    const next = await db.get(row._id);
    const newValue = {
      isLocked: next?.isLocked,
      maxUsers: next?.maxUsers,
      demoSeedVersion: next?.demoSeedVersion ?? 0,
      wipeAllVersion: next?.wipeAllVersion ?? 0,
    };

    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "siteSettings.update",
        targetType: "siteSettings",
        targetId: String(row._id),
        fieldName: "settings",
        oldValue,
        newValue,
      });
    } catch {}

    return true;
  },
});
