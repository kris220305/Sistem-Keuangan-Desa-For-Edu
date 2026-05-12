import { describe, it, expect } from "vitest";
import { getSaldoTunai } from "@/lib/financial-engine";

describe("mutasi kas", () => {
  it("mengurangi saldo tunai saat setor dan menambah saat ambil", () => {
    const state = {
      saldoAwal: [{ id: "a", kodeRekening: "1.1.1.01", namaRekening: "Kas Tunai", debet: 1000, kredit: 0 }],
      penerimaan: [
        { id: "p1", tanggal: "2026-05-01", noBukti: "P1", jenis: "tunai", uraian: "Tunai", jumlah: 500 },
      ],
      spp: [
        { id: "s1", isFinal: true, jumlah: 200 },
      ],
      pencairan: [
        { id: "c1", sppId: "s1", nomorPencairan: "PC1", tanggal: "2026-05-02", noCek: "CEK", pembayaran: "tunai", jumlah: 200, potongan: 0, netto: 200 },
      ],
      penyetoranPajak: [
        { id: "t1", tanggal: "2026-05-03", noBukti: "T1", kodeRekening: "2.1.1.01", kodeMAP: "411", keterangan: "Pajak", jumlah: 50, ntpn: "", jenis: "tunai", rincianBuktiPotong: [] },
      ],
      belanja: [],
      pembiayaan: [],
      pendapatan: [],
      silpa: [],
      penerimaanPembiayaan: [],
      saldoAwalPembiayaan: [],
      spjPanjar: [],
      sisaPanjar: [],
    } as any;

    const mutasi = [
      { id: "m1", tanggal: "2026-05-04", noBukti: "M1", jenis: "setor", uraian: "Setor", jumlah: 300, rekening: "1.1.1.02", namaBank: "BPD", createdAt: 1 },
      { id: "m2", tanggal: "2026-05-05", noBukti: "M2", jenis: "ambil", uraian: "Ambil", jumlah: 100, rekening: "1.1.1.02", namaBank: "BPD", createdAt: 2 },
    ] as any;

    expect(getSaldoTunai(state, mutasi)).toBe(1050);
  });
});
