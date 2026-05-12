import crypto from "crypto";

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

function hashJson(value: unknown) {
  return crypto.createHash("sha256").update(safeStringify(value, 200_000)).digest("hex");
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

