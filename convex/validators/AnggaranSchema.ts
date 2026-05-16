import { v } from "convex/values";

const EntityMetaSchema = v.object({
  v: v.number(),
  t: v.number(),
  by: v.optional(v.string()),
});

// Use v.any() for entity arrays because each collection has different fields
// (pendapatan has kodeRekening/anggaran, belanja has kodeBidang/kodeKegiatan, etc.)
// The strict v.object({ id: v.string() }) rejects objects with extra fields.
export const AnggaranSchema = v.object({
  pendapatan: v.optional(v.array(v.any())),
  belanja: v.optional(v.array(v.any())),
  pembiayaan: v.optional(v.array(v.any())),
  penerimaan: v.optional(v.array(v.any())),
  silpa: v.optional(v.array(v.any())),
  spp: v.optional(v.array(v.any())),
  pencairan: v.optional(v.array(v.any())),
  penyetoranPajak: v.optional(v.array(v.any())),
  saldoAwal: v.optional(v.array(v.any())),
  spjPanjar: v.optional(v.array(v.any())),
  sisaPanjar: v.optional(v.array(v.any())),
  jurnalUmum: v.optional(v.array(v.any())),
  kegiatanAnggaran: v.optional(v.array(v.any())),
  __meta: v.optional(v.any()),
  mutasiKas: v.optional(v.array(v.any())),
});
