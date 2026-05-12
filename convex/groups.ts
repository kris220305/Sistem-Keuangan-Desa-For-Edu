import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { writeAuditLog } from "./_shared/audit";

function letterFor(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

async function recountMembers(db: any, groupId: any): Promise<number> {
  const rows = await db
    .query("groupMembers")
    .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
    .collect();
  return rows.length;
}

async function getLeaderMember(db: any, groupId: any) {
  return await db
    .query("groupMembers")
    .withIndex("by_groupId_isLeader", (q: any) => q.eq("groupId", groupId).eq("isLeader", true))
    .first();
}

async function ensureLeader(db: any, groupId: any) {
  const leader = await getLeaderMember(db, groupId);
  if (leader) return leader;
  const first = await db.query("groupMembers").withIndex("by_groupId", (q: any) => q.eq("groupId", groupId)).first();
  if (first) {
    await db.patch(first._id, { isLeader: true });
    return first;
  }
  return null;
}

export const listForVillage = queryGeneric({
  args: { villageId: v.string() },
  handler: async ({ db }, { villageId }) => {
    const groups = await db
      .query("groups")
      .withIndex("by_villageId", (q) => q.eq("villageId", villageId))
      .collect();
    groups.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return groups.map((g) => ({
      id: g._id,
      name: g.name,
      village_id: g.villageId,
      village_name: g.villageName,
      created_at: new Date(g.createdAt).toISOString(),
      member_count: g.memberCount,
      max_members: g.maxMembers,
      is_full: g.memberCount >= g.maxMembers,
    }));
  },
});

export const listAllWithCounts = queryGeneric({
  args: {},
  handler: async ({ db }) => {
    const groups = await db.query("groups").collect();
    groups.sort((a, b) => {
      if (a.villageName !== b.villageName) return a.villageName.localeCompare(b.villageName);
      return a.name.localeCompare(b.name);
    });
    return groups.map((g) => ({
      id: g._id,
      name: g.name,
      village_id: g.villageId,
      village_name: g.villageName,
      created_at: new Date(g.createdAt).toISOString(),
      member_count: g.memberCount,
      max_members: g.maxMembers,
      is_full: g.memberCount >= g.maxMembers,
    }));
  },
});

export const get = queryGeneric({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async ({ db }, { groupId }) => {
    if (!groupId) return null;
    const g = await db.get(groupId);
    if (!g) return null;
    return {
      id: g._id,
      name: g.name,
      village_id: g.villageId,
      village_name: g.villageName,
      created_at: new Date(g.createdAt).toISOString(),
      member_count: g.memberCount,
      max_members: g.maxMembers,
      is_full: g.memberCount >= g.maxMembers,
    };
  },
});

export const members = queryGeneric({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async ({ db }, { groupId }) => {
    if (!groupId) return [];
    const rows = await db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect();
    rows.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    return rows.map((m) => ({
      id: m._id,
      group_id: m.groupId,
      session_id: m.sessionId,
      user_name: m.userName,
      is_leader: m.isLeader,
      joined_at: new Date(m.joinedAt).toISOString(),
    }));
  },
});

export const isLeader = queryGeneric({
  args: { groupId: v.id("groups"), sessionId: v.string() },
  handler: async ({ db }, { groupId, sessionId }) => {
    const me = await db
      .query("groupMembers")
      .withIndex("by_groupId_session", (q) => q.eq("groupId", groupId).eq("sessionId", sessionId))
      .first();
    return !!me?.isLeader;
  },
});

export const joinGroup = mutationGeneric({
  args: {
    villageId: v.string(),
    villageName: v.string(),
    userName: v.string(),
    sessionId: v.string(),
    preferredGroupId: v.optional(v.id("groups")),
    maxMembers: v.optional(v.number()),
  },
  handler: async ({ db }, args) => {
    const maxMembers = Math.max(2, Math.floor(args.maxMembers ?? 50));

    const existingMemberships = await db
      .query("groupMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const m of existingMemberships) {
      await db.delete(m._id);
      try {
        await writeAuditLog(db, {
          actorId: args.sessionId,
          actionType: "groups.detachMember",
          targetType: "groupMembers",
          targetId: String(m._id),
          fieldName: "member",
          oldValue: { groupId: String(m.groupId), sessionId: m.sessionId, isLeader: m.isLeader },
          newValue: null,
        });
      } catch {}
      const g = await db.get(m.groupId);
      if (!g) continue;
      const prevCount = g.memberCount || 0;
      const nextCount = await recountMembers(db, g._id);
      await db.patch(g._id, { memberCount: nextCount });
      try {
        await writeAuditLog(db, {
          actorId: args.sessionId,
          actionType: "groups.updateMemberCount",
          targetType: "groups",
          targetId: String(g._id),
          fieldName: "memberCount",
          oldValue: prevCount,
          newValue: nextCount,
        });
      } catch {}
      if (nextCount === 0) {
        await db.delete(g._id);
        const st = await db
          .query("groupStates")
          .withIndex("by_groupId", (q) => q.eq("groupId", g._id))
          .unique();
        if (st) await db.delete(st._id);
        continue;
      }
      if (m.isLeader) {
        const nextLeader = await ensureLeader(db, g._id);
        await db.patch(g._id, { currentLeaderId: nextLeader?._id });
        try {
          await writeAuditLog(db, {
            actorId: args.sessionId,
            actionType: "groups.updateLeader",
            targetType: "groups",
            targetId: String(g._id),
            fieldName: "currentLeaderId",
            oldValue: String(g.currentLeaderId || ""),
            newValue: String(nextLeader?._id || ""),
          });
        } catch {}
      } else if (g.currentLeaderId && String(g.currentLeaderId) === String(m._id)) {
        const nextLeader = await ensureLeader(db, g._id);
        await db.patch(g._id, { currentLeaderId: nextLeader?._id });
        try {
          await writeAuditLog(db, {
            actorId: args.sessionId,
            actionType: "groups.updateLeader",
            targetType: "groups",
            targetId: String(g._id),
            fieldName: "currentLeaderId",
            oldValue: String(g.currentLeaderId || ""),
            newValue: String(nextLeader?._id || ""),
          });
        } catch {}
      }
    }

    let groupId = args.preferredGroupId ?? null;
    let groupDoc = groupId ? await db.get(groupId) : null;

    if (groupDoc) {
      const liveCount = await recountMembers(db, groupDoc._id);
      if (liveCount >= groupDoc.maxMembers) {
        throw new Error(`Kelompok ini sudah penuh (${groupDoc.maxMembers} anggota).`);
      }
    }

    if (!groupDoc) {
      const groups = await db
        .query("groups")
        .withIndex("by_villageId", (q) => q.eq("villageId", args.villageId))
        .collect();
      groups.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      groupDoc = groups.find((g) => g.memberCount < g.maxMembers) || null;

      if (!groupDoc) {
        const name = `Kelompok ${letterFor(groups.length)}`;
        groupId = await db.insert("groups", {
          villageId: args.villageId,
          villageName: args.villageName,
          name,
          memberCount: 0,
          maxMembers,
          currentLeaderId: undefined,
          createdAt: Date.now(),
        });
        groupDoc = await db.get(groupId);
      } else {
        groupId = groupDoc._id;
      }
    }

    if (!groupDoc) throw new Error("Gagal membuat/join kelompok");

    const liveCount = await recountMembers(db, groupDoc._id);
    const isFirst = liveCount === 0;
    const newMemberId = await db.insert("groupMembers", {
      groupId: groupDoc._id,
      sessionId: args.sessionId,
      userName: args.userName,
      isLeader: isFirst,
      permissions: ["write"],
      joinedAt: Date.now(),
    });
    try {
      await writeAuditLog(db, {
        actorId: args.sessionId,
        actionType: "groups.addMember",
        targetType: "groupMembers",
        targetId: String(newMemberId),
        fieldName: "member",
        oldValue: null,
        newValue: { groupId: String(groupDoc._id), sessionId: args.sessionId, isLeader: isFirst },
      });
    } catch {}
    const nextCount = await recountMembers(db, groupDoc._id);
    const leaderId = (() => {
      if (isFirst) return newMemberId;
      if (groupDoc.currentLeaderId) return groupDoc.currentLeaderId;
      return null;
    })();
    const ensuredLeader = leaderId ? null : await ensureLeader(db, groupDoc._id);
    await db.patch(groupDoc._id, {
      memberCount: nextCount,
      currentLeaderId: leaderId ?? ensuredLeader?._id ?? undefined,
    });
    try {
      await writeAuditLog(db, {
        actorId: args.sessionId,
        actionType: "groups.updateMemberCount",
        targetType: "groups",
        targetId: String(groupDoc._id),
        fieldName: "memberCount",
        oldValue: liveCount,
        newValue: nextCount,
      });
    } catch {}
    if (leaderId ?? ensuredLeader?._id) {
      try {
        await writeAuditLog(db, {
          actorId: args.sessionId,
          actionType: "groups.updateLeader",
          targetType: "groups",
          targetId: String(groupDoc._id),
          fieldName: "currentLeaderId",
          oldValue: String(groupDoc.currentLeaderId || ""),
          newValue: String((leaderId ?? ensuredLeader?._id) || ""),
        });
      } catch {}
    }

    return {
      groupId: groupDoc._id,
      groupName: groupDoc.name,
      maxMembers: groupDoc.maxMembers,
      memberCount: nextCount,
    };
  },
});

export const leaveGroup = mutationGeneric({
  args: { sessionId: v.string() },
  handler: async ({ db }, { sessionId }) => {
    const memberships = await db
      .query("groupMembers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const m of memberships) {
      const groupId = m.groupId;
      const wasLeader = m.isLeader;
      await db.delete(m._id);
      try {
        await writeAuditLog(db, {
          actorId: sessionId,
          actionType: "groups.leaveGroup",
          targetType: "groupMembers",
          targetId: String(m._id),
          fieldName: "member",
          oldValue: { groupId: String(groupId), sessionId: m.sessionId, isLeader: wasLeader },
          newValue: null,
        });
      } catch {}

      const g = await db.get(groupId);
      if (!g) continue;
      const prevCount = g.memberCount || 0;
      const nextCount = await recountMembers(db, g._id);
      await db.patch(g._id, { memberCount: nextCount });
      try {
        await writeAuditLog(db, {
          actorId: sessionId,
          actionType: "groups.updateMemberCount",
          targetType: "groups",
          targetId: String(g._id),
          fieldName: "memberCount",
          oldValue: prevCount,
          newValue: nextCount,
        });
      } catch {}

      if (nextCount === 0) {
        await db.delete(g._id);
        const st = await db
          .query("groupStates")
          .withIndex("by_groupId", (q) => q.eq("groupId", g._id))
          .unique();
        if (st) await db.delete(st._id);
        continue;
      }

      if (wasLeader || (g.currentLeaderId && String(g.currentLeaderId) === String(m._id))) {
        const nextLeader = await ensureLeader(db, g._id);
        await db.patch(g._id, { currentLeaderId: nextLeader?._id });
        try {
          await writeAuditLog(db, {
            actorId: sessionId,
            actionType: "groups.updateLeader",
            targetType: "groups",
            targetId: String(g._id),
            fieldName: "currentLeaderId",
            oldValue: String(g.currentLeaderId || ""),
            newValue: String(nextLeader?._id || ""),
          });
        } catch {}
      }
    }
    return true;
  },
});

export const _test = { recountMembers, getLeaderMember, ensureLeader };
