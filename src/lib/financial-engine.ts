/**
 * Financial Calculation Engine for SISKEUDES
 * Implements double-entry accounting logic per BPKP documentation
 * "Input Sekali, Output Banyak" principle
 */

import { loadState, type AppState, type PendapatanItem, type BelanjaItem, type PembiayaanItem, type PenerimaanItem, type SPPItem, type PencairanSPP, type SaldoAwalItem, type SilpaItem } from "@/data/app-state";
import { rekeningData } from "@/data/rekening-data";
import { loadMutasiKas } from "@/data/mutasi-kas";

export function getEffectivePencairan(state: AppState): PencairanSPP[] {
  const existing = (state.pencairan || []).filter((p) => !!state.spp.find((s) => s.id === p.sppId));
  const bySpp = new Map<string, PencairanSPP[]>();
  for (const p of existing) {
    const arr = bySpp.get(p.sppId) || [];
    arr.push(p);
    bySpp.set(p.sppId, arr);
  }
  const out: PencairanSPP[] = [...existing];
  for (const spp of state.spp) {
    if (!spp.isFinal) continue;
    const already = bySpp.get(spp.id);
    if (already && already.length > 0) continue;
    out.push({
      id: `auto-${spp.id}`,
      sppId: spp.id,
      nomorPencairan: `AUTO/${spp.nomorSPP || spp.id}`,
      tanggal: spp.tanggalSPP || new Date().toISOString().slice(0, 10),
      noCek: `AUTO/${spp.nomorSPP || spp.id}`,
      pembayaran: spp.pembayaran || "bank",
      jumlah: spp.jumlah || 0,
      potongan: 0,
      netto: spp.jumlah || 0,
    });
  }
  return out;
}

export function getSaldoTunai(state: AppState, mutasiKas?: Array<{ jenis: string; jumlah: number }>): number {
  const mutasi = mutasiKas || (() => {
    try { return loadMutasiKas(); } catch { return []; }
  })();
  const saldoAwalTunai = (state.saldoAwal || [])
    .filter((s) => s.kodeRekening === "1.1.1.01")
    .reduce((sum, s) => sum + (s.debet || 0) - (s.kredit || 0), 0);
  const penerimaanTunai = (state.penerimaan || [])
    .filter((p) => p.jenis === "tunai")
    .reduce((sum, p) => sum + (p.jumlah || 0), 0);
  const pengeluaranTunai = getEffectivePencairan(state)
    .filter((p) => p.pembayaran === "tunai")
    .reduce((sum, p) => sum + (p.jumlah || 0), 0);
  const setorPajakTunai = (state.penyetoranPajak || [])
    .filter((p) => p.jenis === "tunai")
    .reduce((sum, p) => sum + (p.jumlah || 0), 0);
  const totalSetor = mutasi.filter((m) => m.jenis === "setor").reduce((s, m) => s + (m.jumlah || 0), 0);
  const totalAmbil = mutasi.filter((m) => m.jenis === "ambil").reduce((s, m) => s + (m.jumlah || 0), 0);
  return saldoAwalTunai + penerimaanTunai - pengeluaranTunai - setorPajakTunai - totalSetor + totalAmbil;
}

// ============ KOROLARI MAPPING ============
// Maps belanja modal (5.3.x) to aset tetap (1.3.x) for automatic journal entries
export const korolariMapping: Record<string, string> = {
  "5.3.1.01": "1.3.1.01", // Tanah
  "5.3.2.03": "1.3.2.07", // Komputer
  "5.3.4.01": "1.3.3.25", // Gedung - Honor
  "5.3.4.02": "1.3.3.25", // Gedung - Upah TK
  "5.3.4.03": "1.3.3.25", // Gedung - Material
  "5.3.4.04": "1.3.3.25", // Gedung - Sewa
  "5.3.5.01": "1.3.4.01", // Jalan - Honor
  "5.3.5.02": "1.3.4.01", // Jalan - Upah TK
  "5.3.5.03": "1.3.4.01", // Jalan - Material
  "6.2.2.01": "1.2.1.01", // Penyertaan Modal → Investasi
};

export interface JurnalOtomatis {
  tanggal: string;
  noBukti: string;
  uraian: string;
  debet: { kode: string; nama: string; nilai: number }[];
  kredit: { kode: string; nama: string; nilai: number }[];
}

export interface RealisasiRekening {
  kodeRekening: string;
  namaRekening: string;
  anggaran: number;
  anggaranPAK: number;
  anggaranSetelahPAK: number;
  realisasi: number;
  selisih: number;
}

export interface BKUEntry {
  no: number;
  tanggal: string;
  kodeRekening: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  noBukti: string;
  netto: number;
  saldo: number;
}

export interface NeracaItem {
  kode: string;
  uraian: string;
  level: number;
  nilaiTahunIni: number;
  nilaiTahunLalu: number;
}

// Format number Indonesia style
export function formatRupiah(n: number): string {
  if (n === 0) return "0,00";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${formatted})` : formatted;
}

// ============ REALISASI PENDAPATAN ============
export function hitungRealisasiPendapatan(state: AppState): RealisasiRekening[] {
  const result: RealisasiRekening[] = [];
  
  state.pendapatan.forEach(p => {
    const anggaranSetelahPAK = (p.anggaran || 0) + (p.perubahanAnggaran || 0);
    // Realisasi = total penerimaan (TBP) yang menggunakan rekening ini
    // Check both direct kodeRekening and rincian items
    let realisasi = 0;
    state.penerimaan.forEach(t => {
      if (t.rincian && t.rincian.length > 0) {
        // Use rincian-based matching
        realisasi += t.rincian
          .filter(r => r.kodeRekening === p.kodeRekening)
          .reduce((s, r) => s + r.nilai, 0);
      } else if (t.kodeRekening === p.kodeRekening) {
        // Fallback to direct kodeRekening
        realisasi += t.jumlah;
      }
    });
    
    result.push({
      kodeRekening: p.kodeRekening,
      namaRekening: p.namaRekening,
      anggaran: anggaranSetelahPAK,
      anggaranPAK: p.perubahanAnggaran,
      anggaranSetelahPAK,
      realisasi,
      selisih: anggaranSetelahPAK - realisasi,
    });
  });
  
  return result;
}

// ============ REALISASI BELANJA ============
export function hitungRealisasiBelanja(state: AppState): RealisasiRekening[] {
  const result: RealisasiRekening[] = [];
  const pencairan = getEffectivePencairan(state);
  
  // Group belanja by kodeRekening
  const belanjaMap = new Map<string, { anggaran: number; pak: number; nama: string; kodeBidang: string; kodeKegiatan: string; namaKegiatan: string }>();
  state.belanja.forEach(b => {
    const existing = belanjaMap.get(b.kodeRekening);
    if (existing) {
      existing.anggaran += (b.anggaran || 0);
      existing.pak += (b.perubahanAnggaran || 0);
    } else {
      belanjaMap.set(b.kodeRekening, { 
        anggaran: (b.anggaran || 0), pak: (b.perubahanAnggaran || 0), nama: b.namaRekening,
        kodeBidang: b.kodeBidang, kodeKegiatan: b.kodeKegiatan, namaKegiatan: b.namaKegiatan
      });
    }
  });
  
  // Realisasi belanja = total pencairan SPP definitif per rekening
  belanjaMap.forEach((val, kode) => {
    let realisasi = 0;
    state.spp.filter(s => s.jenis === 'definitif' || s.jenis === 'panjar').forEach(spp => {
      const pencairanTotal = pencairan
        .filter(p => p.sppId === spp.id)
        .reduce((s, p) => s + p.jumlah, 0);
      
      // Check if this SPP has rincian for this rekening
      const rincianForRek = spp.rincian.filter(r => r.kodeRekening === kode);
      if (rincianForRek.length > 0) {
        realisasi += rincianForRek.reduce((s, r) => s + r.nilai, 0);
      } else if (spp.rincian.length === 0 && pencairanTotal > 0) {
        // SPP tanpa rincian, check uraian
      }
    });
    
    const anggaranSetelahPAK = val.anggaran + val.pak;
    result.push({
      kodeRekening: kode,
      namaRekening: val.nama,
      anggaran: anggaranSetelahPAK,
      anggaranPAK: val.pak,
      anggaranSetelahPAK,
      realisasi,
      selisih: anggaranSetelahPAK - realisasi,
    });
  });
  
  return result;
}

// ============ REALISASI PEMBIAYAAN ============
export function hitungRealisasiPembiayaan(state: AppState): { penerimaan: RealisasiRekening[]; pengeluaran: RealisasiRekening[] } {
  const penerimaan: RealisasiRekening[] = [];
  const pengeluaran: RealisasiRekening[] = [];
  const pencairan = getEffectivePencairan(state);
  
  state.pembiayaan.forEach(p => {
    const anggaranSetelahPAK = (p.anggaran || 0) + (p.perubahanAnggaran || 0);
    let realisasi = 0;
    
    if (p.jenis === 'pengeluaran') {
      // Realisasi from SPP pembiayaan
      state.spp.filter(s => s.jenis === 'pembiayaan').forEach(spp => {
        const rincian = spp.rincian.filter(r => r.kodeRekening === p.kodeRekening);
        if (rincian.length > 0) {
          const isCaired = pencairan.some(pc => pc.sppId === spp.id);
          if (isCaired) realisasi += rincian.reduce((s, r) => s + r.nilai, 0);
        }
      });
    }
    
    const item: RealisasiRekening = {
      kodeRekening: p.kodeRekening,
      namaRekening: p.namaRekening,
      anggaran: anggaranSetelahPAK,
      anggaranPAK: p.perubahanAnggaran,
      anggaranSetelahPAK,
      realisasi,
      selisih: anggaranSetelahPAK - realisasi,
    };
    
    if (p.jenis === 'penerimaan') penerimaan.push(item);
    else pengeluaran.push(item);
  });
  
  return { penerimaan, pengeluaran };
}

// ============ BUKU KAS UMUM ============
export function generateBKU(state: AppState): BKUEntry[] {
  const entries: BKUEntry[] = [];
  const pencairan = getEffectivePencairan(state);
  const mutasiKas = (() => {
    try { return loadMutasiKas(); } catch { return []; }
  })();
  let saldo = 0;
  let no = 1;
  
  // 1. Saldo awal dari kas
  const saldoKas = state.saldoAwal
    .filter(s => s.kodeRekening === '1.1.1.01' || s.kodeRekening === '1.1.1.02')
    .reduce((s, i) => s + i.debet, 0);
  
  // Add SiLPA as part of opening balance
  const silpaTotal = (state.silpa || [])
    .filter(s => s.isProses)
    .reduce((s, si) => s + si.rincian.reduce((rs, r) => rs + r.debet - r.kredit, 0), 0);
  
  const openingBalance = saldoKas + silpaTotal;
  
  if (openingBalance > 0) {
    saldo = openingBalance;
    entries.push({
      no: no++, tanggal: "01/01/2024", kodeRekening: "",
      uraian: "Saldo Sebelumnya\nSaldo Pindahan",
      penerimaan: openingBalance, pengeluaran: 0, noBukti: "",
      netto: openingBalance, saldo,
    });
  }
  
  // 2. Collect all transactions and sort by date
  type TxEntry = { tanggal: string; sortDate: string; entries: Omit<BKUEntry, 'no' | 'saldo'>[] };
  const allTx: TxEntry[] = [];
  
  // Penerimaan (TBP)
  state.penerimaan.forEach(p => {
    const sortDate = p.tanggal;
    allTx.push({
      tanggal: p.tanggal, sortDate,
      entries: [{
        tanggal: p.tanggal, kodeRekening: p.kodeRekening,
        uraian: `${p.uraian}\n${p.namaRekening}`,
        penerimaan: p.jumlah, pengeluaran: 0, noBukti: p.noBukti,
        netto: p.jumlah,
      }]
    });
  });
  
  // Pencairan SPP (pengeluaran)
  pencairan.forEach(pc => {
    const spp = state.spp.find(s => s.id === pc.sppId);
    if (!spp) return;
    
    const rekeningKode = spp.rincian.length > 0 ? spp.rincian[0].kodeRekening : '';
    allTx.push({
      tanggal: pc.tanggal, sortDate: pc.tanggal,
      entries: [{
        tanggal: pc.tanggal, kodeRekening: rekeningKode,
        uraian: spp.uraian,
        penerimaan: 0, pengeluaran: pc.jumlah, noBukti: pc.nomorPencairan,
        netto: -pc.jumlah,
      }]
    });
    
    // Potongan pajak entries
    spp.buktiTransaksi.forEach(bt => {
      bt.potonganPajak.forEach(pp => {
        allTx.push({
          tanggal: pc.tanggal, sortDate: pc.tanggal,
          entries: [{
            tanggal: pc.tanggal, kodeRekening: pp.kodeRekening,
            uraian: `Potongan Pajak ${pp.namaRekening}`,
            penerimaan: pp.nilai, pengeluaran: 0, noBukti: bt.noBukti,
            netto: pp.nilai,
          }]
        });
      });
    });
  });

  // Mutasi kas ↔ bank (transfer internal). Di BKU dicatat sebagai penerimaan dan pengeluaran dengan nilai sama (netto 0).
  mutasiKas.forEach((m) => {
    const j = Number(m.jumlah || 0);
    if (!j) return;
    if (m.jenis !== "setor" && m.jenis !== "ambil") return;
    const arah = m.jenis === "setor" ? "Mutasi Tunai → Bank" : "Mutasi Bank → Tunai";
    const kode = m.jenis === "setor" ? "1.1.1.02" : "1.1.1.01";
    allTx.push({
      tanggal: m.tanggal,
      sortDate: m.tanggal,
      entries: [{
        tanggal: m.tanggal,
        kodeRekening: kode,
        uraian: `${arah}\n${m.uraian || ""}`.trim(),
        penerimaan: j,
        pengeluaran: j,
        noBukti: m.noBukti,
        netto: 0,
      }],
    });
  });
  
  // Sort by date
  allTx.sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  
  // Build BKU with running saldo
  allTx.forEach(tx => {
    tx.entries.forEach(e => {
      saldo += e.netto;
      entries.push({ ...e, no: no++, saldo });
    });
  });
  
  return entries;
}

// ============ NERACA / LAPORAN KEKAYAAN DESA ============
export function generateNeraca(state: AppState): NeracaItem[] {
  const mutasiKas = (() => {
    try { return loadMutasiKas(); } catch { return []; }
  })();
  const pencairan = getEffectivePencairan(state);
  // Start with saldo awal
  const saldoMap = new Map<string, number>();
  state.saldoAwal.forEach(s => {
    const existing = saldoMap.get(s.kodeRekening) || 0;
    saldoMap.set(s.kodeRekening, existing + s.debet - s.kredit);
  });
  
  // Apply transactions
  // 1. Penerimaan → Dr Kas, Cr Pendapatan
  state.penerimaan.forEach(p => {
    const kasRek = p.jenis === 'tunai' ? '1.1.1.01' : '1.1.1.02';
    saldoMap.set(kasRek, (saldoMap.get(kasRek) || 0) + p.jumlah);
    // Pendapatan increases ekuitas SAL
    saldoMap.set('3.1.2.01', (saldoMap.get('3.1.2.01') || 0) + p.jumlah);
  });
  
  // 2. Pencairan SPP → Dr Belanja/Pembiayaan, Cr Kas
  pencairan.forEach(pc => {
    const spp = state.spp.find(s => s.id === pc.sppId);
    if (!spp) return;
    
    const kasRek = pc.pembayaran === 'tunai' ? '1.1.1.01' : '1.1.1.02';
    saldoMap.set(kasRek, (saldoMap.get(kasRek) || 0) - pc.jumlah);
    
    if (spp.jenis === 'panjar') {
      // Panjar → Dr Piutang Panjar
      saldoMap.set('1.1.2.07', (saldoMap.get('1.1.2.07') || 0) + pc.netto);
    } else if (spp.jenis === 'definitif') {
      // Definitif → belanja reduces ekuitas SAL
      saldoMap.set('3.1.2.01', (saldoMap.get('3.1.2.01') || 0) - pc.jumlah);
      
      // Korolari: if belanja modal, add to aset tetap + ekuitas
      spp.rincian.forEach(r => {
        const asetKode = korolariMapping[r.kodeRekening];
        if (asetKode) {
          saldoMap.set(asetKode, (saldoMap.get(asetKode) || 0) + r.nilai);
          saldoMap.set('3.1.1.01', (saldoMap.get('3.1.1.01') || 0) + r.nilai);
        }
      });
    } else if (spp.jenis === 'pembiayaan') {
      // Pembiayaan → reduces ekuitas SAL, korolari to investasi
      saldoMap.set('3.1.2.01', (saldoMap.get('3.1.2.01') || 0) - pc.jumlah);
      spp.rincian.forEach(r => {
        const asetKode = korolariMapping[r.kodeRekening];
        if (asetKode) {
          saldoMap.set(asetKode, (saldoMap.get(asetKode) || 0) + r.nilai);
          saldoMap.set('3.1.1.01', (saldoMap.get('3.1.1.01') || 0) + r.nilai);
        }
      });
    }
    
    // Potongan pajak → increase hutang pajak
    spp.buktiTransaksi.forEach(bt => {
      bt.potonganPajak.forEach(pp => {
        if (pp.kodeRekening === '7.1.1.01') {
          saldoMap.set('2.1.3.01', (saldoMap.get('2.1.3.01') || 0) + pp.nilai);
        } else if (pp.kodeRekening === '7.1.1.02') {
          saldoMap.set('2.1.3.02', (saldoMap.get('2.1.3.02') || 0) + pp.nilai);
        } else if (pp.kodeRekening === '7.1.1.03') {
          saldoMap.set('2.1.3.03', (saldoMap.get('2.1.3.03') || 0) + pp.nilai);
        }
      });
    });
  });
  
  // 3. Penyetoran pajak → Dr Hutang Pajak, Cr Kas Bank
  state.penyetoranPajak.forEach(pp => {
    saldoMap.set('1.1.1.02', (saldoMap.get('1.1.1.02') || 0) - pp.jumlah);
    // Reduce hutang pajak based on kodeRekening
    if (pp.kodeRekening.startsWith('7.1.1.01')) {
      saldoMap.set('2.1.3.01', (saldoMap.get('2.1.3.01') || 0) - pp.jumlah);
    }
  });

  // 4. Mutasi kas ↔ bank (internal transfer)
  mutasiKas.forEach((m) => {
    const j = Number(m.jumlah || 0);
    if (!j) return;
    if (m.jenis === "setor") {
      saldoMap.set("1.1.1.01", (saldoMap.get("1.1.1.01") || 0) - j);
      saldoMap.set("1.1.1.02", (saldoMap.get("1.1.1.02") || 0) + j);
    } else if (m.jenis === "ambil") {
      saldoMap.set("1.1.1.02", (saldoMap.get("1.1.1.02") || 0) - j);
      saldoMap.set("1.1.1.01", (saldoMap.get("1.1.1.01") || 0) + j);
    }
  });
  
  // Build neraca items from rekening structure
  const neracaItems: NeracaItem[] = [];
  const neracaRekening = rekeningData.filter(r => 
    r.kategori === 'aset' || r.kategori === 'kewajiban' || r.kategori === 'ekuitas'
  );
  
  // Tahun lalu = saldo awal
  const tahunLaluMap = new Map<string, number>();
  state.saldoAwal.forEach(s => {
    const existing = tahunLaluMap.get(s.kodeRekening) || 0;
    tahunLaluMap.set(s.kodeRekening, existing + s.debet - s.kredit);
  });
  
  neracaRekening.forEach(r => {
    if (r.level === 3) {
      const nilai = saldoMap.get(r.kode) || 0;
      const nilaiLalu = tahunLaluMap.get(r.kode) || 0;
      neracaItems.push({
        kode: r.kode, uraian: r.uraian, level: r.level,
        nilaiTahunIni: Math.abs(nilai),
        nilaiTahunLalu: Math.abs(nilaiLalu),
      });
    } else {
      neracaItems.push({
        kode: r.kode, uraian: r.uraian, level: r.level,
        nilaiTahunIni: 0, nilaiTahunLalu: 0,
      });
    }
  });
  
  // Calculate parent totals
  // Level 2 = sum of level 3 children
  neracaItems.forEach((item, idx) => {
    if (item.level === 2) {
      let sumIni = 0, sumLalu = 0;
      for (let j = idx + 1; j < neracaItems.length; j++) {
        if (neracaItems[j].level <= 2) break;
        if (neracaItems[j].level === 3) {
          sumIni += neracaItems[j].nilaiTahunIni;
          sumLalu += neracaItems[j].nilaiTahunLalu;
        }
      }
      item.nilaiTahunIni = sumIni;
      item.nilaiTahunLalu = sumLalu;
    }
  });
  
  // Level 1 = sum of level 2 children
  neracaItems.forEach((item, idx) => {
    if (item.level === 1) {
      let sumIni = 0, sumLalu = 0;
      for (let j = idx + 1; j < neracaItems.length; j++) {
        if (neracaItems[j].level <= 1) break;
        if (neracaItems[j].level === 2) {
          sumIni += neracaItems[j].nilaiTahunIni;
          sumLalu += neracaItems[j].nilaiTahunLalu;
        }
      }
      item.nilaiTahunIni = sumIni;
      item.nilaiTahunLalu = sumLalu;
    }
  });
  
  return neracaItems;
}

// ============ SUMMARY CALCULATIONS ============
export function hitungRingkasan(state: AppState) {
  const realisasiPendapatan = hitungRealisasiPendapatan(state);
  const realisasiBelanja = hitungRealisasiBelanja(state);
  const realisasiPembiayaan = hitungRealisasiPembiayaan(state);
  
  const totalAnggaranPendapatan = realisasiPendapatan.reduce((s, r) => s + r.anggaran, 0);
  const totalRealisasiPendapatan = realisasiPendapatan.reduce((s, r) => s + r.realisasi, 0);
  
  const totalAnggaranBelanja = realisasiBelanja.reduce((s, r) => s + r.anggaran, 0);
  const totalRealisasiBelanja = realisasiBelanja.reduce((s, r) => s + r.realisasi, 0);
  
  const totalAnggaranPenerimaanPembiayaan = realisasiPembiayaan.penerimaan.reduce((s, r) => s + r.anggaran, 0);
  const totalRealisasiPenerimaanPembiayaan = realisasiPembiayaan.penerimaan.reduce((s, r) => s + r.realisasi, 0);
  
  const totalAnggaranPengeluaranPembiayaan = realisasiPembiayaan.pengeluaran.reduce((s, r) => s + r.anggaran, 0);
  const totalRealisasiPengeluaranPembiayaan = realisasiPembiayaan.pengeluaran.reduce((s, r) => s + r.realisasi, 0);
  
  const surplusDefisitAnggaran = totalAnggaranPendapatan - totalAnggaranBelanja;
  const surplusDefisitRealisasi = totalRealisasiPendapatan - totalRealisasiBelanja;
  
  const pembiayaanNettoAnggaran = totalAnggaranPenerimaanPembiayaan - totalAnggaranPengeluaranPembiayaan;
  const pembiayaanNettoRealisasi = totalRealisasiPenerimaanPembiayaan - totalRealisasiPengeluaranPembiayaan;
  
  const silpaAnggaran = surplusDefisitAnggaran + pembiayaanNettoAnggaran;
  const silpaRealisasi = surplusDefisitRealisasi + pembiayaanNettoRealisasi;
  
  return {
    realisasiPendapatan,
    realisasiBelanja,
    realisasiPembiayaan,
    totalAnggaranPendapatan,
    totalRealisasiPendapatan,
    totalAnggaranBelanja,
    totalRealisasiBelanja,
    totalAnggaranPenerimaanPembiayaan,
    totalRealisasiPenerimaanPembiayaan,
    totalAnggaranPengeluaranPembiayaan,
    totalRealisasiPengeluaranPembiayaan,
    surplusDefisitAnggaran,
    surplusDefisitRealisasi,
    pembiayaanNettoAnggaran,
    pembiayaanNettoRealisasi,
    silpaAnggaran,
    silpaRealisasi,
  };
}

// ============ BKP PAJAK ============
export interface BKPPajakEntry {
  no: number;
  tanggal: string;
  noBukti: string;
  uraian: string;
  jenisPajak: string;
  pemotongan: number;
  penyetoran: number;
  saldo: number;
}

export function generateBKPPajak(state: AppState): BKPPajakEntry[] {
  const entries: BKPPajakEntry[] = [];
  let saldo = 0;
  let no = 1;
  
  // Saldo awal hutang pajak
  state.saldoAwal
    .filter(s => s.kodeRekening.startsWith('2.1.3'))
    .forEach(s => {
      saldo += s.kredit;
      if (s.kredit > 0) {
        const rek = rekeningData.find(r => r.kode === s.kodeRekening);
        entries.push({
          no: no++, tanggal: "01/01/2024", noBukti: "Saldo Awal",
          uraian: `Hutang Pajak Tahun Lalu`,
          jenisPajak: rek?.uraian || s.kodeRekening,
          pemotongan: s.kredit, penyetoran: 0, saldo,
        });
      }
    });
  
  // Potongan pajak dari SPP
  state.spp.forEach(spp => {
    spp.buktiTransaksi.forEach(bt => {
      bt.potonganPajak.forEach(pp => {
        saldo += pp.nilai;
        entries.push({
          no: no++, tanggal: bt.tanggal, noBukti: bt.noBukti,
          uraian: bt.keterangan,
          jenisPajak: pp.namaRekening,
          pemotongan: pp.nilai, penyetoran: 0, saldo,
        });
      });
    });
  });
  
  // Penyetoran pajak
  state.penyetoranPajak.forEach(pp => {
    saldo -= pp.jumlah;
    entries.push({
      no: no++, tanggal: pp.tanggal, noBukti: pp.noBukti,
      uraian: `NTPN: ${pp.ntpn}\n${pp.keterangan}`,
      jenisPajak: rekeningData.find(r => r.kode === pp.kodeRekening)?.uraian || '',
      pemotongan: 0, penyetoran: pp.jumlah, saldo,
    });
  });
  
  return entries;
}

// ============ VALIDASI APBDes BALANCE ============
export function validasiAPBDesBalance(state: AppState): { balanced: boolean; pendapatan: number; belanja: number; pembiayaanNetto: number; silpa: number } {
  const totalPendapatan = state.pendapatan.reduce((s, p) => s + (p.anggaran || 0) + (p.perubahanAnggaran || 0), 0);
  const totalBelanja = state.belanja.reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0), 0);
  const totalPenerimaanPembiayaan = state.pembiayaan.filter(p => p.jenis === 'penerimaan').reduce((s, p) => s + (p.anggaran || 0) + (p.perubahanAnggaran || 0), 0);
  const totalPengeluaranPembiayaan = state.pembiayaan.filter(p => p.jenis === 'pengeluaran').reduce((s, p) => s + (p.anggaran || 0) + (p.perubahanAnggaran || 0), 0);
  const pembiayaanNetto = totalPenerimaanPembiayaan - totalPengeluaranPembiayaan;
  const silpa = totalPendapatan + pembiayaanNetto - totalBelanja;
  
  return {
    balanced: true, // APBDes always has SILPA as balancing item
    pendapatan: totalPendapatan,
    belanja: totalBelanja,
    pembiayaanNetto,
    silpa,
  };
}

// ============ SALDO ANGGARAN CHECK (V2 Validation) ============
export function cekSaldoAnggaran(state: AppState, kodeRekening: string): number {
  const pencairan = getEffectivePencairan(state);
  const anggaran = state.belanja
    .filter(b => b.kodeRekening === kodeRekening)
    .reduce((s, b) => s + (b.anggaran || 0) + (b.perubahanAnggaran || 0), 0);
  
  const realisasi = pencairan.reduce((total, pc) => {
    const spp = state.spp.find(s => s.id === pc.sppId);
    if (!spp) return total;
    return total + spp.rincian
      .filter(r => r.kodeRekening === kodeRekening)
      .reduce((s, r) => s + r.nilai, 0);
  }, 0);
  
  return anggaran - realisasi;
}

// ============ SALDO KAS (V3 Validation) ============
export function cekSaldoKas(state: AppState): number {
  const pencairan = getEffectivePencairan(state);
  const saldoAwalKas = state.saldoAwal
    .filter(s => s.kodeRekening === '1.1.1.01' || s.kodeRekening === '1.1.1.02')
    .reduce((s, i) => s + i.debet, 0);
  
  const totalPenerimaan = state.penerimaan.reduce((s, p) => s + p.jumlah, 0);
  const totalPencairan = pencairan.reduce((s, p) => s + p.jumlah, 0);
  
  return saldoAwalKas + totalPenerimaan - totalPencairan;
}

// ============ PAGU ANGGARAN PER KEGIATAN ============
// Per revisi klien: pagu kegiatan = SUM(belanja[kodeKegiatan].anggaran).
// Kegiatan APBDesa dihapus, jadi sumber pagu adalah Belanja itu sendiri.
export function getPaguKegiatan(state: AppState, kodeKegiatan: string): number {
  return state.belanja
    .filter(b => b.kodeKegiatan === kodeKegiatan)
    .reduce((s, b) => s + (b.anggaran || 0), 0);
}

export function getTotalBelanjaKegiatan(state: AppState, kodeKegiatan: string): number {
  return state.belanja
    .filter(b => b.kodeKegiatan === kodeKegiatan)
    .reduce((s, b) => s + (b.anggaran || 0), 0);
}

export function cekSisaPaguKegiatan(state: AppState, kodeKegiatan: string): number {
  return getPaguKegiatan(state, kodeKegiatan) - getTotalBelanjaKegiatan(state, kodeKegiatan);
}

// ============ BRIDGE BELANJA → SPP (per No. Ref) ============
/** Total nilai SPP rincian (panjar+definitif) yang merujuk baris belanja tertentu. */
export function getTerpakaiBelanjaItem(state: AppState, belanjaId: string, excludeRincianId?: string): number {
  let total = 0;
  state.spp
    .filter(s => s.jenis === 'panjar' || s.jenis === 'definitif')
    .forEach(spp => {
      spp.rincian.forEach(r => {
        if (r.belanjaId === belanjaId && r.id !== excludeRincianId) {
          total += r.nilai || 0;
        }
      });
    });
  return total;
}

/** Sisa anggaran baris belanja = anggaran − total terpakai SPP. */
export function getSisaBelanjaItem(state: AppState, belanjaId: string, excludeRincianId?: string): number {
  const b = state.belanja.find(x => x.id === belanjaId);
  if (!b) return 0;
  return (b.anggaran || 0) - getTerpakaiBelanjaItem(state, belanjaId, excludeRincianId);
}

export interface BelanjaOption {
  belanjaId: string;
  noRef: string;
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  anggaran: number;
  terpakai: number;
  sisa: number;
}

/** Daftar baris Belanja untuk dipilih sebagai rincian SPP. */
export function getBelanjaOptionsForKegiatan(
  state: AppState,
  kodeKegiatan: string,
  excludeRincianId?: string,
): BelanjaOption[] {
  return state.belanja
    .filter(b => b.kodeKegiatan === kodeKegiatan)
    .map(b => {
      const terpakai = getTerpakaiBelanjaItem(state, b.id, excludeRincianId);
      return {
        belanjaId: b.id,
        noRef: b.nomorUrut || '',
        kodeRekening: b.kodeRekening,
        namaRekening: b.namaRekening,
        uraian: b.uraian,
        anggaran: b.anggaran || 0,
        terpakai,
        sisa: (b.anggaran || 0) - terpakai,
      };
    });
}

// ============ BRIDGE PEMBIAYAAN → SPP PEMBIAYAAN ============
export function getTerpakaiPembiayaanRekening(state: AppState, kodeRekening: string, excludeRincianId?: string): number {
  let total = 0;
  state.spp
    .filter(s => s.jenis === 'pembiayaan')
    .forEach(spp => {
      spp.rincian.forEach(r => {
        if (r.kodeRekening === kodeRekening && r.id !== excludeRincianId) {
          total += r.nilai || 0;
        }
      });
    });
  return total;
}

export interface PembiayaanOption {
  pembiayaanId: string;
  kodeRekening: string;
  namaRekening: string;
  anggaran: number;
  terpakai: number;
  sisa: number;
}

export function getPembiayaanPengeluaranOptions(state: AppState, excludeRincianId?: string): PembiayaanOption[] {
  return state.pembiayaan
    .filter(p => p.jenis === 'pengeluaran')
    .map(p => {
      const terpakai = getTerpakaiPembiayaanRekening(state, p.kodeRekening, excludeRincianId);
      return {
        pembiayaanId: p.id,
        kodeRekening: p.kodeRekening,
        namaRekening: p.namaRekening,
        anggaran: p.anggaran || 0,
        terpakai,
        sisa: (p.anggaran || 0) - terpakai,
      };
    });
}

// ============ BRIDGE PENDAPATAN → PENERIMAAN ============
export interface PendapatanOption {
  pendapatanId: string;
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  sumberDana: string;
  anggaran: number;
  terealisasi: number;
  sisa: number;
}

export function getTerealisasiPendapatan(state: AppState, kodeRekening: string): number {
  let total = 0;
  state.penerimaan.forEach(p => {
    if (p.rincian && p.rincian.length > 0) {
      total += p.rincian
        .filter(r => r.kodeRekening === kodeRekening)
        .reduce((s, r) => s + (r.nilai || 0), 0);
    } else if (p.kodeRekening === kodeRekening) {
      total += p.jumlah || 0;
    }
  });
  return total;
}

export function getPendapatanOptions(state: AppState): PendapatanOption[] {
  return state.pendapatan.map(p => {
    const terealisasi = getTerealisasiPendapatan(state, p.kodeRekening);
    return {
      pendapatanId: p.id,
      kodeRekening: p.kodeRekening,
      namaRekening: p.namaRekening,
      uraian: p.uraian,
      sumberDana: p.sumberDana,
      anggaran: p.anggaran || 0,
      terealisasi,
      sisa: (p.anggaran || 0) - terealisasi,
    };
  });
}
