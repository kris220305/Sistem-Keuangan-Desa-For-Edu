import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";
import { writeAuditLog } from "./_shared/audit";

const CONVEX_DOCUMENT_SAFE_BYTES = 850 * 1024;
const BULK_BATCH_SIZE = 50;

const REPORT_PROGRESS_KEYS = [
  "data_umum",
  "pendapatan",
  "belanja",
  "pembiayaan",
  "penerimaan",
  "penganggaran",
  "spp_definitif",
  "spp_panjar",
  "spp_pembiayaan",
  "pencairan",
  "spj",
  "pajak",
  "saldo_awal",
  "jurnal",
  "mutasi",
] as const;

function getJsonByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function ensureReportWithinLimit(reportData: unknown) {
  const bytes = getJsonByteSize(reportData);
  if (bytes > CONVEX_DOCUMENT_SAFE_BYTES) {
    throw new Error(`Data laporan terlalu besar untuk disimpan (${Math.ceil(bytes / 1024)} KB).`);
  }
}

function hasItems(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function summarizeReportProgress(reportData: unknown) {
  const data = typeof reportData === "object" && reportData !== null
    ? (reportData as Record<string, unknown>)
    : {};
  const progress: Record<string, boolean> = {};
  for (const key of REPORT_PROGRESS_KEYS) progress[key] = Boolean(data[key]);
  progress.pendapatan = hasItems(data.pendapatan);
  progress.belanja = hasItems(data.belanja);
  progress.pembiayaan = hasItems(data.pembiayaan);
  progress.penerimaan = hasItems(data.penerimaan) || hasItems(data.silpa);
  progress.penganggaran = hasItems(data.kegiatanAnggaran);
  progress.spp_definitif = hasItems(data.spp);
  progress.spp_panjar = hasItems(data.spjPanjar) || hasItems(data.sisaPanjar);
  progress.spp_pembiayaan = hasItems(data.spp);
  progress.pencairan = hasItems(data.pencairan);
  progress.spj = hasItems(data.spjPanjar);
  progress.pajak = hasItems(data.penyetoranPajak);
  progress.saldo_awal = hasItems(data.saldoAwal);
  progress.jurnal = hasItems(data.jurnalUmum);
  progress.mutasi = hasItems(data.mutasiKas);
  progress.data_umum = Boolean(data.desaProfile || data.villageProfile || data.namaDesa);
  return progress;
}

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
    ensureReportWithinLimit(args.reportData);
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
        report_data: summarizeReportProgress(r.reportData),
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
    const batch = await db.query("reportSubmissions").take(BULK_BATCH_SIZE);
    for (const r of batch) {
      if (r.pdfStorageId) {
        try { await storage.delete(r.pdfStorageId); } catch {}
      }
      await db.delete(r._id);
      count++;
    }
    const done = batch.length < BULK_BATCH_SIZE;
    try {
      await writeAuditLog(db, {
        actorId: `admin:${(admin as any).tokenHash}`,
        actionType: "reportSubmissions.removeAll",
        targetType: "reportSubmissions",
        targetId: "*",
        fieldName: "deleted",
        oldValue: { count, done },
        newValue: null,
      });
    } catch {}
    return { ok: true, done, deleted: count };
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
  args: { adminToken: v.string(), ids: v.optional(v.array(v.id("reportSubmissions"))) },
  handler: async ({ db, storage }, { adminToken, ids }) => {
    const admin = await assertAdmin(db, adminToken);
    let deleted = 0;
    for (const id of (ids || []).slice(0, BULK_BATCH_SIZE)) {
      const r = await db.get(id);
      if (r?.pdfStorageId) {
        try { await storage.delete(r.pdfStorageId!); } catch {}
        await db.patch(id, { pdfStorageId: undefined, pdfFileName: undefined });
        deleted++;
      }
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
    return { ok: true, deleted };
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
