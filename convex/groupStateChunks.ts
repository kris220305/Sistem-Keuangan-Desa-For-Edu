import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

/**
 * groupStateChunks — per-category state storage for groups.
 * 
 * This splits the monolithic groupStates document into smaller chunks,
 * one per category (pendapatan, belanja, etc.). Benefits:
 * - Smaller sync payloads (only changed category is written)
 * - Less conflict (two users editing different categories don't conflict)
 * - Better Convex Free tier usage (smaller documents = less bandwidth)
 * 
 * The existing groupStates table is kept for backward compatibility.
 * The merge mutation in groupStates.ts still works as before.
 * This module provides an OPTIONAL optimized path for future migration.
 */

const VALID_CATEGORIES = [
  "pendapatan", "belanja", "pembiayaan", "penerimaan", "silpa", "spp",
  "pencairan", "penyetoranPajak", "saldoAwal", "spjPanjar", "sisaPanjar",
  "jurnalUmum", "kegiatanAnggaran", "mutasiKas",
] as const;

async function assertCanWrite(db: any, groupId: any, sessionId: string) {
  const member = await db
    .query("groupMembers")
    .withIndex("by_groupId_session", (q: any) => q.eq("groupId", groupId).eq("sessionId", sessionId))
    .first();
  if (!member) throw new Error("Insufficient permissions: belum bergabung ke kelompok");
  const perms = (member as { permissions?: unknown }).permissions;
  if (Array.isArray(perms) && !perms.includes("write")) {
    throw new Error("Insufficient permissions: tidak memiliki akses write");
  }
}

export const getCategory = queryGeneric({
  args: { groupId: v.id("groups"), category: v.string() },
  handler: async ({ db }, { groupId, category }) => {
    if (!VALID_CATEGORIES.includes(category as any)) return null;
    const doc = await db
      .query("groupStateChunks")
      .withIndex("by_groupId_category", (q) => q.eq("groupId", groupId).eq("category", category))
      .unique();
    if (!doc) return null;
    return {
      id: doc._id,
      groupId: doc.groupId,
      category: doc.category,
      data: doc.data,
      meta: doc.meta,
      updatedAt: doc.updatedAt,
      lastSessionId: doc.lastSessionId,
    };
  },
});

export const getAllCategories = queryGeneric({
  args: { groupId: v.id("groups") },
  handler: async ({ db }, { groupId }) => {
    const docs = await db
      .query("groupStateChunks")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .take(20);
    return docs.map((doc) => ({
      id: doc._id,
      category: doc.category,
      data: doc.data,
      meta: doc.meta,
      updatedAt: doc.updatedAt,
      lastSessionId: doc.lastSessionId,
    }));
  },
});

export const upsertCategory = mutationGeneric({
  args: {
    groupId: v.id("groups"),
    sessionId: v.string(),
    category: v.string(),
    data: v.any(),
    meta: v.optional(v.any()),
  },
  handler: async ({ db }, { groupId, sessionId, category, data, meta }) => {
    if (!VALID_CATEGORIES.includes(category as any)) {
      throw new Error(`Invalid category: ${category}`);
    }
    await assertCanWrite(db, groupId, sessionId);

    const existing = await db
      .query("groupStateChunks")
      .withIndex("by_groupId_category", (q) => q.eq("groupId", groupId).eq("category", category))
      .unique();

    const payload = {
      groupId,
      category,
      data,
      meta: meta ?? null,
      updatedAt: Date.now(),
      lastSessionId: sessionId,
    };

    if (existing) {
      await db.patch(existing._id, payload);
      return existing._id;
    }
    return await db.insert("groupStateChunks", payload);
  },
});

export const clearAll = mutationGeneric({
  args: { groupId: v.id("groups"), sessionId: v.string() },
  handler: async ({ db }, { groupId, sessionId }) => {
    // Only leader can clear
    const member = await db
      .query("groupMembers")
      .withIndex("by_groupId_session", (q: any) => q.eq("groupId", groupId).eq("sessionId", sessionId))
      .first();
    if (!member || !(member as any).isLeader) throw new Error("Insufficient permissions");

    const docs = await db
      .query("groupStateChunks")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .take(50);
    for (const doc of docs) {
      await db.delete(doc._id);
    }
    return true;
  },
});
