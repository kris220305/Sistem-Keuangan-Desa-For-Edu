import { describe, expect, it } from "vitest";
import { _test } from "../../convex/sessions";

describe("convex/sessions pagination", () => {
  it("default limit 50", () => {
    expect(_test.normalizeLimit(undefined)).toBe(50);
  });

  it("membatasi limit maksimal 50", () => {
    expect(() => _test.normalizeLimit(51)).toThrow("Limit maksimal 50");
  });

  it("memaksa minimal 1", () => {
    expect(_test.normalizeLimit(0)).toBe(1);
    expect(_test.normalizeLimit(-5)).toBe(1);
  });

  it("cutoff cleanup adalah 7 hari", () => {
    const now = 10_000_000;
    expect(_test.cleanupCutoffMs(now)).toBe(now - 7 * 24 * 60 * 60 * 1000);
  });
});
