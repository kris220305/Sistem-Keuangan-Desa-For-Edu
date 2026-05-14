import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";

export const generateUploadUrl = mutationGeneric({
  args: { sessionId: v.string() },
  handler: async ({ db, storage }, { sessionId }) => {
    const row = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!row) throw new Error("Session tidak ditemukan");
    const url = await storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const attachLatest = mutationGeneric({
  args: { sessionId: v.string(), storageId: v.id("_storage") },
  handler: async ({ db, storage }, { sessionId, storageId }) => {
    const row = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!row) throw new Error("Session tidak ditemukan");

    const now = Date.now();
    const prev = (row as any).latestScreenshotStorageId as string | undefined;
    if (prev && prev !== storageId) {
      try { await storage.delete(prev as any); } catch {}
    }
    await db.patch(row._id, {
      latestScreenshotStorageId: storageId,
      latestScreenshotUpdatedAt: now,
    });
    return true;
  },
});

export const getLatestUrl = queryGeneric({
  args: { adminToken: v.string(), sessionId: v.string() },
  handler: async ({ db, storage }, { adminToken, sessionId }) => {
    await assertAdmin(db, adminToken);
    const row = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!row) return { url: null, updatedAt: null };
    const sid = (row as any).latestScreenshotStorageId as any;
    const url = sid ? await storage.getUrl(sid) : null;
    const updatedAt = (row as any).latestScreenshotUpdatedAt ?? null;
    return { url, updatedAt };
  },
});

