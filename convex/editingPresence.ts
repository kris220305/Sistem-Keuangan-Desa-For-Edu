import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

/**
 * Lightweight editing presence — tracks which user is editing which module.
 * 
 * This is ephemeral data (auto-expires after 30s of inactivity).
 * Used to show "Krisna sedang mengedit Belanja" indicators.
 * 
 * Design choices for Convex Free optimization:
 * - Uses userSessions table (no new table needed)
 * - Stores editing info as a field on the session
 * - Queries are indexed and limited
 * - Heartbeat-based: if user stops sending heartbeats, they're considered idle
 */

// We store presence in a lightweight in-memory approach using groupMembers
// Since we can't add fields to groupMembers easily, we use a dedicated query
// that reads from a virtual "presence" concept stored in the session.

export const setEditing = mutationGeneric({
  args: {
    sessionId: v.string(),
    groupId: v.id("groups"),
    module: v.string(), // e.g. "pendapatan", "belanja", "jurnal", etc.
  },
  handler: async ({ db }, { sessionId, groupId, module }) => {
    const session = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!session) return false;
    // Store editing presence as part of formProgress (reuse existing field)
    const progress = (session.formProgress || {}) as Record<string, unknown>;
    await db.patch(session._id, {
      formProgress: {
        ...progress,
        __editing_module: module,
        __editing_at: Date.now(),
      },
    });
    return true;
  },
});

export const clearEditing = mutationGeneric({
  args: { sessionId: v.string() },
  handler: async ({ db }, { sessionId }) => {
    const session = await db
      .query("userSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!session) return false;
    const progress = (session.formProgress || {}) as Record<string, unknown>;
    const { __editing_module: _, __editing_at: __, ...rest } = progress;
    await db.patch(session._id, { formProgress: rest });
    return true;
  },
});

export const getGroupPresence = queryGeneric({
  args: { groupId: v.id("groups") },
  handler: async ({ db }, { groupId }) => {
    // Get all members of this group
    const members = await db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .take(50);

    const now = Date.now();
    const STALE_MS = 30_000; // 30 seconds

    const presence: Array<{
      sessionId: string;
      userName: string;
      module: string;
      editingAt: number;
    }> = [];

    for (const m of members) {
      const session = await db
        .query("userSessions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", m.sessionId))
        .unique();
      if (!session) continue;
      const progress = (session.formProgress || {}) as Record<string, unknown>;
      const editModule = progress.__editing_module as string | undefined;
      const editAt = progress.__editing_at as number | undefined;
      if (editModule && editAt && (now - editAt) < STALE_MS) {
        presence.push({
          sessionId: m.sessionId,
          userName: m.userName,
          module: editModule,
          editingAt: editAt,
        });
      }
    }

    return presence;
  },
});
