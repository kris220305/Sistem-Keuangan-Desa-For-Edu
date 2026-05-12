import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { AnggaranSchema } from "./validators/AnggaranSchema";
import { auditUtils, writeAuditLog } from "./_shared/audit";

const COLLECTIONS = [
  "pendapatan",
  "belanja",
  "pembiayaan",
  "penerimaan",
  "silpa",
  "spp",
  "pencairan",
  "penyetoranPajak",
  "saldoAwal",
  "spjPanjar",
  "sisaPanjar",
  "jurnalUmum",
  "kegiatanAnggaran",
] as const;

type MetaEntry = { v: number; t: number; by?: string };
type MetaMap = Record<string, MetaEntry>;

function asObj(x: unknown): Record<string, unknown> {
  return typeof x === "object" && x !== null ? (x as Record<string, unknown>) : {};
}

async function assertCanWriteGroupState(db: any, groupId: any, sessionId: string) {
  const member = await db
    .query("groupMembers")
    .withIndex("by_groupId_session", (q: any) => q.eq("groupId", groupId).eq("sessionId", sessionId))
    .first();
  if (!member) throw new Error("Insufficient permissions");
  const perms = (member as { permissions?: unknown }).permissions;
  if (!Array.isArray(perms)) return;
  if (!perms.includes("write")) throw new Error("Insufficient permissions");
}

async function assertIsLeader(db: any, groupId: any, sessionId: string) {
  const member = await db
    .query("groupMembers")
    .withIndex("by_groupId_session", (q: any) => q.eq("groupId", groupId).eq("sessionId", sessionId))
    .first();
  if (!member || !(member as { isLeader?: boolean }).isLeader) throw new Error("Insufficient permissions");
}

function mergeMetaWinner(local: MetaMap, remote: MetaMap, key: string): "local" | "remote" {
  const a = local[key];
  const b = remote[key];
  if (!a) return "remote";
  if (!b) return "local";
  if (b.v > a.v) return "remote";
  if (b.v < a.v) return "local";
  if (b.t > a.t) return "remote";
  if (b.t < a.t) return "local";
  const aby = a.by || "";
  const bby = b.by || "";
  const c = bby.localeCompare(aby);
  if (c > 0) return "remote";
  if (c < 0) return "local";
  return "remote";
}

function mergeStatesServer(localState: unknown, incomingState: unknown): unknown {
  const local = asObj(localState);
  const remote = asObj(incomingState);
  const localMeta = asObj(local.__meta) as MetaMap;
  const remoteMeta = asObj(remote.__meta) as MetaMap;

  const out: Record<string, unknown> = { ...local };
  const outMeta: MetaMap = { ...localMeta };

  for (const col of COLLECTIONS) {
    const localArr = Array.isArray(local[col]) ? (local[col] as Array<Record<string, unknown>>) : [];
    const remoteArr = Array.isArray(remote[col]) ? (remote[col] as Array<Record<string, unknown>>) : [];
    const map = new Map<string, Record<string, unknown>>();
    for (const x of localArr) {
      const id = String((x as { id?: unknown }).id || "");
      if (id) map.set(id, x);
    }
    for (const r of remoteArr) {
      const id = String((r as { id?: unknown }).id || "");
      if (!id) continue;
      const w = mergeMetaWinner(outMeta, remoteMeta, `${col}:${id}`);
      if (w === "remote") map.set(id, r);
    }
    for (const key of Object.keys(remoteMeta)) {
      if (!key.startsWith(`${col}:`) || !key.endsWith("__deleted")) continue;
      const id = key.slice(col.length + 1, -("__deleted".length));
      const w = mergeMetaWinner(outMeta, remoteMeta, `${col}:${id}`);
      if (w === "remote") map.delete(id);
    }
    for (const [k, v] of Object.entries(remoteMeta)) {
      if (!k.startsWith(`${col}:`)) continue;
      const cur = outMeta[k];
      if (!cur) {
        outMeta[k] = v;
        continue;
      }
      if (v.v > cur.v) {
        outMeta[k] = v;
        continue;
      }
      if (v.v < cur.v) continue;
      if (v.t > cur.t) {
        outMeta[k] = v;
        continue;
      }
      if (v.t < cur.t) continue;
      const c = String(v.by || "").localeCompare(String(cur.by || ""));
      if (c > 0) outMeta[k] = v;
    }
    out[col] = Array.from(map.values());
  }

  for (const [k, v] of Object.entries(remote)) {
    if (k === "__meta") continue;
    if ((COLLECTIONS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }

  out.__meta = outMeta;
  return out;
}

export const get = queryGeneric({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async ({ db }, { groupId }) => {
    if (!groupId) return null;
    const doc = await db
      .query("groupStates")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .unique();
    if (!doc) return null;
    return {
      id: doc._id,
      groupId: doc.groupId,
      state: doc.state,
      updatedAt: doc.updatedAt,
      lastSessionId: doc.lastSessionId,
    };
  },
});

export const upsert = mutationGeneric({
  args: { groupId: v.id("groups"), sessionId: v.string(), state: AnggaranSchema },
  handler: async ({ db }, { groupId, sessionId, state }) => {
    await assertCanWriteGroupState(db, groupId, sessionId);
    const existing = await db
      .query("groupStates")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .unique();
    const oldHash = existing ? auditUtils.hashJson(existing.state) : null;
    const newHash = auditUtils.hashJson(state);
    const payload = {
      groupId,
      state,
      updatedAt: Date.now(),
      lastSessionId: sessionId,
    };
    if (existing) {
      await db.patch(existing._id, payload);
      await writeAuditLog(db, {
        actorId: sessionId,
        actionType: "groupStates.upsert",
        targetType: "groups",
        targetId: String(groupId),
        fieldName: "stateHash",
        oldValue: oldHash,
        newValue: newHash,
      });
      return existing._id;
    }
    const id = await db.insert("groupStates", payload);
    await writeAuditLog(db, {
      actorId: sessionId,
      actionType: "groupStates.upsert",
      targetType: "groups",
      targetId: String(groupId),
      fieldName: "stateHash",
      oldValue: oldHash,
      newValue: newHash,
    });
    return id;
  },
});

export const merge = mutationGeneric({
  args: { groupId: v.id("groups"), sessionId: v.string(), state: AnggaranSchema },
  handler: async ({ db }, { groupId, sessionId, state }) => {
    await assertCanWriteGroupState(db, groupId, sessionId);
    const existing = await db
      .query("groupStates")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .unique();
    const merged = existing ? mergeStatesServer(existing.state, state) : state;
    const oldHash = existing ? auditUtils.hashJson(existing.state) : null;
    const newHash = auditUtils.hashJson(merged);
    const payload = {
      groupId,
      state: merged,
      updatedAt: Date.now(),
      lastSessionId: sessionId,
    };
    if (existing) {
      await db.patch(existing._id, payload);
      await writeAuditLog(db, {
        actorId: sessionId,
        actionType: "groupStates.merge",
        targetType: "groups",
        targetId: String(groupId),
        fieldName: "stateHash",
        oldValue: oldHash,
        newValue: newHash,
      });
      return existing._id;
    }
    const id = await db.insert("groupStates", payload);
    await writeAuditLog(db, {
      actorId: sessionId,
      actionType: "groupStates.merge",
      targetType: "groups",
      targetId: String(groupId),
      fieldName: "stateHash",
      oldValue: oldHash,
      newValue: newHash,
    });
    return id;
  },
});

export const clear = mutationGeneric({
  args: { groupId: v.id("groups"), sessionId: v.string() },
  handler: async ({ db }, { groupId, sessionId }) => {
    await assertIsLeader(db, groupId, sessionId);
    const existing = await db
      .query("groupStates")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .unique();
    if (existing) {
      const oldHash = auditUtils.hashJson(existing.state);
      await db.delete(existing._id);
      await writeAuditLog(db, {
        actorId: sessionId,
        actionType: "groupStates.clear",
        targetType: "groups",
        targetId: String(groupId),
        fieldName: "stateHash",
        oldValue: oldHash,
        newValue: null,
      });
    }
    return true;
  },
});

export const _test = { assertCanWriteGroupState, assertIsLeader, mergeMetaWinner, mergeStatesServer };
