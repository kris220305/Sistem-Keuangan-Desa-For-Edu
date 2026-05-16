import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

async function assertIsLeader(db: any, groupId: any, sessionId: string) {
  const member = await db
    .query("groupMembers")
    .withIndex("by_groupId_session", (q: any) => q.eq("groupId", groupId).eq("sessionId", sessionId))
    .first();
  if (!member || !(member as any).isLeader) throw new Error("Insufficient permissions");
}

export const submit = mutationGeneric({
  args: {
    sessionId: v.string(),
    groupId: v.optional(v.id("groups")),
    submittedBy: v.string(),
    villageId: v.string(),
    villageName: v.string(),
    reportData: v.any(),
  },
  handler: async ({ db }, args) => {
    if (!args.groupId) throw new Error("Group tidak ditemukan");
    await assertIsLeader(db, args.groupId, args.sessionId);
    const id = await db.insert("reportSubmissions", {
      groupId: args.groupId,
      sessionId: args.sessionId,
      submittedBy: args.submittedBy,
      villageId: args.villageId,
      villageName: args.villageName,
      reportData: args.reportData,
      createdAt: Date.now(),
    });
    try {
      await writeAuditLog(db, {
        actorId: args.sessionId,
        actionType: "reportSubmissions.submit",
        targetType: "reportSubmissions",
        targetId: String(id),
        fieldName: "report",
        oldValue: null,
        newValue: { groupId: String(args.groupId), villageId: args.villageId },
      });
    } catch {}
    return { id };
  },
});

export const listAll = queryGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db, storage }, { adminToken }) => {
    await assertAdmin(db, adminToken);
    const rows = await db.query("reportSubmissions").withIndex("by_createdAt").order("desc").take(500);
    const out: any[] = [];
    for (const r of rows) {
      const pdfUrl = r.pdfStorageId ? await storage.getUrl(r.pdfStorageId) : null;
      out.push({
        id: r._id,
        group_id: r.groupId,
        session_id: r.sessionId,
        submitted_by: r.submittedBy,
        village_id: r.villageId,
        village_name: r.villageName,
        report_data: r.reportData,
        pdf_url: pdfUrl,
        pdf_file_name: r.pdfFileName || null,
        created_at: new Date(r.createdAt).toISOString(),
      });
    }
    return out;
  },
});

export const remove = mutationGeneric({
  args: { adminToken: v.string(), id: v.id("reportSubmissions") },
  handler: async ({ db, storage }, { adminToken, id }) => {
    const admin = await assertAdmin(db, adminToken);
    const row = await db.get(id);
    if (!row) return true;
    if (row.pdfStorageId) {
      try { await storage.delete(row.pdfStorageId); } catch {}
    }
    await db.delete(id);
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "reportSubmissions.remove",
        targetType: "reportSubmissions",
        targetId: String(id),
        fieldName: "deleted",
        oldValue: { villageId: row.villageId, groupId: String(row.groupId || "") },
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const removeAll = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db, storage }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);
    let count = 0;
    for (let i = 0; i < 10; i++) {
      const batch = await db.query("reportSubmissions").take(200);
      if (!batch.length) break;
      for (const r of batch) {
        if (r.pdfStorageId) {
          try { await storage.delete(r.pdfStorageId); } catch {}
        }
        await db.delete(r._id);
        count++;
      }
    }
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "reportSubmissions.removeAll",
        targetType: "reportSubmissions",
        targetId: "*",
        fieldName: "deleted",
        oldValue: { count },
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const deletePdf = mutationGeneric({
  args: { adminToken: v.string(), id: v.id("reportSubmissions") },
  handler: async ({ db, storage }, { adminToken, id }) => {
    const admin = await assertAdmin(db, adminToken);
    const row = await db.get(id);
    if (!row) return true;
    if (row.pdfStorageId) {
      try { await storage.delete(row.pdfStorageId); } catch {}
    }
    await db.patch(id, { pdfStorageId: undefined, pdfFileName: undefined });
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "reportSubmissions.deletePdf",
        targetType: "reportSubmissions",
        targetId: String(id),
        fieldName: "pdf",
        oldValue: { pdfStorageId: String(row.pdfStorageId || ""), pdfFileName: row.pdfFileName || null },
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const deleteAllPdfs = mutationGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db, storage }, { adminToken }) => {
    const admin = await assertAdmin(db, adminToken);
    let deleted = 0;
    for (let i = 0; i < 10; i++) {
      // Only fetch rows that have a pdfStorageId
      const batch = await db.query("reportSubmissions").take(200);
      if (!batch.length) break;
      const withPdf = batch.filter((r) => !!r.pdfStorageId);
      if (!withPdf.length) break;
      for (const r of withPdf) {
        try { await storage.delete(r.pdfStorageId!); } catch {}
        await db.patch(r._id, { pdfStorageId: undefined, pdfFileName: undefined });
        deleted++;
      }
      if (batch.length < 200) break;
    }
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "reportSubmissions.deleteAllPdfs",
        targetType: "reportSubmissions",
        targetId: "*",
        fieldName: "pdf",
        oldValue: { count: deleted },
        newValue: null,
      });
    } catch {}
    return true;
  },
});

export const generateUploadUrl = mutationGeneric({
  args: { sessionId: v.string(), reportId: v.id("reportSubmissions") },
  handler: async ({ db, storage }, { sessionId, reportId }) => {
    const row = await db.get(reportId);
    if (!row) throw new Error("Report tidak ditemukan");
    if (row.sessionId !== sessionId) throw new Error("Insufficient permissions");
    const url = await storage.generateUploadUrl();
    return { uploadUrl: url };
  },
});

export const attachPdf = mutationGeneric({
  args: {
    sessionId: v.string(),
    reportId: v.id("reportSubmissions"),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  handler: async ({ db }, { sessionId, reportId, storageId, fileName }) => {
    const row = await db.get(reportId);
    if (!row) throw new Error("Report tidak ditemukan");
    if (row.sessionId !== sessionId) throw new Error("Insufficient permissions");
    await db.patch(reportId, { pdfStorageId: storageId, pdfFileName: fileName || undefined });
    return true;
  },
});
