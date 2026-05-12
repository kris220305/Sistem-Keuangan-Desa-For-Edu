import type { PenerimaanItem } from "@/data/app-state";
import type { MutasiKasItem } from "@/data/mutasi-kas";

export function buildMutasiTunaiMasukFromPenerimaan(p: Pick<PenerimaanItem, "id" | "tanggal" | "noBukti" | "uraian" | "jumlah">, actor: { sessionId?: string; name?: string }, now: number): MutasiKasItem {
  return {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(now),
    tanggal: p.tanggal,
    noBukti: p.noBukti,
    jenis: "masuk",
    uraian: p.uraian ? `Penerimaan tunai: ${p.uraian}` : "Penerimaan tunai",
    jumlah: Number(p.jumlah || 0),
    rekening: "1.1.1.01",
    namaBank: "Kas Tunai",
    createdAt: now,
    createdBySessionId: actor.sessionId,
    createdByName: actor.name,
    sumberPenerimaanIds: [p.id],
  };
}

export function applyAutoMutasiForPenerimaanTunai(mutasiKas: MutasiKasItem[], penerimaan: Pick<PenerimaanItem, "id" | "tanggal" | "noBukti" | "uraian" | "jumlah">, actor: { sessionId?: string; name?: string }, now: number) {
  const already = mutasiKas.some((m) => (m.sumberPenerimaanIds || []).includes(penerimaan.id));
  if (already) return { mutasiKas, created: null as MutasiKasItem | null };
  const created = buildMutasiTunaiMasukFromPenerimaan(penerimaan, actor, now);
  return { mutasiKas: [...mutasiKas, created], created };
}
