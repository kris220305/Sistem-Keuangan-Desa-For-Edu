import { describe, expect, it } from "vitest";
import { _test } from "../../convex/groupStates";

function makeDb(member: unknown) {
  return {
    query: (_table: string) => ({
      withIndex: (_index: string, _fn: unknown) => ({
        first: async () => member,
      }),
    }),
  } as any;
}

describe("convex/groupStates permissions", () => {
  it("mengizinkan upsert/merge bila member ada dan punya write", async () => {
    const db = makeDb({ isLeader: false, permissions: ["write"] });
    await expect(_test.assertCanWriteGroupState(db, "g1", "s1")).resolves.toBeUndefined();
  });

  it("mengizinkan upsert/merge bila member ada tapi permissions belum ada (backward-compatible)", async () => {
    const db = makeDb({ isLeader: false });
    await expect(_test.assertCanWriteGroupState(db, "g1", "s1")).resolves.toBeUndefined();
  });

  it("menolak upsert/merge bila bukan member", async () => {
    const db = makeDb(null);
    await expect(_test.assertCanWriteGroupState(db, "g1", "s1")).rejects.toThrow("Insufficient permissions");
  });

  it("menolak upsert/merge bila permissions tidak mengandung write", async () => {
    const db = makeDb({ isLeader: false, permissions: ["read"] });
    await expect(_test.assertCanWriteGroupState(db, "g1", "s1")).rejects.toThrow("Insufficient permissions");
  });

  it("mengizinkan clear bila leader", async () => {
    const db = makeDb({ isLeader: true, permissions: ["write"] });
    await expect(_test.assertIsLeader(db, "g1", "s1")).resolves.toBeUndefined();
  });

  it("menolak clear bila bukan leader", async () => {
    const db = makeDb({ isLeader: false, permissions: ["write"] });
    await expect(_test.assertIsLeader(db, "g1", "s1")).rejects.toThrow("Insufficient permissions");
  });
});

