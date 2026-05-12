import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { AnggaranSchema } from "./validators/AnggaranSchema";

export default defineSchema({
  groups: defineTable({
    villageId: v.string(),
    villageName: v.string(),
    name: v.string(),
    memberCount: v.number(),
    maxMembers: v.number(),
    currentLeaderId: v.optional(v.id("groupMembers")),
    createdAt: v.number(),
  }).index("by_villageId", ["villageId"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    sessionId: v.string(),
    userName: v.string(),
    isLeader: v.boolean(),
    permissions: v.optional(v.array(v.union(v.literal("read"), v.literal("write")))),
    joinedAt: v.number(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_groupId_isLeader", ["groupId", "isLeader"])
    .index("by_groupId_session", ["groupId", "sessionId"])
    .index("by_sessionId", ["sessionId"]),

  groupStates: defineTable({
    groupId: v.id("groups"),
    state: AnggaranSchema,
    updatedAt: v.number(),
    lastSessionId: v.string(),
  }).index("by_groupId", ["groupId"]),

  adminSessions: defineTable({
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

  auditLog: defineTable({
    actorId: v.string(),
    actionType: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    fieldName: v.string(),
    oldValue: v.string(),
    newValue: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_target", ["targetType", "targetId"]),

  cronRuns: defineTable({
    jobName: v.string(),
    ranAt: v.number(),
    ok: v.boolean(),
    deletedCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_jobName_ranAt", ["jobName", "ranAt"]),

  impersonationBackups: defineTable({
    adminTokenHash: v.string(),
    iv: v.string(),
    tag: v.string(),
    ciphertext: v.string(),
    updatedAt: v.number(),
  }).index("by_adminTokenHash", ["adminTokenHash"]),

  impersonationHistory: defineTable({
    adminTokenHash: v.string(),
    targetSessionId: v.string(),
    actionType: v.string(),
    iv: v.string(),
    tag: v.string(),
    ciphertext: v.string(),
    createdAt: v.number(),
  })
    .index("by_adminTokenHash_createdAt", ["adminTokenHash", "createdAt"])
    .index("by_targetSessionId_createdAt", ["targetSessionId", "createdAt"]),

  userSessions: defineTable({
    sessionId: v.string(),
    userName: v.string(),
    villageId: v.string(),
    villageName: v.string(),
    workMode: v.string(),
    groupId: v.optional(v.id("groups")),
    lastActive: v.number(),
    createdAt: v.number(),
    formProgress: v.any(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_lastActive", ["lastActive"]),
});
