const webCrypto = (globalThis as any).crypto;

function bytesToHex(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

export async function hashAdminToken(token: string) {
  if (!webCrypto?.subtle) throw new Error("Crypto not available");
  const data = new TextEncoder().encode(token);
  const hash = await webCrypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export async function assertAdmin(db: any, adminToken: string) {
  const tokenHash = await hashAdminToken(adminToken);
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
