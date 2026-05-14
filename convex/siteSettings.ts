import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

const SETTINGS_KEY = "singleton";

async function ensureRow(db: any) {
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
    updatedAt: now,
  });
  return await db.get(id);
}

export const get = queryGeneric({
  args: {},
  handler: async ({ db }) => {
    const row = await ensureRow(db);
    if (!row) return null;
    return {
      id: row._id,
      is_locked: row.isLocked,
      max_users: row.maxUsers,
      updated_at: new Date(row.updatedAt).toISOString(),
    };
  },
});

export const update = mutationGeneric({
  args: {
    adminToken: v.string(),
    is_locked: v.optional(v.boolean()),
    max_users: v.optional(v.number()),
  },
  handler: async ({ db }, { adminToken, is_locked, max_users }) => {
    const admin = await assertAdmin(db, adminToken);
    const row = await ensureRow(db);
    if (!row) throw new Error("Site settings tidak tersedia");

    const patch: any = { updatedAt: Date.now() };
    if (typeof is_locked === "boolean") patch.isLocked = is_locked;
    if (typeof max_users === "number") patch.maxUsers = Math.max(1, Math.floor(max_users));

    const oldValue = { isLocked: row.isLocked, maxUsers: row.maxUsers };
    await db.patch(row._id, patch);
    const next = await db.get(row._id);
    const newValue = { isLocked: next?.isLocked, maxUsers: next?.maxUsers };

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

