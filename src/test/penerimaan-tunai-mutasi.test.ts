import { beforeEach, describe, expect, it } from "vitest";
import { applyAutoMutasiForPenerimaanTunai, buildMutasiTunaiMasukFromPenerimaan } from "@/lib/penerimaan-tunai-mutasi";
import { MUTASI_KAS_AUDIT_STORAGE_KEY, appendMutasiKasAudit, loadMutasiKasAudit } from "@/data/mutasi-kas-audit";

describe("penerimaan tunai → auto mutasi kas", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("membuat mutasi masuk dari penerimaan tunai", () => {
    const now = 123;
    const p = { id: "p1", tanggal: "2026-05-10", noBukti: "TBP-1", uraian: "Retribusi", jumlah: 100, rekening: "1.1.1.02", namaBank: "BPD" } as any;
    const actor = { sessionId: "s1", name: "U1" };
    const m = buildMutasiTunaiMasukFromPenerimaan(p, actor, now);
    expect(m.jenis).toBe("masuk");
    expect(m.jumlah).toBe(100);
    expect(m.sumberPenerimaanIds).toEqual(["p1"]);
    expect(m.createdAt).toBe(now);
    expect(m.createdBySessionId).toBe("s1");
  });

  it("fallback id dan uraian saat data minim", () => {
    const now = 999;
    const p = { id: "p2", tanggal: "2026-05-10", noBukti: "TBP-2", uraian: "", jumlah: 10 } as any;
    const actor = { sessionId: "s1", name: "U1" };
    const orig = (crypto as any).randomUUID;
    try {
      (crypto as any).randomUUID = undefined;
      const m = buildMutasiTunaiMasukFromPenerimaan(p, actor, now);
      expect(m.id).toBe(String(now));
      expect(m.uraian).toBe("Penerimaan tunai");
    } finally {
      (crypto as any).randomUUID = orig;
    }
  });

  it("tidak menggandakan mutasi untuk penerimaan yang sama", () => {
    const now = 123;
    const p = { id: "p1", tanggal: "2026-05-10", noBukti: "TBP-1", uraian: "Retribusi", jumlah: 100, rekening: "", namaBank: "" } as any;
    const actor = { sessionId: "s1", name: "U1" };
    const r1 = applyAutoMutasiForPenerimaanTunai([], p, actor, now);
    expect(r1.mutasiKas).toHaveLength(1);
    const r2 = applyAutoMutasiForPenerimaanTunai(r1.mutasiKas, p, actor, now + 1);
    expect(r2.mutasiKas).toHaveLength(1);
    expect(r2.created).toBeNull();
  });

  it("jumlah undefined menjadi 0", () => {
    const now = 123;
    const p = { id: "p3", tanggal: "2026-05-10", noBukti: "TBP-3", uraian: "X" } as any;
    const actor = { sessionId: "s1", name: "U1" };
    const m = buildMutasiTunaiMasukFromPenerimaan(p, actor, now);
    expect(m.jumlah).toBe(0);
  });

  it("audit trail tersimpan di localStorage", () => {
    appendMutasiKasAudit({ id: "a1", at: 1, action: "create", mutasiId: "m1", bySessionId: "s1", byName: "U1" });
    const raw = localStorage.getItem(MUTASI_KAS_AUDIT_STORAGE_KEY);
    expect(raw).toContain("m1");
    expect(loadMutasiKasAudit()).toHaveLength(1);
  });

  it("audit invalid JSON returns []", () => {
    localStorage.setItem(MUTASI_KAS_AUDIT_STORAGE_KEY, "{bad");
    expect(loadMutasiKasAudit()).toEqual([]);
  });

  it("audit non-array JSON returns []", () => {
    localStorage.setItem(MUTASI_KAS_AUDIT_STORAGE_KEY, JSON.stringify({ hello: 1 }));
    expect(loadMutasiKasAudit()).toEqual([]);
  });
});
