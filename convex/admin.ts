import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { assertAdmin, hashAdminToken } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";
import { cryptoUtils } from "./_shared/crypto";

export const login = mutationGeneric({
  args: { password: v.string() },
  handler: async ({ db }, { password }) => {
    const expected = process.env.ADMIN_PASSWORD || "admin";
    if (password !== expected) throw new ConvexError("Password salah");

    const token = cryptoUtils.bytesToHex(cryptoUtils.randomBytes(32));
    const tokenHash = await hashAdminToken(token);
    const now = Date.now();
    const expiresAt = now + 12 * 60 * 60 * 1000;

    await db.insert("adminSessions", { tokenHash, createdAt: now, expiresAt });
    try {
      await writeAuditLog(db, {
        actorId: "admin",
        actionType: "admin.login",
        targetType: "adminSessions",
        targetId: tokenHash,
        fieldName: "tokenHash",
        oldValue: null,
        newValue: tokenHash,
      });
    } catch {}
    return { token, expiresAt };
  },
});

export const validate = queryGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    try {
      await assertAdmin(db, adminToken);
      return true;
    } catch {
      return false;
    }
  },
});
