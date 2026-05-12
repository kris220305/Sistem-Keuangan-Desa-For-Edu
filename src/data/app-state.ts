import { upsertSession, getSessionId } from "@/lib/session-manager";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

// Shared types and simple state manager using localStorage

export interface PendapatanItem {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien — disimpan opsional untuk backward compat data lama */
  perubahanAnggaran?: number;
  sumberDana: string;
  jumlahSatuan: string;
  hargaSatuan: number;
}

export interface BelanjaItem {
  id: string;
  kodeBidang: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  kodeRekening: string;
  namaRekening: string;
  nomorUrut: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien */
  perubahanAnggaran?: number;
  jumlahSatuan: string;
  hargaSatuan: number;
  sumberDana: string;
}

export interface PembiayaanItem {
  id: string;
  jenis: 'penerimaan' | 'pengeluaran';
  kodeRekening: string;
  namaRekening: string;
  uraian: string;
  anggaran: number;
  /** @deprecated PAK dihapus per revisi klien */
  perubahanAnggaran?: number;
  jumlahSatuan: string;
  hargaSatuan: number;
  sumberDana: string;
}

export interface PenerimaanRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  sumberDana: string;
  nilai: number;
}

export interface PenerimaanItem {
  id: string;
  jenis: 'tunai' | 'bank' | 'silpa';
  tanggal: string;
  noBukti: string;
  uraian: string;
  jumlah: number;
  kodeRekening: string;
  namaRekening: string;
  penyetor: string;
  nama: string;
  alamat: string;
  ttd: string;
  rekening?: string;
  namaBank?: string;
  kppn?: string;
  rincian: PenerimaanRincian[];
  isProses?: boolean;
  /** Tunai yang sudah dipindahkan ke bank via Mutasi Kas */
  sudahMutasi?: boolean;
}

export interface SilpaRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  debet: number;
  kredit: number;
}

export interface SilpaItem {
  id: string;
  tanggal: string;
  nomorBukti: string;
  uraian: string;
  isProses: boolean;
  rincian: SilpaRincian[];
}

export interface SPPItem {
  id: string;
  jenis: 'panjar' | 'definitif' | 'pembiayaan';
  tanggalSPP: string;
  nomorSPP: string;
  uraian: string;
  jumlah: number;
  isFinal: boolean;
  pembayaran?: 'tunai' | 'bank';
  rincian: SPPRincian[];
  buktiTransaksi: BuktiTransaksi[];
}

export interface SPPRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
  belanjaId?: string;
  noRef?: string;
  kodeKegiatan?: string;
  kodeBidang?: string;
  namaKegiatan?: string;
}

export interface BuktiTransaksi {
  id: string;
  tanggal: string;
  noBukti: string;
  keterangan: string;
  jumlah: number;
  penerima: string;
  nama: string;
  alamat: string;
  potonganPajak: PotonganPajak[];
}

export interface PotonganPajak {
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
}

export interface PencairanSPP {
  id: string;
  sppId: string;
  nomorPencairan: string;
  tanggal: string;
  noCek: string;
  pembayaran: 'tunai' | 'bank';
  jumlah: number;
  potongan: number;
  netto: number;
}

export interface PenyetoranPajak {
  id: string;
  tanggal: string;
  noBukti: string;
  kodeRekening: string;
  kodeMAP: string;
  keterangan: string;
  jumlah: number;
  ntpn: string;
  jenis: 'tunai' | 'bank';
  rincianBuktiPotong: { noBukti: string; kodeRekening: string; namaRekening: string; nilai: number }[];
  /** ID-ID potongan asal yang sudah di-link ke penyetoran ini (untuk cegah double setor) */
  sumberPotonganIds?: string[];
}

export interface SaldoAwalItem {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  debet: number;
  kredit: number;
}

export interface SPJRincian {
  id: string;
  kodeRekening: string;
  namaRekening: string;
  nilai: number;
  belanjaId?: string;
  noRef?: string;
  kodeKegiatan?: string;
  namaKegiatan?: string;
}

export interface SPJPanjarItem {
  id: string;
  sppId: string;
  tanggalSPJ: string;
  nomorSPJ: string;
  nomorSPP: string;
  jumlahCair: number;
  jumlahSPJ: number;
  sisa: number;
  keterangan: string;
  /** Sub-data baru per revisi klien (SPJ Panjar Kegiatan) */
  rincianSPJ?: SPJRincian[];
  buktiKwitansi?: BuktiTransaksi[];
  potongan?: PotonganPajak[];
}

export interface SisaPanjarItem {
  id: string;
  spjId: string;
  nomorSPJ: string;
  tanggal: string;
  buktiNo: string;
  nominal: number;
  keterangan?: string;
}

export interface JurnalUmumItem {
  id: string;
  tanggal: string;
  kodeBuku: string;
  nomorBukti: string;
  uraian: string;
  posting: boolean;
  rincian: JurnalRincian[];
}

export interface JurnalRincian {
  id: string;
  kodeRekening: string;
  uraian: string;
  debet: number;
  kredit: number;
}

const STORAGE_KEY = 'siskeudes_state';

export interface KegiatanAnggaranItem {
  id: string;
  kodeBidang: string;
  kodeSubBidang: string;
  kodeKegiatan: string;
  namaKegiatan: string;
  waktuPelaksanaan: string;
  namaPelaksana: string;
  jabatanPelaksana: string;
  keluaran: string;
  volumeKeluaran: string;
  sumberDana: string;
  paguAnggaran: number;
  outputItems: OutputItemState[];
}

export interface OutputItemState {
  id: string;
  namaPaket: string;
  nilai: number;
  targetOutput: string;
  satuan: string;
  sumberDana: string;
  keterangan: string;
}

/** Versioning meta for merge-on-receive */
export interface EntityMeta {
  v: number;
  t: number;
  by: string; // session id
}

export interface AppState {
  pendapatan: PendapatanItem[];
  belanja: BelanjaItem[];
  pembiayaan: PembiayaanItem[];
  penerimaan: PenerimaanItem[];
  silpa: SilpaItem[];
  spp: SPPItem[];
  pencairan: PencairanSPP[];
  penyetoranPajak: PenyetoranPajak[];
  saldoAwal: SaldoAwalItem[];
  spjPanjar: SPJPanjarItem[];
  sisaPanjar?: SisaPanjarItem[];
  jurnalUmum: JurnalUmumItem[];
  kegiatanAnggaran: KegiatanAnggaranItem[];
  /** key: `${collection}:${id}` → version meta. Used by merge engine. */
  __meta?: Record<string, EntityMeta>;
}

const defaultState: AppState = {
  pendapatan: [],
  belanja: [],
  pembiayaan: [],
  penerimaan: [],
  silpa: [],
  spp: [],
  pencairan: [],
  penyetoranPajak: [],
  saldoAwal: [],
  spjPanjar: [],
  sisaPanjar: [],
  jurnalUmum: [],
  kegiatanAnggaran: [],
  __meta: {},
};

const COLLECTIONS = [
  'pendapatan','belanja','pembiayaan','penerimaan','silpa','spp',
  'pencairan','penyetoranPajak','saldoAwal','spjPanjar','sisaPanjar',
  'jurnalUmum','kegiatanAnggaran',
] as const;

const LAMPORT_KEY = "siskeudes_lamport_clock";

function getLamport(): number {
  try {
    return Math.max(0, Math.floor(Number(localStorage.getItem(LAMPORT_KEY) || "0") || 0));
  } catch {
    return 0;
  }
}

function setLamport(val: number) {
  try {
    localStorage.setItem(LAMPORT_KEY, String(Math.max(0, Math.floor(val || 0))));
  } catch {}
}

function bumpLamport(remoteMax = 0): number {
  const next = Math.max(getLamport(), Math.max(0, Math.floor(remoteMax || 0))) + 1;
  setLamport(next);
  return next;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...defaultState, ...parsed, __meta: parsed.__meta || {} };
  } catch {
    return { ...defaultState };
  }
}

/**
 * Bump version metadata for entities that changed compared to previous state.
 * Called inside saveState so every write also stamps versions.
 */
function bumpVersions(prev: AppState, next: AppState): AppState {
  const me = (() => { try { return getSessionId(); } catch { return 'local'; } })();
  const meta: Record<string, EntityMeta> = { ...(next.__meta || prev.__meta || {}) };
  const t = bumpLamport();
  for (const col of COLLECTIONS) {
    const prevArr = (prev[col] as { id: string }[] | undefined) || [];
    const nextArr = (next[col] as { id: string }[] | undefined) || [];
    const prevMap = new Map(prevArr.map(x => [x.id, x]));
    const nextMap = new Map(nextArr.map(x => [x.id, x]));
    // Updated or new
    for (const [id, item] of nextMap) {
      const before = prevMap.get(id);
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
        const cur = meta[`${col}:${id}`];
        meta[`${col}:${id}`] = { v: (cur?.v || 0) + 1, t, by: me };
      }
    }
    // Deleted: leave a tombstone so merge knows
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        const cur = meta[`${col}:${id}`];
        meta[`${col}:${id}`] = { v: (cur?.v || 0) + 1, t, by: me };
        meta[`${col}:${id}__deleted`] = { v: 1, t, by: me };
      }
    }
  }
  return { ...next, __meta: meta };
}

/**
 * Three-way merge of incoming remote state into local state, per-entity by id.
 * - Higher meta.v wins; tie → newer t wins; tie → remote wins (deterministic).
 * - Tombstones (`${col}:${id}__deleted`) remove the entity if their version >= local v.
 * - Collections without ids (or scalars) are last-write-wins by overall meta timestamp.
 */
export function mergeStates(local: AppState, remote: Partial<AppState>): AppState {
  const out: AppState = { ...local, __meta: { ...(local.__meta || {}) } };
  const remoteMeta = remote.__meta || {};
  const meta = out.__meta!;

  const winner = (col: string, id: string) => {
    const a = meta[`${col}:${id}`];
    const b = remoteMeta[`${col}:${id}`];
    if (!a) return 'remote';
    if (!b) return 'local';
    if (b.v > a.v) return 'remote';
    if (b.v < a.v) return 'local';
    if (b.t > a.t) return 'remote';
    if (b.t < a.t) return 'local';
    const c = String(b.by || '').localeCompare(String(a.by || ''));
    if (c > 0) return 'remote';
    if (c < 0) return 'local';
    return 'remote';
  };

  for (const col of COLLECTIONS) {
    const localArr = (local[col] as { id: string }[] | undefined) || [];
    const remoteArr = (remote[col] as { id: string }[] | undefined) || [];
    const map = new Map<string, { id: string }>();
    for (const x of localArr) map.set(x.id, x);
    for (const r of remoteArr) {
      const w = winner(col, r.id);
      if (w === 'remote') map.set(r.id, r);
    }
    // Apply tombstones
    for (const key of Object.keys(remoteMeta)) {
      if (!key.startsWith(`${col}:`) || !key.endsWith('__deleted')) continue;
      const id = key.slice(col.length + 1, -('__deleted'.length));
      const w = winner(col, id);
      if (w === 'remote') map.delete(id);
    }
    // Merge meta
    for (const [k, v] of Object.entries(remoteMeta)) {
      if (!k.startsWith(`${col}:`)) continue;
      const cur = meta[k];
      if (!cur) {
        meta[k] = v;
        continue;
      }
      if (v.v > cur.v) {
        meta[k] = v;
        continue;
      }
      if (v.v < cur.v) continue;
      if (v.t > cur.t) {
        meta[k] = v;
        continue;
      }
      if (v.t < cur.t) continue;
      const c = String(v.by || '').localeCompare(String((cur as any).by || ''));
      if (c > 0) meta[k] = v;
    }
    (out as unknown as Record<string, unknown[]>)[col] = Array.from(map.values());
  }
  const remoteMax = (() => {
    let maxT = 0;
    for (const v of Object.values(remoteMeta)) {
      if (v && typeof v === "object" && typeof (v as any).t === "number") {
        const t = Math.floor((v as any).t || 0);
        if (t > maxT) maxT = t;
      }
    }
    return maxT;
  })();
  if (remoteMax > 0) setLamport(Math.max(getLamport(), remoteMax));
  return out;
}

// Debounced backend push so a burst of saveState() calls collapses into ONE round-trip.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;

function flushPush() {
  pushTimer = null;
  const state = pendingState;
  pendingState = null;
  if (!state) return;
  try {
    if (localStorage.getItem('siskeudes_admin_impersonate')) return;
    const pauseUntil = (() => {
      try { return Number(localStorage.getItem('siskeudes_sync_pause_until') || '0'); } catch { return 0; }
    })();
    if (pauseUntil && Date.now() < pauseUntil) return;
    const workMode = (() => {
      try { return localStorage.getItem('siskeudes_work_mode') || 'individual'; } catch { return 'individual'; }
    })();
    const groupId = (() => {
      try { return localStorage.getItem('siskeudes_group_id'); } catch { return null; }
    })();
    const mutasiKas = (() => {
      try {
        const raw = localStorage.getItem('siskeudes_mutasi_kas');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();
    const payload = { ...state, mutasiKas } as unknown as Record<string, unknown>;
    localStorage.setItem('siskeudes_last_local_write_at', String(Date.now()));
    if (workMode === 'group' && groupId && isConvexEnabled && convex) {
      const sessionId = getSessionId();
      void convex.mutation(anyApi.groupStates.merge, {
        groupId: groupId as never,
        sessionId,
        state: payload,
      });
    } else {
      void upsertSession({ form_data: payload });
    }
  } catch { /* ignore */ }
}

export function saveState(state: AppState) {
  const prev = loadState();
  const stamped = bumpVersions(prev, state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  try { localStorage.setItem('siskeudes_app_state', JSON.stringify(stamped)); } catch { /* ignore */ }

  pendingState = stamped;
  if (pushTimer) clearTimeout(pushTimer);
  const delay = (() => {
    try { return localStorage.getItem('siskeudes_work_mode') === 'group' ? 1200 : 800; } catch { return 800; }
  })();
  pushTimer = setTimeout(flushPush, delay);
}

export function flushSaveStateNow() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  flushPush();
}
