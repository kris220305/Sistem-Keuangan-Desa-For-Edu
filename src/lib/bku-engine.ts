import type { AppState } from "@/data/app-state";
import { getEffectivePencairan } from "@/lib/financial-engine";
import { loadMutasiKas, type MutasiKasItem } from "@/data/mutasi-kas";

export type BKUJenis = "utama" | "tunai" | "bank";

export interface BKURow {
  no: number;
  tanggal: string; // YYYY-MM-DD
  kodeRekening: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  saldo: number;
  noBukti: string;
  flags?: Array<"saldo_minus" | "backdated" | "invalid_tanggal" | "invalid_nilai">;
}

export interface BKUFilter {
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
  tahunAnggaran?: number;
}

export interface BKUResult {
  rows: BKURow[];
  saldoAwal: number;
  saldoAkhir: number;
  warnings: string[];
  negativeRows: number[];
  tahunUsed: number;
  startUsed: string;
  endUsed: string;
}

type Tx = {
  tanggal: string;
  kodeRekening: string;
  uraian: string;
  penerimaan: number;
  pengeluaran: number;
  noBukti: string;
  kind:
    | "saldo_awal"
    | "penerimaan"
    | "pengeluaran"
    | "spj_posting"
    | "potongan_pajak"
    | "mutasi_transfer"
    | "mutasi_tunai";
  sourceId?: string;
  flags?: BKURow["flags"];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getYearStart(year: number) {
  return `${year}-${pad2(1)}-${pad2(1)}`;
}

function getYearEnd(year: number) {
  return `${year}-${pad2(12)}-${pad2(31)}`;
}

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function compareIso(a: string, b: string) {
  return a.localeCompare(b);
}

function sumDebetKredit(items: Array<{ kodeRekening: string; debet: number; kredit: number }>, kode: string) {
  return items.filter((x) => x.kodeRekening === kode).reduce((s, x) => s + (x.debet || 0) - (x.kredit || 0), 0);
}

function sumSilpa(items: Array<{ isProses: boolean; rincian: Array<{ debet: number; kredit: number }> }>) {
  return items
    .filter((s) => s.isProses)
    .reduce((sum, si) => sum + (si.rincian || []).reduce((rs, r) => rs + (r.debet || 0) - (r.kredit || 0), 0), 0);
}

function getKodeRekeningFromRincian(rincian?: Array<{ kodeRekening: string; nilai: number }>, fallback?: string) {
  if (rincian && rincian.length > 0) return rincian[0].kodeRekening || fallback || "";
  return fallback || "";
}

function classifyAkunToArus(kodeRekening: string): "penerimaan" | "pengeluaran" {
  const k = String(kodeRekening || "").trim();
  if (/^4(\.|$)/.test(k)) return "penerimaan";
  if (/^5(\.|$)/.test(k)) return "pengeluaran";
  if (/^6(\.|$)/.test(k)) {
    if (/^6\.1(\.|$)/.test(k)) return "penerimaan";
    if (/^6\.2(\.|$)/.test(k)) return "pengeluaran";
  }
  return "pengeluaran";
}

function loadMutasiKasSafe(m?: MutasiKasItem[]) {
  if (m) return m;
  try {
    return loadMutasiKas();
  } catch {
    return [];
  }
}

function normalizeFilter(filter?: BKUFilter) {
  const preferredYear = filter?.tahunAnggaran || new Date().getFullYear();
  const preferredStart = filter?.start && isIsoDate(filter.start) ? filter.start : undefined;
  const preferredEnd = filter?.end && isIsoDate(filter.end) ? filter.end : undefined;
  return { preferredYear, preferredStart, preferredEnd };
}

function pickYearFromTransactions(dates: string[]): number | null {
  const counts = new Map<number, number>();
  for (const d of dates) {
    if (!isIsoDate(d)) continue;
    const y = Number(d.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    counts.set(y, (counts.get(y) || 0) + 1);
  }
  let best: number | null = null;
  let bestCount = -1;
  for (const [y, c] of counts.entries()) {
    if (c > bestCount) {
      best = y;
      bestCount = c;
    }
  }
  return best;
}

export function buildBKU(
  state: AppState,
  jenis: BKUJenis,
  filter?: BKUFilter,
  opts?: { mutasiKas?: MutasiKasItem[] },
): BKUResult {
  const { preferredYear, preferredStart, preferredEnd } = normalizeFilter(filter);
  const warnings: string[] = [];
  const negativeRows: number[] = [];

  const mutasiKas = loadMutasiKasSafe(opts?.mutasiKas);
  const pencairan = getEffectivePencairan(state);
  const pcBySppId = new Map(pencairan.map((pc) => [pc.sppId, pc]));

  const saldoAwalTunai = sumDebetKredit(state.saldoAwal || [], "1.1.1.01");
  const saldoAwalBank = sumDebetKredit(state.saldoAwal || [], "1.1.1.02");
  const silpaTotal = sumSilpa(state.silpa || []);

  const openingTunai = saldoAwalTunai;
  const openingBank = saldoAwalBank + silpaTotal;
  const openingUtama = openingTunai + openingBank;

  const openingBalance = jenis === "tunai" ? openingTunai : jenis === "bank" ? openingBank : openingUtama;

  const txs: Tx[] = [];

  const pushTx = (tx: Tx) => {
    const flags = tx.flags || [];
    if (!isIsoDate(tx.tanggal)) {
      flags.push("invalid_tanggal");
      warnings.push(`Tanggal tidak valid pada transaksi: ${tx.noBukti || tx.uraian}`);
      return;
    }
    if ((tx.penerimaan || 0) < 0 || (tx.pengeluaran || 0) < 0) {
      flags.push("invalid_nilai");
      warnings.push(`Nilai transaksi tidak valid (negatif): ${tx.noBukti || tx.uraian}`);
      return;
    }
    if (!tx.penerimaan && !tx.pengeluaran) return;
    tx.flags = flags.length ? flags : undefined;
    txs.push(tx);
  };

  (state.penerimaan || []).forEach((p) => {
    const isTunai = p.jenis === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;
    const kode = getKodeRekeningFromRincian(p.rincian || [], p.kodeRekening);
    pushTx({
      tanggal: p.tanggal,
      kodeRekening: kode,
      uraian: `${p.uraian}${p.namaRekening ? `\n${p.namaRekening}` : ""}`.trim(),
      penerimaan: Number(p.jumlah || 0),
      pengeluaran: 0,
      noBukti: p.noBukti,
      kind: "penerimaan",
      sourceId: p.id,
    });
  });

  (state.spp || []).forEach((spp) => {
    if ((spp as any).isFinal === false) return;
    if (spp.jenis === "panjar") return;

    const pc = pcBySppId.get(spp.id);
    const pembayaran = pc?.pembayaran || spp.pembayaran || "bank";
    const isTunai = pembayaran === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;

    const tanggal = pc?.tanggal || spp.tanggalSPP;
    const noBukti = pc?.nomorPencairan || spp.nomorSPP;
    const lines = (spp.rincian || []).filter((r) => Number(r.nilai || 0) > 0);
    if (lines.length === 0) return;

    lines.forEach((r) => {
      const arus = classifyAkunToArus(r.kodeRekening);
      pushTx({
        tanggal,
        kodeRekening: r.kodeRekening,
        uraian: `${spp.uraian}${r.namaKegiatan ? `\n${r.namaKegiatan}` : ""}${r.namaRekening ? `\n${r.namaRekening}` : ""}`.trim(),
        penerimaan: arus === "penerimaan" ? Number(r.nilai || 0) : 0,
        pengeluaran: arus === "pengeluaran" ? Number(r.nilai || 0) : 0,
        noBukti,
        kind: "spj_posting",
        sourceId: `${spp.id}:${r.id}`,
      });
    });
  });

  (state.spjPanjar || []).forEach((spj) => {
    const spp = (state.spp || []).find((s) => s.id === spj.sppId);
    if (!spp) return;
    if ((spp as any).isFinal === false) return;

    const pc = pcBySppId.get(spp.id);
    const pembayaran = pc?.pembayaran || spp.pembayaran || "bank";
    const isTunai = pembayaran === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;

    const tanggal = spj.tanggalSPJ || pc?.tanggal || spp.tanggalSPP;
    const noBukti = spj.nomorSPJ || spp.nomorSPP;
    const lines = (spj.rincianSPJ || []).filter((r) => Number(r.nilai || 0) > 0);
    if (lines.length === 0) return;

    lines.forEach((r) => {
      const arus = classifyAkunToArus(r.kodeRekening);
      pushTx({
        tanggal,
        kodeRekening: r.kodeRekening,
        uraian: `${spj.keterangan || spp.uraian}${r.namaKegiatan ? `\n${r.namaKegiatan}` : ""}${r.namaRekening ? `\n${r.namaRekening}` : ""}`.trim(),
        penerimaan: arus === "penerimaan" ? Number(r.nilai || 0) : 0,
        pengeluaran: arus === "pengeluaran" ? Number(r.nilai || 0) : 0,
        noBukti,
        kind: "spj_posting",
        sourceId: `${spj.id}:${r.id}`,
      });
    });
  });

  (state.sisaPanjar || []).forEach((sp) => {
    const spj = (state.spjPanjar || []).find((x) => x.id === sp.spjId);
    if (!spj) return;
    const spp = (state.spp || []).find((s) => s.id === spj.sppId);
    if (!spp) return;
    if ((spp as any).isFinal === false) return;

    const pc = pcBySppId.get(spp.id);
    const pembayaran = pc?.pembayaran || spp.pembayaran || "bank";
    const isTunai = pembayaran === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;

    const kodeKas = isTunai ? "1.1.1.01" : "1.1.1.02";
    pushTx({
      tanggal: sp.tanggal,
      kodeRekening: kodeKas,
      uraian: `Pengembalian Sisa Panjar\n${sp.keterangan || spj.keterangan || spp.uraian}`.trim(),
      penerimaan: Number(sp.nominal || 0),
      pengeluaran: 0,
      noBukti: sp.buktiNo,
      kind: "spj_posting",
      sourceId: sp.id,
    });
  });

  pencairan.forEach((pc) => {
    const spp = (state.spp || []).find((s) => s.id === pc.sppId);
    if (!spp) return;
    const isTunai = pc.pembayaran === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;

    const isFinal = (spp as any).isFinal !== false;
    const hasSpjPosting =
      (isFinal && spp.jenis !== "panjar" && (spp.rincian || []).some((r) => Number(r.nilai || 0) > 0)) ||
      (isFinal &&
        spp.jenis === "panjar" &&
        (state.spjPanjar || []).some((spj) => spj.sppId === spp.id && (spj.rincianSPJ || []).some((r) => Number(r.nilai || 0) > 0)));
    if (!hasSpjPosting) {
      const kode = getKodeRekeningFromRincian(spp.rincian || [], "");
      pushTx({
        tanggal: pc.tanggal,
        kodeRekening: kode,
        uraian: spp.uraian,
        penerimaan: 0,
        pengeluaran: Number(pc.jumlah || 0),
        noBukti: pc.nomorPencairan,
        kind: "pengeluaran",
        sourceId: pc.id,
      });
    }

    // Potongan pajak dari SPP buktiTransaksi
    // Skip untuk SPP panjar yang sudah punya SPJ (potongan dicatat di level SPJ)
    const isPanjarWithSpj = spp.jenis === "panjar" &&
      (state.spjPanjar || []).some((spj) => spj.sppId === spp.id);

    if (!isPanjarWithSpj) {
      (spp.buktiTransaksi || []).forEach((bt) => {
        (bt.potonganPajak || []).forEach((pp) => {
          if (jenis === "tunai" && !isTunai) return;
          if (jenis === "bank" && isTunai) return;
          pushTx({
            tanggal: pc.tanggal,
            kodeRekening: pp.kodeRekening,
            uraian: `Potongan Pajak ${pp.namaRekening}`.trim(),
            penerimaan: Number(pp.nilai || 0),
            pengeluaran: 0,
            noBukti: bt.noBukti,
            kind: "potongan_pajak",
            sourceId: `${pc.id}:${bt.id}:${pp.kodeRekening}`,
          });
        });
      });
    }
  });

  // ===== PENYETORAN PAJAK → Pengeluaran (mengurangi kas) =====
  (state.penyetoranPajak || []).forEach((pp) => {
    const j = Number(pp.jumlah || 0);
    if (!j) return;
    const isTunai = pp.jenis === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;
    const kodeKas = isTunai ? "1.1.1.01" : "1.1.1.02";
    pushTx({
      tanggal: pp.tanggal,
      kodeRekening: kodeKas,
      uraian: `Penyetoran Pajak ${pp.keterangan || ""}`.trim(),
      penerimaan: 0,
      pengeluaran: j,
      noBukti: pp.noBukti,
      kind: "pengeluaran",
      sourceId: `pajak:${pp.id}`,
    });
  });

  // ===== POTONGAN PAJAK dari SPJ Panjar (buktiKwitansi) → Penerimaan =====
  (state.spjPanjar || []).forEach((spj) => {
    const spp = (state.spp || []).find((s) => s.id === spj.sppId);
    if (!spp) return;
    if ((spp as any).isFinal === false) return;

    const pc = pcBySppId.get(spp.id);
    const pembayaran = pc?.pembayaran || spp.pembayaran || "bank";
    const isTunai = pembayaran === "tunai";
    if (jenis === "tunai" && !isTunai) return;
    if (jenis === "bank" && isTunai) return;

    const tanggal = spj.tanggalSPJ || pc?.tanggal || spp.tanggalSPP;

    // Potongan dari buktiKwitansi SPJ Panjar
    (spj.buktiKwitansi || []).forEach((bt) => {
      (bt.potonganPajak || []).forEach((pot) => {
        if (!pot.nilai) return;
        pushTx({
          tanggal,
          kodeRekening: pot.kodeRekening,
          uraian: `Potongan Pajak ${pot.namaRekening}`.trim(),
          penerimaan: Number(pot.nilai || 0),
          pengeluaran: 0,
          noBukti: bt.noBukti,
          kind: "potongan_pajak",
          sourceId: `spj:${spj.id}:${bt.id}:${pot.kodeRekening}`,
        });
      });
    });

    // Potongan dari array potongan[] SPJ Panjar (level SPJ)
    (spj.potongan || []).forEach((pot, idx) => {
      if (!pot.nilai) return;
      pushTx({
        tanggal,
        kodeRekening: pot.kodeRekening,
        uraian: `Potongan Pajak SPJ ${pot.namaRekening}`.trim(),
        penerimaan: Number(pot.nilai || 0),
        pengeluaran: 0,
        noBukti: spj.nomorSPJ,
        kind: "potongan_pajak",
        sourceId: `spj:${spj.id}:pot:${idx}`,
      });
    });
  });

  mutasiKas.forEach((m) => {
    const j = Number(m.jumlah || 0);
    if (!j) return;
    if (!m.tanggal) return;

    if (m.jenis === "setor" || m.jenis === "ambil") {
      if (jenis === "utama") {
        const arah = m.jenis === "setor" ? "Mutasi Tunai → Bank" : "Mutasi Bank → Tunai";
        const kode = m.jenis === "setor" ? "1.1.1.02" : "1.1.1.01";
        pushTx({
          tanggal: m.tanggal,
          kodeRekening: kode,
          uraian: `${arah}\n${m.uraian || ""}`.trim(),
          penerimaan: j,
          pengeluaran: j,
          noBukti: m.noBukti,
          kind: "mutasi_transfer",
          sourceId: m.id,
        });
        return;
      }

      if (jenis === "tunai") {
        const arah = m.jenis === "setor" ? "Setor Tunai → Bank" : "Ambil Bank → Tunai";
        pushTx({
          tanggal: m.tanggal,
          kodeRekening: "1.1.1.01",
          uraian: `${arah}\n${m.uraian || ""}`.trim(),
          penerimaan: m.jenis === "ambil" ? j : 0,
          pengeluaran: m.jenis === "setor" ? j : 0,
          noBukti: m.noBukti,
          kind: "mutasi_transfer",
          sourceId: m.id,
        });
        return;
      }

      if (jenis === "bank") {
        const arah = m.jenis === "setor" ? "Terima Setor Tunai" : "Keluar Ambil Tunai";
        pushTx({
          tanggal: m.tanggal,
          kodeRekening: "1.1.1.02",
          uraian: `${arah}\n${m.uraian || ""}`.trim(),
          penerimaan: m.jenis === "setor" ? j : 0,
          pengeluaran: m.jenis === "ambil" ? j : 0,
          noBukti: m.noBukti,
          kind: "mutasi_transfer",
          sourceId: m.id,
        });
        return;
      }
    }

    if (m.jenis === "masuk" || m.jenis === "keluar") {
      if (m.sumberPenerimaanIds && m.sumberPenerimaanIds.length > 0) return;
      if (jenis === "bank") return;
      const arah = m.jenis === "masuk" ? "Mutasi Tunai Masuk" : "Mutasi Tunai Keluar";
      pushTx({
        tanggal: m.tanggal,
        kodeRekening: "1.1.1.01",
        uraian: `${arah}\n${m.uraian || ""}`.trim(),
        penerimaan: m.jenis === "masuk" ? j : 0,
        pengeluaran: m.jenis === "keluar" ? j : 0,
        noBukti: m.noBukti,
        kind: "mutasi_tunai",
        sourceId: m.id,
      });
    }
  });

  const tahunUsed = (() => {
    const inferred = pickYearFromTransactions(txs.map((t) => t.tanggal));
    if (!inferred) return preferredYear;
    return inferred;
  })();
  const yearStart = getYearStart(tahunUsed);
  const yearEnd = getYearEnd(tahunUsed);
  const start = preferredStart || yearStart;
  const end = preferredEnd || yearEnd;

  for (const tx of txs) {
    if (isIsoDate(tx.tanggal) && compareIso(tx.tanggal, yearStart) < 0) {
      tx.flags = [...(tx.flags || []), "backdated"];
    }
  }

  txs.sort((a, b) => {
    const c = compareIso(a.tanggal, b.tanggal);
    if (c !== 0) return c;
    return (a.noBukti || "").localeCompare(b.noBukti || "");
  });

  const saldoStart = (() => {
    let s = openingBalance;
    for (const tx of txs) {
      if (compareIso(tx.tanggal, start) < 0) {
        s += (tx.penerimaan || 0) - (tx.pengeluaran || 0);
      } else {
        break;
      }
    }
    return s;
  })();

  const rows: BKURow[] = [];
  let saldo = saldoStart;
  let no = 1;

  rows.push({
    no: no++,
    tanggal: start,
    kodeRekening: "",
    uraian: "Saldo Sebelumnya",
    penerimaan: 0,
    pengeluaran: 0,
    saldo,
    noBukti: "",
  });

  for (const tx of txs) {
    if (compareIso(tx.tanggal, start) < 0) continue;
    if (compareIso(tx.tanggal, end) > 0) continue;
    saldo += (tx.penerimaan || 0) - (tx.pengeluaran || 0);
    const row: BKURow = {
      no: no++,
      tanggal: tx.tanggal,
      kodeRekening: tx.kodeRekening || "",
      uraian: tx.uraian,
      penerimaan: tx.penerimaan,
      pengeluaran: tx.pengeluaran,
      saldo,
      noBukti: tx.noBukti || "",
      flags: tx.flags,
    };
    if (saldo < 0) {
      row.flags = [...(row.flags || []), "saldo_minus"];
      negativeRows.push(row.no);
    }
    rows.push(row);
  }

  return {
    rows,
    saldoAwal: saldoStart,
    saldoAkhir: saldo,
    warnings,
    negativeRows,
    tahunUsed,
    startUsed: start,
    endUsed: end,
  };
}
