import { describe, expect, it } from "vitest";
import { buildBKU } from "@/lib/bku-engine";

function makeState(partial: any = {}) {
  return {
    saldoAwal: [],
    silpa: [],
    penerimaan: [],
    spp: [],
    pencairan: [],
    ...partial,
  } as any;
}

describe("bku-engine", () => {
  it("membuat baris saldo sebelumnya (saldo awal nol)", () => {
    const state = makeState();
    const res = buildBKU(state, "utama", { tahunAnggaran: 2024 });
    expect(res.rows[0].uraian).toBe("Saldo Sebelumnya");
    expect(res.rows[0].tanggal).toBe("2024-01-01");
    expect(res.rows[0].saldo).toBe(0);
    expect(res.saldoAkhir).toBe(0);
  });

  it("memisahkan penerimaan tunai vs bank untuk BKU tunai/bank", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024-02-01", noBukti: "TBP1", uraian: "Tunai", jumlah: 10, kodeRekening: "4.1.1.01", namaRekening: "PAD", rincian: [] },
        { id: "p2", jenis: "bank", tanggal: "2024-02-02", noBukti: "TBP2", uraian: "Bank", jumlah: 20, kodeRekening: "4.2.1.01", namaRekening: "DDS", rincian: [] },
      ],
    });
    const utama = buildBKU(state, "utama", { tahunAnggaran: 2024 });
    const tunai = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    const bank = buildBKU(state, "bank", { tahunAnggaran: 2024 });

    expect(utama.saldoAkhir).toBe(30);
    expect(tunai.saldoAkhir).toBe(10);
    expect(bank.saldoAkhir).toBe(20);
  });

  it("menandai saldo minus pada pengeluaran", () => {
    const state = makeState({
      spp: [{ id: "spp1", uraian: "Belanja", rincian: [{ id: "r1", kodeRekening: "5.2.2.01", nilai: 5 }], buktiTransaksi: [] }],
      pencairan: [{ id: "pc1", sppId: "spp1", tanggal: "2024-02-03", nomorPencairan: "PC1", jumlah: 5, pembayaran: "bank", netto: 5 }],
    });
    const res = buildBKU(state, "bank", { tahunAnggaran: 2024 });
    const row = res.rows.find((r) => r.noBukti === "PC1");
    expect(row?.saldo).toBe(-5);
    expect(res.negativeRows.length).toBeGreaterThan(0);
    expect(res.negativeRows).toContain(row?.no);
    expect(row?.flags).toContain("saldo_minus");
  });

  it("mutasi setor/ambil: utama netto 0, tunai & bank mempengaruhi saldo", () => {
    const state = makeState({
      saldoAwal: [{ kodeRekening: "1.1.1.01", debet: 150, kredit: 0 }],
    });
    const mutasi = [{ id: "m1", tanggal: "2024-03-01", noBukti: "M1", jenis: "setor", uraian: "Setor", jumlah: 100 }];
    const utama = buildBKU(state, "utama", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    const tunai = buildBKU(state, "tunai", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    const bank = buildBKU(state, "bank", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });

    expect(utama.saldoAkhir).toBe(150);
    expect(tunai.saldoAkhir).toBe(50);
    expect(bank.saldoAkhir).toBe(100);

    const rowUtama = utama.rows.find((r) => r.noBukti === "M1");
    expect(rowUtama?.penerimaan).toBe(100);
    expect(rowUtama?.pengeluaran).toBe(100);
  });

  it("menyesuaikan tahun otomatis berdasarkan data transaksi", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2023-12-31", noBukti: "OLD", uraian: "Backdated", jumlah: 10, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const res = buildBKU(state, "utama", { tahunAnggaran: 2024 });
    expect(res.tahunUsed).toBe(2023);
    expect(res.rows.some((r) => r.noBukti === "OLD")).toBe(true);
  });

  it("filter periode menghitung saldo awal periode dari transaksi sebelum start", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024-01-15", noBukti: "A", uraian: "A", jumlah: 10, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
        { id: "p2", jenis: "tunai", tanggal: "2024-04-01", noBukti: "B", uraian: "B", jumlah: 5, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024, start: "2024-03-01", end: "2024-12-31" });
    expect(res.rows[0].saldo).toBe(10);
    expect(res.rows.some((r) => r.noBukti === "A")).toBe(false);
    expect(res.rows.some((r) => r.noBukti === "B")).toBe(true);
    expect(res.saldoAkhir).toBe(15);
  });

  it("mengabaikan transaksi dengan nilai negatif (invalid)", () => {
    const state = makeState();
    const mutasi = [{ id: "m1", tanggal: "2024-03-01", noBukti: "NEG", jenis: "ambil", uraian: "Neg", jumlah: -10 }];
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.rows.some((r) => r.noBukti === "NEG")).toBe(false);
  });

  it("mengurutkan transaksi kronologis", () => {
    const state = makeState({
      penerimaan: [
        { id: "p2", jenis: "tunai", tanggal: "2024-05-02", noBukti: "B", uraian: "B", jumlah: 2, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
        { id: "p1", jenis: "tunai", tanggal: "2024-05-01", noBukti: "A", uraian: "A", jumlah: 1, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    const bukti = res.rows.filter((r) => r.noBukti).map((r) => r.noBukti);
    expect(bukti).toEqual(["A", "B"]);
  });

  it("tidak menduplikasi mutasi tunai masuk yang mereferensikan penerimaan", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024-02-01", noBukti: "TBP1", uraian: "Tunai", jumlah: 10, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const mutasi = [{ id: "m1", tanggal: "2024-02-01", noBukti: "M1", jenis: "masuk", uraian: "Masuk", jumlah: 10, sumberPenerimaanIds: ["p1"] }];
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    expect(res.rows.some((r) => r.noBukti === "M1")).toBe(false);
    expect(res.rows.some((r) => r.noBukti === "TBP1")).toBe(true);
  });

  it("SiLPA (diproses) menambah opening balance BKU bank dan utama", () => {
    const state = makeState({
      saldoAwal: [{ kodeRekening: "1.1.1.02", debet: 0, kredit: 0 }],
      silpa: [{ id: "s1", tanggal: "2024-01-01", nomorBukti: "SILPA", uraian: "SILPA", isProses: true, rincian: [{ id: "r1", kodeRekening: "1.1.1.02", namaRekening: "Kas Bank", debet: 50, kredit: 0 }] }],
    });
    const bank = buildBKU(state, "bank", { tahunAnggaran: 2024 });
    const tunai = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    const utama = buildBKU(state, "utama", { tahunAnggaran: 2024 });
    expect(bank.rows[0].saldo).toBe(50);
    expect(tunai.rows[0].saldo).toBe(0);
    expect(utama.rows[0].saldo).toBe(50);
  });

  it("jika tahun anggaran prefer tidak sesuai, laporan tetap mengikuti tahun transaksi terbanyak", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024-01-01", noBukti: "A", uraian: "A", jumlah: 1, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
        { id: "p2", jenis: "tunai", tanggal: "2024-02-01", noBukti: "B", uraian: "B", jumlah: 1, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2026 });
    expect(res.tahunUsed).toBe(2024);
    expect(res.rows.some((r) => r.noBukti === "A")).toBe(true);
  });

  it("mengabaikan tanggal invalid dengan warning", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024/01/01", noBukti: "BAD", uraian: "Bad", jumlah: 10, kodeRekening: "4.1.1.01", namaRekening: "", rincian: [] },
      ],
    });
    const res = buildBKU(state, "utama", { tahunAnggaran: 2024 });
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.rows.some((r) => r.noBukti === "BAD")).toBe(false);
  });

  it("mengambil kode rekening dari rincian penerimaan jika ada", () => {
    const state = makeState({
      penerimaan: [
        { id: "p1", jenis: "tunai", tanggal: "2024-02-01", noBukti: "TBP1", uraian: "Tunai", jumlah: 10, kodeRekening: "", namaRekening: "", rincian: [{ id: "r1", kodeRekening: "4.9.9.99", namaRekening: "X", sumberDana: "PAD", nilai: 10 }] },
      ],
    });
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    const row = res.rows.find((r) => r.noBukti === "TBP1");
    expect(row?.kodeRekening).toBe("4.9.9.99");
  });

  it("potongan pajak mengikuti jenis pembayaran dan masuk ke ledger yang sesuai", () => {
    const state = makeState({
      spp: [{
        id: "spp1",
        uraian: "Belanja",
        rincian: [{ id: "r1", kodeRekening: "5.2.2.01", nilai: 100 }],
        buktiTransaksi: [{ id: "bt1", noBukti: "KW1", potonganPajak: [{ id: "pp1", kodeRekening: "7.1.1.01", namaRekening: "PPh", nilai: 5 }] }],
      }],
      pencairan: [{ id: "pc1", sppId: "spp1", tanggal: "2024-02-03", nomorPencairan: "PC1", jumlah: 100, pembayaran: "tunai", netto: 100 }],
    });
    const tunai = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    const bank = buildBKU(state, "bank", { tahunAnggaran: 2024 });
    expect(tunai.rows.some((r) => r.noBukti === "KW1" && r.kodeRekening === "7.1.1.01")).toBe(true);
    expect(bank.rows.some((r) => r.noBukti === "KW1")).toBe(false);
  });

  it("mutasi masuk/keluar tanpa sumber masuk ke BKU tunai (dan utama) tapi bukan bank", () => {
    const state = makeState();
    const mutasi = [
      { id: "m1", tanggal: "2024-02-01", noBukti: "M-IN", jenis: "masuk", uraian: "Masuk", jumlah: 10 },
      { id: "m2", tanggal: "2024-02-02", noBukti: "M-OUT", jenis: "keluar", uraian: "Keluar", jumlah: 3 },
    ];
    const tunai = buildBKU(state, "tunai", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    const utama = buildBKU(state, "utama", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    const bank = buildBKU(state, "bank", { tahunAnggaran: 2024 }, { mutasiKas: mutasi as any });
    expect(tunai.rows.some((r) => r.noBukti === "M-IN")).toBe(true);
    expect(utama.rows.some((r) => r.noBukti === "M-OUT")).toBe(true);
    expect(bank.rows.some((r) => r.noBukti === "M-IN")).toBe(false);
  });

  it("saldo awal menghitung debet-kredit", () => {
    const state = makeState({
      saldoAwal: [{ kodeRekening: "1.1.1.01", debet: 100, kredit: 30 }],
    });
    const res = buildBKU(state, "tunai", { tahunAnggaran: 2024 });
    expect(res.rows[0].saldo).toBe(70);
  });
});
