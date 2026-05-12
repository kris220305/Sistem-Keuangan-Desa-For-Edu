import type { MutasiKasItem } from "@/data/mutasi-kas";

export type MutasiKasAuditAction = "create" | "delete";

export interface MutasiKasAuditItem {
  id: string;
  at: number;
  action: MutasiKasAuditAction;
  mutasiId: string;
  bySessionId?: string;
  byName?: string;
  mutasi?: MutasiKasItem;
  source?: { type: string; id?: string };
}

export const MUTASI_KAS_AUDIT_STORAGE_KEY = "siskeudes_mutasi_kas_audit";

export function loadMutasiKasAudit(): MutasiKasAuditItem[] {
  try {
    const r = localStorage.getItem(MUTASI_KAS_AUDIT_STORAGE_KEY);
    const parsed = r ? (JSON.parse(r) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as MutasiKasAuditItem[]) : [];
  } catch {
    return [];
  }
}

export function saveMutasiKasAudit(items: MutasiKasAuditItem[]) {
  localStorage.setItem(MUTASI_KAS_AUDIT_STORAGE_KEY, JSON.stringify(items));
}

export function appendMutasiKasAudit(item: MutasiKasAuditItem) {
  const existing = loadMutasiKasAudit();
  const next = [...existing, item].slice(-1000);
  saveMutasiKasAudit(next);
}

