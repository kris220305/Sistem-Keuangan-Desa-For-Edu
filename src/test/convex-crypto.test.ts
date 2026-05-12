import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "../../convex/_shared/crypto";

describe("convex crypto", () => {
  it("encrypt/decrypt roundtrip (hex key)", () => {
    const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const payload = { a: 1, b: "x" };
    const enc = encryptJson(payload, keyHex);
    const dec = decryptJson(enc, keyHex);
    expect(dec).toEqual(payload);
  });
});

