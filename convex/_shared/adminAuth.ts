import crypto from "crypto";

export function hashAdminToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function assertAdmin(db: any, adminToken: string) {
  const tokenHash = hashAdminToken(adminToken);
  const row = await db
    .query("adminSessions")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
    .first();
  if (!row) throw new Error("Insufficient permissions");
  if ((row as { expiresAt?: number }).expiresAt && (row as { expiresAt: number }).expiresAt < Date.now()) {
    throw new Error("Insufficient permissions");
  }
  return row;
}

