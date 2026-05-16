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

  // Chunked group state — stores state per category per group.
  // This reduces sync payload size: only the changed category is written/read.
  // Categories: pendapatan, belanja, pembiayaan, penerimaan, silpa, spp,
  //   pencairan, penyetoranPajak, saldoAwal, spjPanjar, sisaPanjar, jurnalUmum, kegiatanAnggaran
  groupStateChunks: defineTable({
    groupId: v.id("groups"),
    category: v.string(),
    data: v.any(), // array of entities for this category
    meta: v.optional(v.any()), // __meta entries for this category
    updatedAt: v.number(),
    lastSessionId: v.string(),
  })
    .index("by_groupId_category", ["groupId", "category"])
    .index("by_groupId", ["groupId"]),

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
    formData: v.optional(v.any()),
    latestScreenshotStorageId: v.optional(v.id("_storage")),
    latestScreenshotUpdatedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_lastActive", ["lastActive"])
    .index("by_groupId", ["groupId"])
    .index("by_villageId", ["villageId"]),

  siteSettings: defineTable({
    key: v.string(),
    isLocked: v.boolean(),
    maxUsers: v.number(),
    demoSeedVersion: v.optional(v.number()),
    wipeAllVersion: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  villageGroupLimits: defineTable({
    villageId: v.string(),
    villageName: v.string(),
    minMembers: v.number(),
    maxMembers: v.number(),
    updatedAt: v.number(),
  }).index("by_villageId", ["villageId"]),

  reportSubmissions: defineTable({
    groupId: v.optional(v.id("groups")),
    sessionId: v.string(),
    submittedBy: v.string(),
    villageId: v.string(),
    villageName: v.string(),
    reportData: v.any(),
    pdfStorageId: v.optional(v.id("_storage")),
    pdfFileName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_villageId_createdAt", ["villageId", "createdAt"])
    .index("by_groupId_createdAt", ["groupId", "createdAt"]),
});
