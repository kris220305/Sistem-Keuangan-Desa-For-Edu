export type MutasiKasJenis = "setor" | "ambil" | "masuk" | "keluar";

export interface MutasiKasItem {
  id: string;
  tanggal: string;
  noBukti: string;
  jenis: MutasiKasJenis;
  uraian: string;
  jumlah: number;
  rekening: string;
  namaBank: string;
  createdAt: number;
  createdBySessionId?: string;
  createdByName?: string;
  sumberPenerimaanIds?: string[];
}

export const MUTASI_KAS_STORAGE_KEY = "siskeudes_mutasi_kas";

export function loadMutasiKas(): MutasiKasItem[] {
  try {
    const r = localStorage.getItem(MUTASI_KAS_STORAGE_KEY);
    const parsed = r ? (JSON.parse(r) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as MutasiKasItem[]) : [];
  } catch {
    return [];
  }
}

export function saveMutasiKasLocal(items: MutasiKasItem[]) {
  localStorage.setItem(MUTASI_KAS_STORAGE_KEY, JSON.stringify(items));
}
