import { v } from "convex/values";

const EntityMetaSchema = v.object({
  v: v.number(),
  t: v.number(),
  by: v.optional(v.string()),
});

const EntityWithIdSchema = v.object({
  id: v.string(),
});

export const AnggaranSchema = v.object({
  pendapatan: v.optional(v.array(EntityWithIdSchema)),
  belanja: v.optional(v.array(EntityWithIdSchema)),
  pembiayaan: v.optional(v.array(EntityWithIdSchema)),
  penerimaan: v.optional(v.array(EntityWithIdSchema)),
  silpa: v.optional(v.array(EntityWithIdSchema)),
  spp: v.optional(v.array(EntityWithIdSchema)),
  pencairan: v.optional(v.array(EntityWithIdSchema)),
  penyetoranPajak: v.optional(v.array(EntityWithIdSchema)),
  saldoAwal: v.optional(v.array(EntityWithIdSchema)),
  spjPanjar: v.optional(v.array(EntityWithIdSchema)),
  sisaPanjar: v.optional(v.array(EntityWithIdSchema)),
  jurnalUmum: v.optional(v.array(EntityWithIdSchema)),
  kegiatanAnggaran: v.optional(v.array(EntityWithIdSchema)),
  __meta: v.optional(v.record(v.string(), EntityMetaSchema)),
  mutasiKas: v.optional(v.array(v.any())),
});

