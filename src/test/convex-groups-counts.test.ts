import { describe, expect, it, vi } from "vitest";
import { _test } from "../../convex/groups";

function makeDb(opts: {
  membersByGroup?: Record<string, Array<any>>;
  leaderByGroup?: Record<string, any | null>;
  firstByGroup?: Record<string, any | null>;
}) {
  const patch = vi.fn(async () => {});
  const query = vi.fn((table: string) => {
    return {
      withIndex: (index: string, fn: any) => {
        const q: any = {
          eq: (field: string, val: any) => {
            if (field === "groupId") q._groupId = val;
            if (field === "isLeader") q._isLeader = val;
            return q;
          },
        };
        fn(q);
        const groupId = q._groupId;
        const isLeader = q._isLeader;

        if (table === "groupMembers" && index === "by_groupId") {
          return {
            collect: async () => (opts.membersByGroup?.[groupId] ?? []),
            take: async () => (opts.membersByGroup?.[groupId] ?? []),
            first: async () => (opts.firstByGroup?.[groupId] ?? null),
          };
        }
        if (table === "groupMembers" && index === "by_groupId_isLeader") {
          return {
            first: async () => {
              if (isLeader !== true) return null;
              return opts.leaderByGroup?.[groupId] ?? null;
            },
          };
        }
        return { collect: async () => [], take: async () => [], first: async () => null };
      },
    };
  });

  return { query, patch } as any;
}

describe("convex/groups helper", () => {
  it("recountMembers menghitung ulang dari jumlah row groupMembers", async () => {
    const db = makeDb({ membersByGroup: { g1: [{}, {}, {}] } });
    await expect(_test.recountMembers(db, "g1")).resolves.toBe(3);
  });

  it("ensureLeader mengembalikan leader yang sudah ada (tanpa patch)", async () => {
    const db = makeDb({ leaderByGroup: { g1: { _id: "m-leader", isLeader: true } } });
    const leader = await _test.ensureLeader(db, "g1");
    expect(leader?._id).toBe("m-leader");
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("ensureLeader mempromosikan member pertama bila leader tidak ada", async () => {
    const db = makeDb({
      leaderByGroup: { g1: null },
      firstByGroup: { g1: { _id: "m1", isLeader: false } },
    });
    const leader = await _test.ensureLeader(db, "g1");
    expect(leader?._id).toBe("m1");
    expect(db.patch).toHaveBeenCalledWith("m1", { isLeader: true });
  });
});
