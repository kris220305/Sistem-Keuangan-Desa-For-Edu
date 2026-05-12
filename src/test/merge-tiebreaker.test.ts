import { describe, expect, it } from "vitest";
import { _test as groupStateTest } from "../../convex/groupStates";

describe("merge tiebreaker", () => {
  it("memilih remote jika v lebih besar", () => {
    const local = { a: { v: 1, t: 1, by: "s1" } };
    const remote = { a: { v: 2, t: 0, by: "s0" } };
    expect(groupStateTest.mergeMetaWinner(local as any, remote as any, "a")).toBe("remote");
  });

  it("memilih remote jika v sama dan t lebih besar", () => {
    const local = { a: { v: 2, t: 10, by: "s1" } };
    const remote = { a: { v: 2, t: 11, by: "s0" } };
    expect(groupStateTest.mergeMetaWinner(local as any, remote as any, "a")).toBe("remote");
  });

  it("memilih pemenang deterministik saat v dan t sama (by.localeCompare)", () => {
    const local = { a: { v: 2, t: 10, by: "b" } };
    const remote = { a: { v: 2, t: 10, by: "a" } };
    expect(groupStateTest.mergeMetaWinner(local as any, remote as any, "a")).toBe("local");
    const remote2 = { a: { v: 2, t: 10, by: "c" } };
    expect(groupStateTest.mergeMetaWinner(local as any, remote2 as any, "a")).toBe("remote");
  });
});

