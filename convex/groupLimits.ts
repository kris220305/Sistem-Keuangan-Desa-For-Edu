import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

const DEFAULT_MAX_GROUP_MEMBERS = 20;
const DEFAULT_MIN_GROUP_MEMBERS = 1;

export const getForVillage = queryGeneric({
  args: { villageId: v.string(), villageName: v.optional(v.string()) },
  handler: async ({ db }, { villageId, villageName }) => {
    const row = await db
      .query("villageGroupLimits")
      .withIndex("by_villageId", (q: any) => q.eq("villageId", villageId))
      .unique();
    if (row) {
      return {
        village_id: row.villageId,
        village_name: row.villageName,
        min_members: row.minMembers,
        max_members: row.maxMembers,
      };
    }
    return {
      village_id: villageId,
      village_name: villageName || "",
      min_members: DEFAULT_MIN_GROUP_MEMBERS,
      max_members: DEFAULT_MAX_GROUP_MEMBERS,
    };
  },
});

export const listAll = queryGeneric({
  args: {},
  handler: async ({ db }) => {
    const rows = await db.query("villageGroupLimits").collect();
    rows.sort((a, b) => a.villageName.localeCompare(b.villageName));
    return rows.map((r) => ({
      village_id: r.villageId,
      village_name: r.villageName,
      min_members: r.minMembers,
      max_members: r.maxMembers,
    }));
  },
});

export const upsert = mutationGeneric({
  args: {
    adminToken: v.string(),
    village_id: v.string(),
    village_name: v.string(),
    min_members: v.number(),
    max_members: v.number(),
  },
  handler: async ({ db }, args) => {
    const admin = await assertAdmin(db, args.adminToken);
    const now = Date.now();
    const minMembers = Math.max(1, Math.floor(args.min_members));
    const maxMembers = Math.max(1, Math.floor(args.max_members));
    const existing = await db
      .query("villageGroupLimits")
      .withIndex("by_villageId", (q: any) => q.eq("villageId", args.village_id))
      .unique();

    if (existing) {
      const oldValue = { minMembers: existing.minMembers, maxMembers: existing.maxMembers, villageName: existing.villageName };
      await db.patch(existing._id, {
        villageId: args.village_id,
        villageName: args.village_name,
        minMembers,
        maxMembers,
        updatedAt: now,
      });
      try {
        await writeAuditLog(db, {
          actorId: `admin:${(admin as any).tokenHash}`,
          actionType: "villageGroupLimits.upsert",
          targetType: "villageGroupLimits",
          targetId: String(existing._id),
          fieldName: "limits",
          oldValue,
          newValue: { minMembers, maxMembers, villageName: args.village_name },
        });
      } catch {}
      return existing._id;
    }

    const id = await db.insert("villageGroupLimits", {
      villageId: args.village_id,
      villageName: args.village_name,
      minMembers,
      maxMembers,
      updatedAt: now,
    });
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "villageGroupLimits.insert",
        targetType: "villageGroupLimits",
        targetId: String(id),
        fieldName: "limits",
        oldValue: null,
        newValue: { minMembers, maxMembers, villageName: args.village_name },
      });
    } catch {}
    return id;
  },
});

