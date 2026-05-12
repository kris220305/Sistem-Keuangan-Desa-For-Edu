const webCrypto = (globalThis as any).crypto;

function safeStringify(value: unknown, maxLen = 8000) {
  try {
    const s = JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen);
  } catch {
    const s = String(value);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen);
  }
}

function bytesToHex(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

async function hashJson(value: unknown) {
  if (!webCrypto?.subtle) throw new Error("Crypto not available");
  const s = safeStringify(value, 200_000);
  const data = new TextEncoder().encode(s);
  const hash = await webCrypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

export async function writeAuditLog(db: any, input: {
  actorId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  await db.insert("auditLog", {
    actorId: input.actorId,
    actionType: input.actionType,
    targetType: input.targetType,
    targetId: input.targetId,
    fieldName: input.fieldName,
    oldValue: safeStringify(input.oldValue),
    newValue: safeStringify(input.newValue),
    createdAt: Date.now(),
  });
}

export const auditUtils = { safeStringify, hashJson };
