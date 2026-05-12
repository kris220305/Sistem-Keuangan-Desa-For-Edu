import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin, hashAdminToken } from "./_shared/adminAuth";
import { decryptJson, encryptJson } from "./_shared/crypto";
import { writeAuditLog } from "./_shared/audit";

const SnapshotSchema = v.record(v.string(), v.union(v.string(), v.null()));

export const saveBackup = mutationGeneric({
  args: { adminToken: v.string(), snapshot: SnapshotSchema },
  handler: async ({ db }, { adminToken, snapshot }) => {
    await assertAdmin(db, adminToken);
    const key = process.env.IMPERSONATION_ENCRYPTION_KEY || "";
    const adminTokenHash = hashAdminToken(adminToken);
    const enc = encryptJson(snapshot, key);
    const existing = await db
      .query("impersonationBackups")
      .withIndex("by_adminTokenHash", (q) => q.eq("adminTokenHash", adminTokenHash))
      .first();
    if (existing) {
      await db.patch(existing._id, { ...enc, updatedAt: Date.now() });
    } else {
      await db.insert("impersonationBackups", { adminTokenHash, ...enc, updatedAt: Date.now() });
    }
    try {
      await writeAuditLog(db, {
        actorId: `admin:${adminTokenHash}`,
        actionType: "impersonation.saveBackup",
        targetType: "impersonationBackups",
        targetId: adminTokenHash,
        fieldName: "backup",
        oldValue: existing ? "exists" : null,
        newValue: "saved",
      });
    } catch {}
    return true;
  },
});

export const getBackup = queryGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    await assertAdmin(db, adminToken);
    const key = process.env.IMPERSONATION_ENCRYPTION_KEY || "";
    const adminTokenHash = hashAdminToken(adminToken);
    const row = await db
      .query("impersonationBackups")
      .withIndex("by_adminTokenHash", (q) => q.eq("adminTokenHash", adminTokenHash))
      .first();
    if (!row) return null;
    return decryptJson({ iv: row.iv, tag: row.tag, ciphertext: row.ciphertext }, key) as Record<string, string | null>;
  },
});

export const clearBackup = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    await assertAdmin(db, adminToken);
    const adminTokenHash = hashAdminToken(adminToken);
    const row = await db
      .query("impersonationBackups")
      .withIndex("by_adminTokenHash", (q) => q.eq("adminTokenHash", adminTokenHash))
      .first();
    if (row) await db.delete(row._id);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${adminTokenHash}`,
        actionType: "impersonation.clearBackup",
        targetType: "impersonationBackups",
        targetId: adminTokenHash,
        fieldName: "backup",
        oldValue: row ? "exists" : null,
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const recordEvent = mutationGeneric({
  args: {
    adminToken: v.string(),
    targetSessionId: v.string(),
    actionType: v.string(),
    payload: v.any(),
  },
  handler: async ({ db }, { adminToken, targetSessionId, actionType, payload }) => {
    await assertAdmin(db, adminToken);
    const key = process.env.IMPERSONATION_ENCRYPTION_KEY || "";
    const adminTokenHash = hashAdminToken(adminToken);
    const enc = encryptJson(payload, key);
    const id = await db.insert("impersonationHistory", {
      adminTokenHash,
      targetSessionId,
      actionType,
      ...enc,
      createdAt: Date.now(),
    });
    try {
      await writeAuditLog(db, {
        actorId: `admin:${adminTokenHash}`,
        actionType: "impersonation.recordEvent",
        targetType: "impersonationHistory",
        targetId: String(id),
        fieldName: "actionType",
        oldValue: null,
        newValue: actionType,
      });
    } catch {}
    return id;
  },
});

