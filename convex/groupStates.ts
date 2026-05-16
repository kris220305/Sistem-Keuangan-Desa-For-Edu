import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { AnggaranSchema } from "./validators/AnggaranSchema";
import { auditUtils, writeAuditLog } from "./_shared/audit";

/**
 * groupStates — monolithic shared state per group.
 * 
 * Current architecture: one document per group containing ALL form data.
 * The merge uses per-entity CRDT (version + Lamport timestamp + session tiebreaker)
 * so concurrent edits to DIFFERENT entities within the same collection don't conflict.
 * 
 * TODO: Modularize into per-category tables for better scalability:
 *   - groupPendapatan (pendapatan collection only)
 *   - groupBelanja (belanja collection only)
 *   - groupPembiayaan (pembiayaan collection only)
 *   - groupSPP (spp + pencairan + spjPanjar + sisaPanjar)
 *   - groupPenerimaan (penerimaan + silpa)
 *   - groupPembukuan (saldoAwal + jurnalUmum + penyetoranPajak)
 *   - groupKas (mutasiKas)
 * 
 * The groupStateChunks table is already populated as a side-effect of merge()
 * and can be used for per-category subscriptions in the future.
 * Migration path: switch frontend useQuery from groupStates.get to
 * groupStateChunks.getCategory per page, then deprecate the monolithic table.
 */

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
  if (!member) throw new Error("Insufficient permissions: Anda belum bergabung ke kelompok ini");
  const perms = (member as { permissions?: unknown }).permissions;
  if (!Array.isArray(perms)) return; // No permissions array = allow all (backward compat)
  if (!perms.includes("write")) throw new Error("Insufficient permissions: Anda tidak memiliki akses write");
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
    const oldHash = existing ? await auditUtils.hashJson(existing.state) : null;
    const newHash = await auditUtils.hashJson(state);
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
    const oldHash = existing ? await auditUtils.hashJson(existing.state) : null;
    const newHash = await auditUtils.hashJson(merged);
    const now = Date.now();
    const payload = {
      groupId,
      state: merged,
      updatedAt: now,
      lastSessionId: sessionId,
    };
    let resultId: any;
    if (existing) {
      await db.patch(existing._id, payload);
      resultId = existing._id;
    } else {
      resultId = await db.insert("groupStates", payload);
    }

    // Side-effect: populate groupStateChunks for per-category subscriptions
    const mergedObj = asObj(merged);
    const mergedMeta = asObj(mergedObj.__meta);
    for (const col of COLLECTIONS) {
      const arr = mergedObj[col];
      if (!Array.isArray(arr)) continue;
      // Extract meta entries for this category
      const catMeta: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(mergedMeta)) {
        if (k.startsWith(`${col}:`)) catMeta[k] = v;
      }
      const chunkDoc = await db
        .query("groupStateChunks")
        .withIndex("by_groupId_category", (q: any) => q.eq("groupId", groupId).eq("category", col))
        .unique();
      const chunkPayload = { groupId, category: col, data: arr, meta: catMeta, updatedAt: now, lastSessionId: sessionId };
      if (chunkDoc) {
        await db.patch(chunkDoc._id, chunkPayload);
      } else {
        await db.insert("groupStateChunks", chunkPayload);
      }
    }

    await writeAuditLog(db, {
      actorId: sessionId,
      actionType: "groupStates.merge",
      targetType: "groups",
      targetId: String(groupId),
      fieldName: "stateHash",
      oldValue: oldHash,
      newValue: newHash,
    });
    return resultId;
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
      const oldHash = await auditUtils.hashJson(existing.state);
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
    // Also clear all groupStateChunks for this group
    const chunks = await db
      .query("groupStateChunks")
      .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
      .take(50);
    for (const c of chunks) {
      await db.delete(c._id);
    }
    return true;
  },
});

export const _test = { assertCanWriteGroupState, assertIsLeader, mergeMetaWinner, mergeStatesServer };
