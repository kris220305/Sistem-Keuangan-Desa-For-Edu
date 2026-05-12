import { beforeEach, describe, expect, it } from "vitest";
import { loadMutasiKas, saveMutasiKasLocal, MUTASI_KAS_STORAGE_KEY } from "@/data/mutasi-kas";

describe("mutasi kas storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("save/load roundtrip", () => {
    const items: any[] = [
      { id: "m1", tanggal: "2026-05-10", noBukti: "M1", jenis: "setor", uraian: "x", jumlah: 1, rekening: "1", namaBank: "b", createdAt: 1 },
    ];
    saveMutasiKasLocal(items as any);
    expect(loadMutasiKas()).toHaveLength(1);
    expect(loadMutasiKas()[0].id).toBe("m1");
  });

  it("invalid JSON returns []", () => {
    localStorage.setItem(MUTASI_KAS_STORAGE_KEY, "{bad");
    expect(loadMutasiKas()).toEqual([]);
  });

  it("non-array JSON returns []", () => {
    localStorage.setItem(MUTASI_KAS_STORAGE_KEY, JSON.stringify({ hello: 1 }));
    expect(loadMutasiKas()).toEqual([]);
  });
});
