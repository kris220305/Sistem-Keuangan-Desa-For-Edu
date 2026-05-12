import { describe, expect, it } from "vitest";
import { auditUtils } from "../../convex/_shared/audit";

describe("convex audit utils", () => {
  it("safeStringify membatasi panjang", () => {
    const s = auditUtils.safeStringify({ a: "x".repeat(100) }, 20);
    expect(s.length).toBeLessThanOrEqual(20);
  });

  it("hashJson deterministik", () => {
    const h1 = auditUtils.hashJson({ a: 1, b: [2, 3] });
    const h2 = auditUtils.hashJson({ a: 1, b: [2, 3] });
    expect(h1).toBe(h2);
  });
});

