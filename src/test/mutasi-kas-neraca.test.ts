import { beforeEach, describe, expect, it } from "vitest";
import { generateNeraca } from "@/lib/financial-engine";
import { MUTASI_KAS_STORAGE_KEY } from "@/data/mutasi-kas";

describe("mutasi kas → neraca", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mutasi setor memindahkan saldo dari kas tunai ke kas bank", () => {
    localStorage.setItem(MUTASI_KAS_STORAGE_KEY, JSON.stringify([
      { id: "m1", tanggal: "2026-05-10", noBukti: "M1", jenis: "setor", uraian: "Setor", jumlah: 300, rekening: "1.1.1.02", namaBank: "BPD", createdAt: 1 },
    ]));

    const state = {
      pendapatan: [],
      belanja: [],
      pembiayaan: [],
      penerimaan: [],
      silpa: [],
      spp: [],
      pencairan: [],
      penyetoranPajak: [],
      saldoAwal: [
        { id: "a", kodeRekening: "1.1.1.01", namaRekening: "Kas Tunai", debet: 1000, kredit: 0 },
        { id: "b", kodeRekening: "1.1.1.02", namaRekening: "Kas Bank", debet: 0, kredit: 0 },
      ],
      spjPanjar: [],
      sisaPanjar: [],
      jurnalUmum: [],
      kegiatanAnggaran: [],
      __meta: {},
    } as any;

    const neraca = generateNeraca(state);
    const tunai = neraca.find((x: any) => x.kode === "1.1.1.01")?.nilaiTahunIni;
    const bank = neraca.find((x: any) => x.kode === "1.1.1.02")?.nilaiTahunIni;

    expect(tunai).toBe(700);
    expect(bank).toBe(300);
  });

  it("mutasi masuk/keluar tidak mengubah kas bank (bukan transfer)", () => {
    localStorage.setItem(MUTASI_KAS_STORAGE_KEY, JSON.stringify([
      { id: "m1", tanggal: "2026-05-10", noBukti: "TBP-1", jenis: "masuk", uraian: "Penerimaan tunai", jumlah: 100, rekening: "1.1.1.01", namaBank: "Kas Tunai", createdAt: 1 },
    ]));

    const state = {
      pendapatan: [],
      belanja: [],
      pembiayaan: [],
      penerimaan: [],
      silpa: [],
      spp: [],
      pencairan: [],
      penyetoranPajak: [],
      saldoAwal: [
        { id: "a", kodeRekening: "1.1.1.01", namaRekening: "Kas Tunai", debet: 1000, kredit: 0 },
        { id: "b", kodeRekening: "1.1.1.02", namaRekening: "Kas Bank", debet: 0, kredit: 0 },
      ],
      spjPanjar: [],
      sisaPanjar: [],
      jurnalUmum: [],
      kegiatanAnggaran: [],
      __meta: {},
    } as any;

    const neraca = generateNeraca(state);
    const tunai = neraca.find((x: any) => x.kode === "1.1.1.01")?.nilaiTahunIni;
    const bank = neraca.find((x: any) => x.kode === "1.1.1.02")?.nilaiTahunIni;

    expect(tunai).toBe(1000);
    expect(bank).toBe(0);
  });
});
