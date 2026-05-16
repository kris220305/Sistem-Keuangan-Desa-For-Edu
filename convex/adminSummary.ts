import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertAdmin } from "./_shared/adminAuth";

/**
 * Lightweight admin summary queries — returns counts and aggregates
 * without fetching full documents. Reduces bandwidth for admin dashboard.
 */

export const getCounts = queryGeneric({
  args: { adminToken: v.string() },
  handler: async ({ db }, { adminToken }) => {
    await assertAdmin(db, adminToken);
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;

    // Count active sessions (last 5 min)
    const activeSessions = await db
      .query("userSessions")
      .withIndex("by_lastActive", (q) => q.gt("lastActive", fiveMinAgo))
      .take(500);

    // Count total sessions (recent 7 days)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const totalSessions = await db
      .query("userSessions")
      .withIndex("by_lastActive", (q) => q.gt("lastActive", sevenDaysAgo))
      .take(500);

    // Count groups
    const groups = await db.query("groups").take(200);

    // Count reports
    const reports = await db.query("reportSubmissions").take(500);

    // Count reports with PDFs
    const reportsWithPdf = reports.filter((r) => !!r.pdfStorageId);

    return {
      activeCount: activeSessions.length,
      totalCount: totalSessions.length,
      groupCount: groups.length,
      reportCount: reports.length,
      pdfCount: reportsWithPdf.length,
      // Per-village breakdown
      villageBreakdown: (() => {
        const map = new Map<string, { name: string; count: number; active: number }>();
        for (const s of totalSessions) {
          const vid = s.villageId || "unknown";
          const existing = map.get(vid) || { name: s.villageName || "—", count: 0, active: 0 };
          existing.count++;
          if (s.lastActive > fiveMinAgo) existing.active++;
          map.set(vid, existing);
        }
        return Array.from(map.entries()).map(([id, v]) => ({
          villageId: id,
          villageName: v.name,
          totalUsers: v.count,
          activeUsers: v.active,
        }));
      })(),
    };
  },
});
