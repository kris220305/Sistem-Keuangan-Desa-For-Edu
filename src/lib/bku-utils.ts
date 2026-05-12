import type { BKUJenis } from "@/lib/bku-engine";

export function sanitizeFilePart(s: string) {
  return (s || "")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function formatPeriodeKey(start: string, end: string) {
  const a = (start || "").replace(/-/g, "");
  const b = (end || "").replace(/-/g, "");
  if (!a && !b) return "periode";
  if (a && !b) return a;
  if (!a && b) return b;
  return `${a}-${b}`;
}

export function formatTanggalId(tanggalIso: string) {
  if (!tanggalIso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalIso);
  if (!m) return tanggalIso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatJenisLabel(jenis: BKUJenis) {
  if (jenis === "utama") return "UTAMA";
  if (jenis === "tunai") return "TUNAI";
  return "BANK";
}

export function buildBkuFilename(params: { jenis: BKUJenis; unit: string; start: string; end: string; ext: "pdf" | "xlsx" }) {
  const jenisPart = formatJenisLabel(params.jenis);
  const unitPart = sanitizeFilePart(params.unit || "unit");
  const periodePart = formatPeriodeKey(params.start, params.end);
  return `BKU_${jenisPart}_${unitPart}_${periodePart}.${params.ext}`;
}

