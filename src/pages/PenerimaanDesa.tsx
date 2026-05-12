import { Fragment, useState, useEffect, useMemo, type TableHTMLAttributes } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { getSessionId, trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { loadState, saveState, type PenerimaanItem, type PenerimaanRincian, type SilpaItem, type SilpaRincian } from "@/data/app-state";
import { getPendapatanOptions } from "@/lib/financial-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { loadMutasiKas, saveMutasiKasLocal } from "@/data/mutasi-kas";
import { saveMutasiKasAndSync } from "@/lib/mutasi-kas-sync";
import { appendMutasiKasAudit } from "@/data/mutasi-kas-audit";
import { applyAutoMutasiForPenerimaanTunai } from "@/lib/penerimaan-tunai-mutasi";
import { Combobox } from "@/components/ui/combobox";
import { terbilangRupiah } from "@/lib/terbilang-id";
import { Banknote, Landmark, Layers, Printer, Plus, Pencil, Trash2, X, Save, DoorOpen, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import bgSawah from "@/assets/bg-sawah-sunset.jpg";

type Mode = "view" | "tambah" | "ubah";
type ActiveTab = "silpa" | "tunai" | "bank";

const cx = (...v: Array<string | false | null | undefined>) => v.filter(Boolean).join(" ");

function RawTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cx("w-full caption-bottom text-sm", className)} {...props} />;
}

// ===================== SILPA TAB =====================
function SilpaTab() {
  const [items, setItems] = useState<SilpaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [detailTab, setDetailTab] = useState<"data" | "rincian">("data");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  const rekeningAset = getRekeningDetail("aset");

  const emptyForm: Omit<SilpaItem, "id"> = {
    tanggal: "", nomorBukti: "", uraian: "", isProses: false, rincian: [],
  };
  const [form, setForm] = useState(emptyForm);
  const [rincianForm, setRincianForm] = useState<Omit<SilpaRincian, "id">>({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });

  useEffect(() => { setItems(loadState().silpa || []); }, []);
  useEffect(() => { if (mode !== "view") setDetailTab("data"); }, [mode]);
  useEffect(() => {
    if (mode !== "view" || selectedId) setMobilePane("detail");
  }, [mode, selectedId]);

  const save = (newItems: SilpaItem[]) => {
    setItems(newItems);
    const state = loadState();
    state.silpa = newItems;
    saveState(state);
  };

  const selectedItem = items.find(i => i.id === selectedId);
  const totalDebet = (selectedItem || (mode !== "view" ? { rincian: form.rincian } : null))?.rincian.reduce((s, r) => s + r.debet, 0) || 0;
  const totalKredit = (selectedItem || (mode !== "view" ? { rincian: form.rincian } : null))?.rincian.reduce((s, r) => s + r.kredit, 0) || 0;

  const draftKey = "siskeudes_draft_silpa";
  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch {}
  };

  useEffect(() => {
    if (mode !== "tambah") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object") return;
      setForm({ ...emptyForm, ...parsed });
    } catch {}
  }, [mode]);

  useEffect(() => {
    if (mode === "view") return;
    const t = window.setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [form, mode]);

  const handleTambah = () => { setMode("tambah"); setSelectedId(null); setForm({ ...emptyForm, rincian: [] }); setDetailTab("data"); };
  const handleUbah = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan diubah");
    setMode("ubah"); setForm({ ...selectedItem }); setDetailTab("data");
  };
  const handleHapus = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan dihapus");
    if (!confirm("Yakin hapus data ini?")) return;
    save(items.filter(i => i.id !== selectedItem.id)); setSelectedId(null); toast.success("Data dihapus");
  };
  const handleBatal = () => { clearDraft(); setMode("view"); setForm(emptyForm); setDetailTab("data"); setMobilePane("list"); };
  const handleSimpan = () => {
    if (!form.tanggal) return toast.error("Isi tanggal");
    if (!form.nomorBukti) return toast.error("Isi nomor bukti / ref");
    if (!form.uraian) return toast.error("Isi uraian");
    if (!form.rincian || form.rincian.length === 0) return toast.error("Isi minimal 1 rincian");
    const totDeb = form.rincian.reduce((s, r) => s + (Number(r.debet) || 0), 0);
    const totKre = form.rincian.reduce((s, r) => s + (Number(r.kredit) || 0), 0);
    if (totDeb <= 0 && totKre <= 0) return toast.error("Total rincian harus lebih dari 0");
    if (totDeb !== totKre) return toast.error("Total debet dan kredit harus sama");
    if (mode === "ubah" && selectedId) {
      save(items.map(i => i.id === selectedId ? { ...i, ...form } : i));
      toast.success("Data diperbarui");
    } else {
      const newItem: SilpaItem = { id: crypto.randomUUID(), ...form };
      save([...items, newItem]); setSelectedId(newItem.id);
      toast.success("Data SiLPA ditambahkan");
    }
    clearDraft();
    setMode("view"); setForm(emptyForm); setDetailTab("data");
    trackFormProgress("penerimaan");
  };

  const handleProses = () => {
    if (!selectedItem) return toast.error("Pilih data");
    save(items.map(i => i.id === selectedItem.id ? { ...i, isProses: true } : i));
    toast.success("Data diproses");
  };
  const handleUnProses = () => {
    if (!selectedItem) return toast.error("Pilih data");
    save(items.map(i => i.id === selectedItem.id ? { ...i, isProses: false } : i));
    toast.success("Data di-unproses");
  };

  const addRincian = () => {
    if (!rincianForm.kodeRekening) return toast.error("Pilih rekening rincian");
    const debet = Number(rincianForm.debet) || 0;
    const kredit = Number(rincianForm.kredit) || 0;
    if ((debet <= 0 && kredit <= 0) || (debet > 0 && kredit > 0)) return toast.error("Isi Debet atau Kredit (salah satu) dan lebih dari 0");
    const newR: SilpaRincian = { id: crypto.randomUUID(), ...rincianForm };
    setForm({ ...form, rincian: [...form.rincian, newR] });
    setRincianForm({ kodeRekening: "", namaRekening: "", debet: 0, kredit: 0 });
  };
  const removeRincian = (id: string) => {
    setForm({ ...form, rincian: form.rincian.filter(r => r.id !== id) });
  };

  const displayRincian = mode !== "view" ? form.rincian : (selectedItem?.rincian || []);
  const progressValue = detailTab === "data" ? 50 : 100;

  return (
    <div className="h-full min-h-0 flex flex-col border border-[#8e8e8e] bg-[#efefef] overflow-hidden">
      <div className="bg-gradient-to-b from-[#0b8a1f] to-[#c7f3c7] border-b border-[#8e8e8e]">
        <div className="py-2 text-center font-bold tracking-wide text-[#b91c1c] text-[13px]">REALISASI SILPA TAHUN SEBELUMNYA</div>
      </div>

      <div className="px-3 pt-3 lg:hidden">
        <div className="inline-flex border border-[#c8c8c8] bg-white/70">
          <button
            type="button"
            onClick={() => setMobilePane("list")}
            className={cx(
              "px-3 h-9 text-[13px] border-r border-[#c8c8c8] flex items-center gap-2",
              mobilePane === "list" ? "bg-[#0b74d1] text-white" : "bg-transparent text-[#1f2937]",
            )}
          >
            <List className="h-4 w-4" />
            Daftar
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("detail")}
            className={cx(
              "px-3 h-9 text-[13px] flex items-center gap-2",
              mobilePane === "detail" ? "bg-[#0b74d1] text-white" : "bg-transparent text-[#1f2937]",
            )}
          >
            Detail
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid gap-3 p-3 lg:grid-cols-2">
      <div className={cx("min-h-0 border border-[#8e8e8e] bg-white overflow-hidden flex flex-col", mobilePane === "list" ? "flex" : "hidden", "lg:flex")}>
        <div className="px-3 py-2 flex items-center justify-between bg-[#f4f4f4] border-b border-[#d0d0d0] text-[#111827]">
          <div className="text-[12px] font-semibold">Daftar SiLPA</div>
          <div className="text-[11px] text-muted-foreground">{items.length} data</div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <RawTable className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-[#f4f4f4] sticky top-0 z-10">
                <TableHead className="h-10 px-3 text-[12px] font-semibold w-[120px]">Tanggal</TableHead>
                <TableHead className="h-10 px-3 text-[12px] font-semibold w-[240px]">Nomor Bukti / Ref</TableHead>
                <TableHead className="h-10 px-3 text-[12px] font-semibold">Uraian</TableHead>
                <TableHead className="h-10 px-3 text-[12px] font-semibold text-center w-[110px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">Belum ada data SiLPA</TableCell></TableRow>
              ) : items.map((item, idx) => {
                const active = selectedId === item.id;
                return (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer transition-colors ${active ? "bg-[#0b74d1] text-white" : (idx % 2 ? "bg-white/60" : "bg-transparent")} hover:bg-[#f0fdf4]`}
                    onClick={() => { if (mode === "view") setSelectedId(item.id); }}
                  >
                      <TableCell className="px-3 py-2 text-[13px] whitespace-nowrap">{item.tanggal}</TableCell>
                      <TableCell className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{item.nomorBukti}</TableCell>
                      <TableCell className="px-3 py-2 text-[13px]">
                        <div className="truncate max-w-[240px] sm:max-w-[360px] md:max-w-[520px] lg:max-w-[720px]" title={item.uraian}>{item.uraian}</div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-[13px] text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.isProses ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef9c3] text-[#854d0e]"}`}>
                          {item.isProses ? "Proses" : "Belum"}
                        </span>
                      </TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </RawTable>
        </div>
      </div>

      <div className={cx("flex-1 min-h-0 border border-[#8e8e8e] bg-white overflow-hidden flex flex-col", mobilePane === "detail" ? "flex" : "hidden", "lg:flex")}>
        <div className="px-3 py-2 flex items-center justify-between border-b border-[#d0d0d0] bg-[#f4f4f4]">
          <div className="text-[12px] font-semibold text-[#111827]">Detail</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleProses} disabled={mode !== "view" || !selectedItem}>
              Proses
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleUnProses} disabled={mode !== "view" || !selectedItem}>
              UnProses
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-3 md:p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <Progress value={progressValue} className="h-2 bg-[#d1fae5]" />
            </div>
            <div className="text-[11px] text-muted-foreground">{progressValue}%</div>
          </div>

          {(selectedItem || mode !== "view") ? (
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)} className="h-full min-h-0 flex flex-col">
              <TabsList className="bg-[#f4f4f4] border border-[#d0d0d0] rounded-none p-1 h-10 justify-start overflow-x-auto">
                <TabsTrigger value="data" className="text-[13px]">Data</TabsTrigger>
                <TabsTrigger value="rincian" className="text-[13px]">Rincian</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="mt-3 flex-1 min-h-0 overflow-auto">
                <div className="border border-[#d0d0d0] bg-white p-4">
                  <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-x-4 gap-y-3 items-center text-[13px]">
                    <Label className="text-[13px]">Tanggal</Label>
                    {mode !== "view" ? (
                      <Input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className="h-10 text-[13px] rounded-none" />
                    ) : (
                      <Input value={selectedItem?.tanggal || ""} readOnly className="h-9 text-[12px] bg-[#f2f2f2] rounded-none" />
                    )}

                    <Label className="text-[13px]">Nomor Bukti / Ref</Label>
                    {mode !== "view" ? (
                      <Input value={form.nomorBukti} onChange={e => setForm({ ...form, nomorBukti: e.target.value })} className="h-10 text-[13px] rounded-none" />
                    ) : (
                      <Input value={selectedItem?.nomorBukti || ""} readOnly className="h-9 text-[12px] bg-[#f2f2f2] rounded-none" />
                    )}

                    <Label className="text-[13px]">Uraian</Label>
                    {mode !== "view" ? (
                      <Input value={form.uraian} onChange={e => setForm({ ...form, uraian: e.target.value })} className="h-10 text-[13px] rounded-none" />
                    ) : (
                      <Input value={selectedItem?.uraian || ""} readOnly className="h-9 text-[12px] bg-[#f2f2f2] rounded-none" />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rincian" className="mt-3 flex-1 min-h-0 overflow-auto">
                <div className="border border-[#d0d0d0] bg-white p-4 overflow-hidden">
                  <div className="text-[12px] font-semibold text-[#14532d] mb-3">Rincian SiLPA Tahun Sebelumnya</div>
                  <div className="border border-[#d0d0d0] bg-white overflow-hidden max-h-[40vh] md:max-h-[46vh] overflow-auto">
                    <RawTable className="min-w-[860px]">
                      <TableHeader>
                        <TableRow className="bg-[#f4f4f4] sticky top-0 z-10">
                          <TableHead className="h-10 px-3 text-[12px] font-semibold whitespace-nowrap w-[180px]">RincianSD</TableHead>
                          <TableHead className="h-10 px-3 text-[12px] font-semibold">Nama Rincian</TableHead>
                          <TableHead className="h-10 px-3 text-[12px] font-semibold text-right whitespace-nowrap w-[160px]">Debet</TableHead>
                          <TableHead className="h-10 px-3 text-[12px] font-semibold text-right whitespace-nowrap w-[160px]">Kredit</TableHead>
                          {mode !== "view" && <TableHead className="text-[11px] w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayRincian.length === 0 ? (
                          <TableRow><TableCell colSpan={mode !== "view" ? 5 : 4} className="text-center text-muted-foreground py-6 text-xs">Belum ada rincian</TableCell></TableRow>
                        ) : displayRincian.map(r => (
                          <TableRow key={r.id} className="hover:bg-[#e8f2ff]">
                            <TableCell className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{r.kodeRekening}</TableCell>
                            <TableCell className="px-3 py-2 text-[13px]">{r.namaRekening}</TableCell>
                            <TableCell className="px-3 py-2 text-[13px] text-right tabular-nums">{r.debet.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="px-3 py-2 text-[13px] text-right tabular-nums">{r.kredit.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                            {mode !== "view" && (
                              <TableCell>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive text-[11px]" onClick={() => removeRincian(r.id)}>Hapus</Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        <TableRow className="bg-[#f4f4f4] font-bold">
                          <TableCell colSpan={2} className="px-3 py-2 text-[13px] text-right">Total</TableCell>
                          <TableCell className="px-3 py-2 text-[13px] text-right tabular-nums">{totalDebet.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="px-3 py-2 text-[13px] text-right tabular-nums">{totalKredit.toLocaleString("id-ID", { minimumFractionDigits: 2 })}</TableCell>
                          {mode !== "view" && <TableCell />}
                        </TableRow>
                      </TableBody>
                    </RawTable>
                  </div>

                  {mode !== "view" && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-[11px]">Kd Rincian</Label>
                          <Select value={rincianForm.kodeRekening} onValueChange={v => {
                            const r = rekeningAset.find(x => x.kode === v);
                            setRincianForm({ ...rincianForm, kodeRekening: v, namaRekening: r?.uraian || "" });
                          }}>
                            <SelectTrigger className="h-10 text-[13px] rounded-none"><SelectValue placeholder="Pilih" /></SelectTrigger>
                            <SelectContent>{rekeningAset.map(r => <SelectItem key={r.kode} value={r.kode}>{r.kode}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px]">Nama Rincian</Label>
                          <Input value={rincianForm.namaRekening} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                        </div>
                        <div>
                          <Label className="text-[11px]">Debet</Label>
                          <Input type="number" value={rincianForm.debet || ""} onChange={e => setRincianForm({ ...rincianForm, debet: Number(e.target.value) })} className="h-10 text-[13px] text-right tabular-nums rounded-none" />
                        </div>
                        <div>
                          <Label className="text-[11px]">Kredit</Label>
                          <Input type="number" value={rincianForm.kredit || ""} onChange={e => setRincianForm({ ...rincianForm, kredit: Number(e.target.value) })} className="h-10 text-[13px] text-right tabular-nums rounded-none" />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" className="h-9 text-[12px] rounded-none" onClick={addRincian}>Tambah</Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Pilih data atau klik Tambah untuk mulai
            </div>
          )}
        </div>

        <div className="border-t border-[#8e8e8e] bg-[#f4f4f4] px-4 py-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleTambah} disabled={mode !== "view"}>
            <Plus className="h-4 w-4 mr-2" /> Tambah
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleUbah} disabled={mode !== "view"}>
            <Pencil className="h-4 w-4 mr-2" /> Ubah
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none text-destructive" onClick={handleHapus} disabled={mode !== "view"}>
            <Trash2 className="h-4 w-4 mr-2" /> Hapus
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleBatal} disabled={mode === "view"}>
            <X className="h-4 w-4 mr-2" /> Batal
          </Button>
          <Button size="sm" className="h-9 text-[12px] rounded-none" onClick={handleSimpan} disabled={mode === "view"}>
            <Save className="h-4 w-4 mr-2" /> Simpan
          </Button>
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground">Record {items.length > 0 ? (items.findIndex(i => i.id === selectedId) + 1) : 0}/{items.length}</span>
          <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={() => window.history.back()}>
            <DoorOpen className="h-4 w-4 mr-2" /> Tutup
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ===================== PENERIMAAN (TUNAI/BANK) TAB =====================
function PenerimaanTab({ jenis }: { jenis: "tunai" | "bank" }) {
  const [allItems, setAllItems] = useState<PenerimaanItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [detailTab, setDetailTab] = useState<"input" | "rincian">("input");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMutasiTunai, setPreviewMutasiTunai] = useState(false);

  const rekeningPendapatan = getRekeningDetail("pendapatan");

  const emptyForm: Omit<PenerimaanItem, "id"> = {
    jenis, tanggal: "", noBukti: "", uraian: "", jumlah: 0,
    kodeRekening: "", namaRekening: "", penyetor: "", nama: "", alamat: "", ttd: "",
    rekening: "", namaBank: "", kppn: "", rincian: [],
  };
  const [form, setForm] = useState(emptyForm);
  const [rincianForm, setRincianForm] = useState<Omit<PenerimaanRincian, "id">>({ kodeRekening: "", namaRekening: "", sumberDana: "", nilai: 0 });

  useEffect(() => { setAllItems(loadState().penerimaan || []); }, []);

  useEffect(() => {
    if (mode === "view") return;
    setDetailTab("input");
  }, [mode]);

  useEffect(() => {
    if (mode !== "view" || selectedId) setMobilePane("detail");
  }, [mode, selectedId]);

  const items = allItems.filter(i => i.jenis === jenis);
  const lastTemplate = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) return items[i];
    return undefined;
  }, [items]);

  const save = (newAll: PenerimaanItem[]) => {
    setAllItems(newAll);
    const state = loadState();
    state.penerimaan = newAll;
    saveState(state);
  };

  const selectedItem = allItems.find(i => i.id === selectedId);

  const namaSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.nama) s.add(it.nama);
    return Array.from(s).slice(0, 100);
  }, [items]);
  const rekeningSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.rekening) s.add(it.rekening);
    return Array.from(s).slice(0, 100);
  }, [items]);
  const namaBankSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.namaBank) s.add(it.namaBank);
    return Array.from(s).slice(0, 100);
  }, [items]);
  const kppnSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.kppn) s.add(it.kppn);
    return Array.from(s).slice(0, 100);
  }, [items]);
  const alamatSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.alamat) s.add(it.alamat);
    return Array.from(s).slice(0, 100);
  }, [items]);
  const ttdSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.ttd) s.add(it.ttd);
    return Array.from(s).slice(0, 100);
  }, [items]);

  const generateNoBukti = () => {
    const count = items.length + 1;
    return `${String(count).padStart(4, "0")}/TBP/05.2001/2024`;
  };

  const draftKey = useMemo(() => `siskeudes_draft_penerimaan_${jenis}`, [jenis]);
  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch {}
  };

  useEffect(() => {
    if (mode !== "tambah") return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object") return;
      setForm((prev) => ({ ...prev, ...parsed, jenis }));
    } catch {}
  }, [draftKey, jenis, mode]);

  useEffect(() => {
    if (mode === "view") return;
    const t = window.setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
    }, 500);
    return () => window.clearTimeout(t);
  }, [draftKey, form, mode]);

  const handleTambah = () => {
    const today = new Date().toISOString().slice(0, 10);
    setMode("tambah");
    setSelectedId(null);
    setForm({ ...emptyForm, tanggal: today, noBukti: generateNoBukti() });
    setDetailTab("input");
  };
  const handleUbah = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan diubah");
    setMode("ubah"); setForm({ ...selectedItem }); setDetailTab("input");
  };
  const handleHapus = () => {
    if (!selectedItem) return toast.error("Pilih data yang akan dihapus");
    if (!confirm("Yakin hapus data ini?")) return;
    save(allItems.filter(i => i.id !== selectedItem.id)); setSelectedId(null); toast.success("Data dihapus");
  };
  const handleBatal = () => { clearDraft(); setMode("view"); setForm(emptyForm); setDetailTab("input"); setMobilePane("list"); };

  const handleSimpan = (opts?: { catatMutasiTunai?: boolean }) => {
    if (!form.tanggal) return toast.error("Isi tanggal");
    if (!form.uraian) return toast.error("Isi uraian");
    const noBukti = form.noBukti || generateNoBukti();
    // Auto-calc jumlah from rincian
    const jumlah = form.rincian.length > 0 ? form.rincian.reduce((s, r) => s + r.nilai, 0) : form.jumlah;
    if (!jumlah || jumlah <= 0) return toast.error("Jumlah harus lebih dari 0");
    if (!form.nama) return toast.error("Isi nama penyetor");
    if (jenis === "bank") {
      if (!form.rekening) return toast.error("Isi rekening");
      if (!form.namaBank) return toast.error("Isi nama bank");
    }

    const now = Date.now();
    const actor = {
      sessionId: (() => { try { return getSessionId(); } catch { return undefined; } })(),
      name: (() => { try { return localStorage.getItem("siskeudes_user_name") || ""; } catch { return ""; } })(),
    };

    let saved: PenerimaanItem;
    let nextAll: PenerimaanItem[];
    if (mode === "ubah" && selectedId) {
      saved = { ...(selectedItem as PenerimaanItem), ...form, jenis, noBukti, jumlah };
      nextAll = allItems.map(i => i.id === selectedId ? saved : i);
    } else {
      saved = { id: crypto.randomUUID(), ...form, jenis, noBukti, jumlah };
      nextAll = [...allItems, saved];
    }

    const catatMutasiTunai = !!opts?.catatMutasiTunai && jenis === "tunai";
    if (catatMutasiTunai) {
      try {
        const mutasi = loadMutasiKas();
        const res = applyAutoMutasiForPenerimaanTunai(mutasi, saved, actor, now);
        saveMutasiKasAndSync(res.mutasiKas, saveMutasiKasLocal);
        if (res.created) {
          appendMutasiKasAudit({
            id: crypto?.randomUUID ? crypto.randomUUID() : String(now),
            at: now,
            action: "create",
            mutasiId: res.created.id,
            bySessionId: actor.sessionId,
            byName: actor.name,
            mutasi: res.created,
            source: { type: "penerimaan", id: saved.id },
          });
        }
      } catch (e) {
        toast.error("Penerimaan tersimpan, tetapi gagal mencatat ke mutasi tunai.");
      }
    }

    save(nextAll);
    setSelectedId(saved.id);
    toast.success(mode === "ubah" ? "Data diperbarui" : (catatMutasiTunai ? "Penerimaan dicatat ke mutasi tunai" : "Penerimaan ditambahkan"));
    clearDraft();
    setMode("view"); setForm(emptyForm); setDetailTab("input"); setMobilePane("list");
    trackFormProgress("penerimaan");
  };

  const addRincian = () => {
    if (!rincianForm.kodeRekening) return toast.error("Pilih rekening rincian");
    if (rincianForm.nilai <= 0) return toast.error("Nilai harus > 0");
    // Bridge ke Pendapatan: warning-only jika melebihi sisa anggaran
    const opts = getPendapatanOptions(loadState());
    const opt = opts.find(o => o.kodeRekening === rincianForm.kodeRekening);
    if (opt && rincianForm.nilai > opt.sisa) {
      toast.warning(`Nilai melebihi sisa anggaran Pendapatan (Rp ${opt.sisa.toLocaleString("id-ID")}). Tetap disimpan.`);
    }
    const newR: PenerimaanRincian = { id: crypto.randomUUID(), ...rincianForm };
    const newRincian = [...form.rincian, newR];
    setForm({ ...form, rincian: newRincian, jumlah: newRincian.reduce((s, r) => s + r.nilai, 0) });
    setRincianForm({ kodeRekening: "", namaRekening: "", sumberDana: "", nilai: 0 });
  };
  const removeRincian = (id: string) => {
    const newRincian = form.rincian.filter(r => r.id !== id);
    setForm({ ...form, rincian: newRincian, jumlah: newRincian.reduce((s, r) => s + r.nilai, 0) });
  };

  const displayRincian = mode !== "view" ? form.rincian : (selectedItem?.rincian || []);
  const title = jenis === "tunai" ? "REALISASI PENERIMAAN TUNAI" : "REALISASI PENERIMAAN BANK";

  const calcJumlah = useMemo(() => {
    const jumlah = form.rincian.length > 0 ? form.rincian.reduce((s, r) => s + (r.nilai || 0), 0) : (form.jumlah || 0);
    return Number(jumlah || 0);
  }, [form.jumlah, form.rincian]);

  const errors = useMemo(() => {
    if (mode === "view") return {} as Record<string, string>;
    const e: Record<string, string> = {};
    if (!form.tanggal) e.tanggal = "Wajib diisi";
    if (!form.uraian) e.uraian = "Wajib diisi";
    if (!calcJumlah || calcJumlah <= 0) e.jumlah = "Harus lebih dari 0";
    if (!form.nama) e.nama = "Wajib diisi";
    if (jenis === "bank") {
      if (!form.rekening) e.rekening = "Wajib diisi";
      if (!form.namaBank) e.namaBank = "Wajib diisi";
    }
    return e;
  }, [mode, form.tanggal, form.uraian, form.nama, form.rekening, form.namaBank, calcJumlah, jenis]);

  const invalid = (k: string) => !!errors[k];

  const terbilang = useMemo(() => terbilangRupiah(calcJumlah), [calcJumlah]);
  const fmt = (n: number) => (n || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const steps = useMemo(() => {
    const s: Array<{ id: "input" | "rincian"; label: string }> = [
      { id: "input", label: "Input" },
      { id: "rincian", label: "Rincian" },
    ];
    return s;
  }, []);
  const progressValue = useMemo(() => {
    const idx = steps.findIndex((x) => x.id === detailTab);
    const safe = idx < 0 ? 0 : idx;
    return ((safe + 1) / Math.max(steps.length, 1)) * 100;
  }, [detailTab, steps]);

  const rincianOptions = useMemo(() => {
    const opts = getPendapatanOptions(loadState());
    return opts.map((o) => ({
      value: o.kodeRekening,
      label: `${o.kodeRekening} — ${o.namaRekening}`,
      keywords: `${o.sumberDana} ${o.sisa}`,
    }));
  }, [allItems.length, mode]);

  const rincianInfo = useMemo(() => {
    const opts = getPendapatanOptions(loadState());
    const map = new Map<string, { sumberDana: string; sisa: number; namaRekening: string }>();
    for (const o of opts) {
      map.set(o.kodeRekening, { sumberDana: o.sumberDana, sisa: o.sisa, namaRekening: o.namaRekening });
    }
    return map;
  }, [allItems.length, mode]);

  const rincianDraft = useMemo(() => {
    const info = rincianInfo.get(rincianForm.kodeRekening);
    const kodeOk = !!rincianForm.kodeRekening;
    const nilaiOk = Number(rincianForm.nilai || 0) > 0;
    const sisa = info?.sisa;
    const over = typeof sisa === "number" && sisa >= 0 && Number(rincianForm.nilai || 0) > sisa;
    return {
      kodeOk,
      nilaiOk,
      canAdd: kodeOk && nilaiOk,
      sumberDana: rincianForm.sumberDana || info?.sumberDana || "",
      sisa,
      over,
    };
  }, [rincianForm.kodeRekening, rincianForm.nilai, rincianForm.sumberDana, rincianInfo]);

  return (
    <div className="h-full min-h-0 flex flex-col border border-[#8e8e8e] bg-[#efefef] overflow-hidden">
      <div className="bg-gradient-to-b from-[#f3fff3] to-[#d5f5d5] border-b border-[#8e8e8e]">
        <div className="py-2 text-center font-bold tracking-wide text-[#b91c1c] text-[13px]">{title}</div>
      </div>

      <div className="px-3 pt-3 lg:hidden">
        <div className="inline-flex border border-[#c8c8c8] bg-white/70">
          <button
            type="button"
            onClick={() => setMobilePane("list")}
            className={cx(
              "px-3 h-9 text-[13px] border-r border-[#c8c8c8] flex items-center gap-2",
              mobilePane === "list" ? "bg-[#0b74d1] text-white" : "bg-transparent text-[#1f2937]",
            )}
          >
            <List className="h-4 w-4" />
            Daftar
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("detail")}
            className={cx(
              "px-3 h-9 text-[13px] flex items-center gap-2",
              mobilePane === "detail" ? "bg-[#0b74d1] text-white" : "bg-transparent text-[#1f2937]",
            )}
          >
            Detail
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-3 grid gap-3 lg:grid-cols-2">
        <div className={cx("min-h-0 border border-[#8e8e8e] bg-white overflow-hidden flex flex-col", mobilePane === "list" ? "flex" : "hidden", "lg:flex")}>
          <div className="flex-1 min-h-0 overflow-auto">
            <RawTable className="min-w-[860px]">
              <TableHeader>
                <TableRow className="bg-[#f4f4f4] sticky top-0 z-10">
                  <TableHead className="h-10 px-3 w-8"></TableHead>
                  <TableHead className="h-10 px-3 text-[12px] font-semibold whitespace-nowrap w-[120px]">Tanggal</TableHead>
                  <TableHead className="h-10 px-3 text-[12px] font-semibold whitespace-nowrap w-[240px]">No Bukti</TableHead>
                  <TableHead className="h-10 px-3 text-[12px] font-semibold">Uraian</TableHead>
                  <TableHead className="h-10 px-3 text-[12px] font-semibold text-right whitespace-nowrap w-[170px]">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                      Belum ada data
                    </TableCell>
                  </TableRow>
                ) : items.map((item, idx) => {
                  const active = selectedId === item.id;
                  return (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer ${active ? "bg-[#0b74d1] text-white" : (idx % 2 ? "bg-white/70" : "bg-transparent")} hover:bg-[#f0fdf4]`}
                      onClick={() => { if (mode === "view") { setSelectedId(item.id); } }}
                    >
                        <TableCell className="px-3 py-2 text-[13px] text-center font-mono">{active ? "▶" : ""}</TableCell>
                        <TableCell className="px-3 py-2 text-[13px] whitespace-nowrap">{item.tanggal}</TableCell>
                        <TableCell className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{item.noBukti}</TableCell>
                        <TableCell className="px-3 py-2 text-[13px]">
                          <div className="truncate max-w-[260px] sm:max-w-[380px] md:max-w-[560px] lg:max-w-[760px]" title={item.uraian}>{item.uraian}</div>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-[13px] text-right whitespace-nowrap tabular-nums">{fmt(item.jumlah)}</TableCell>
                      </TableRow>
                  );
                })}
              </TableBody>
            </RawTable>
          </div>
        </div>

        <div className={cx("min-h-0 border border-[#8e8e8e] bg-white overflow-hidden flex flex-col", mobilePane === "detail" ? "flex" : "hidden", "lg:flex")}>
          <div className="px-3 py-2 flex items-center justify-between border-b border-[#d0d0d0] bg-[#f4f4f4]">
            <div className="text-[11px] text-muted-foreground">{mode !== "view" ? "Auto-save aktif" : "Pilih data atau klik Tambah untuk mulai input"}</div>
            <div className="w-48 hidden md:block"><Progress value={progressValue} className="h-2 bg-[#e5e5e5]" /></div>
          </div>

          {(selectedItem || mode !== "view") ? (
            <div className="flex-1 min-h-0 overflow-hidden p-3 md:p-4">
              <div className="flex items-center gap-3 mb-3 md:hidden">
                <div className="flex-1">
                  <Progress value={progressValue} className="h-2 bg-[#d1fae5]" />
                </div>
                <div className="text-[11px] text-muted-foreground">{Math.round(progressValue)}%</div>
              </div>

              <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)} className="h-full min-h-0 flex flex-col">
                <TabsList className="bg-[#f4f4f4] border border-[#d0d0d0] rounded-none p-1 h-10 justify-start overflow-x-auto">
                  {steps.map((s) => (
                    <TabsTrigger key={s.id} value={s.id} className="text-[13px]">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="input" className="mt-3 flex-1 min-h-0 overflow-auto">
                  <div className="border border-[#d0d0d0] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="text-[13px] font-semibold text-[#111827]">Input</div>
                      <div className="text-[11px] text-muted-foreground">
                        Preview: <span className="font-mono">{mode !== "view" ? (form.noBukti || generateNoBukti()) : (selectedItem?.noBukti || "—")}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="border border-[#d0d0d0] bg-white p-3">
                        <div className="text-[12px] font-semibold text-[#14532d] mb-3">TBP</div>
                        <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-x-3 gap-y-3 text-[13px] items-center">
                          <Label>No Bukti</Label>
                          {mode !== "view" ? (
                            <Input
                              value={form.noBukti}
                              onChange={(e) => setForm({ ...form, noBukti: e.target.value })}
                              placeholder={generateNoBukti()}
                              className="h-10 text-[13px] rounded-none"
                            />
                          ) : (
                            <Input value={selectedItem?.noBukti || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          <Label className={`${invalid("tanggal") ? "text-destructive" : ""}`}>Tgl Bukti</Label>
                          {mode !== "view" ? (
                            <Input
                              type="date"
                              value={form.tanggal}
                              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                              className={`h-10 text-[13px] rounded-none ${invalid("tanggal") ? "border-destructive" : ""}`}
                            />
                          ) : (
                            <Input value={selectedItem?.tanggal || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          <Label className={`${invalid("uraian") ? "text-destructive" : ""}`}>Uraian</Label>
                          {mode !== "view" ? (
                            <Input
                              value={form.uraian}
                              onChange={(e) => setForm({ ...form, uraian: e.target.value })}
                              className={`h-10 text-[13px] rounded-none ${invalid("uraian") ? "border-destructive" : ""}`}
                            />
                          ) : (
                            <Input value={selectedItem?.uraian || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          <Label className={`${invalid("jumlah") ? "text-destructive" : ""}`}>Jumlah</Label>
                          {mode !== "view" ? (
                            <Input
                              type="number"
                              value={form.rincian.length > 0 ? calcJumlah : (form.jumlah || "")}
                              onChange={(e) => setForm({ ...form, jumlah: Number(e.target.value) })}
                              disabled={form.rincian.length > 0}
                              className={`h-10 text-[13px] text-right tabular-nums rounded-none ${invalid("jumlah") ? "border-destructive" : ""}`}
                            />
                          ) : (
                            <Input value={fmt(selectedItem?.jumlah || 0)} readOnly className="h-10 text-[13px] bg-[#f2f2f2] text-right tabular-nums rounded-none" />
                          )}
                        </div>
                      </div>

                      <div className="border border-[#d0d0d0] bg-white p-3">
                        <div className="text-[12px] font-semibold text-[#14532d] mb-3">Penyetor & Bank</div>
                        {mode !== "view" && lastTemplate && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 text-[12px] rounded-none"
                              onClick={() => {
                                setForm((f) => ({
                                  ...f,
                                  nama: f.nama || lastTemplate.nama || "",
                                  alamat: f.alamat || lastTemplate.alamat || "",
                                  ttd: f.ttd || lastTemplate.ttd || "",
                                }));
                              }}
                            >
                              Quick-fill Penyetor
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 text-[12px] rounded-none"
                              onClick={() => {
                                setForm((f) => ({ ...f, uraian: f.uraian || lastTemplate.uraian || "" }));
                              }}
                            >
                              Quick-fill Uraian
                            </Button>
                            {jenis === "bank" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-9 text-[12px] rounded-none"
                                onClick={() => {
                                  setForm((f) => ({
                                    ...f,
                                    rekening: f.rekening || lastTemplate.rekening || "",
                                    namaBank: f.namaBank || lastTemplate.namaBank || "",
                                    kppn: f.kppn || lastTemplate.kppn || "",
                                  }));
                                }}
                              >
                                Quick-fill Bank
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-x-3 gap-y-3 text-[13px] items-center">
                          <Label className={`${invalid("nama") ? "text-destructive" : ""}`}>Nama</Label>
                          {mode !== "view" ? (
                            <>
                              <div className="space-y-1">
                                <Input
                                  list="penerimaan-nama"
                                  value={form.nama}
                                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                                  className={`h-10 text-[13px] rounded-none ${invalid("nama") ? "border-destructive" : ""}`}
                                />
                                {invalid("nama") && <div className="text-[11px] text-destructive">Wajib diisi</div>}
                              </div>
                              <datalist id="penerimaan-nama">{namaSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                            </>
                          ) : (
                            <Input value={selectedItem?.nama || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          <Label>Alamat</Label>
                          {mode !== "view" ? (
                            <>
                              <Input list="penerimaan-alamat" value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="h-10 text-[13px] rounded-none" />
                              <datalist id="penerimaan-alamat">{alamatSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                            </>
                          ) : (
                            <Input value={selectedItem?.alamat || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          <Label>Ttd</Label>
                          {mode !== "view" ? (
                            <>
                              <Input list="penerimaan-ttd" value={form.ttd} onChange={(e) => setForm({ ...form, ttd: e.target.value })} className="h-10 text-[13px] rounded-none" />
                              <datalist id="penerimaan-ttd">{ttdSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                            </>
                          ) : (
                            <Input value={selectedItem?.ttd || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                          )}

                          {jenis === "bank" && (
                            <>
                              <Label>KPPN</Label>
                              {mode !== "view" ? (
                                <>
                                  <Input list="penerimaan-kppn" value={form.kppn || ""} onChange={(e) => setForm({ ...form, kppn: e.target.value })} className="h-10 text-[13px] rounded-none" />
                                  <datalist id="penerimaan-kppn">{kppnSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                                </>
                              ) : (
                                <Input value={selectedItem?.kppn || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                              )}

                              <Label className={`${invalid("rekening") ? "text-destructive" : ""}`}>Rekening</Label>
                              {mode !== "view" ? (
                                <>
                                  <Input
                                    list="penerimaan-rekening"
                                    value={form.rekening || ""}
                                    onChange={(e) => setForm({ ...form, rekening: e.target.value })}
                                    className={`h-10 text-[13px] rounded-none ${invalid("rekening") ? "border-destructive" : ""}`}
                                  />
                                  <datalist id="penerimaan-rekening">{rekeningSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                                </>
                              ) : (
                                <Input value={selectedItem?.rekening || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                              )}

                              <Label className={`${invalid("namaBank") ? "text-destructive" : ""}`}>Nama Bank</Label>
                              {mode !== "view" ? (
                                <>
                                  <Input
                                    list="penerimaan-namaBank"
                                    value={form.namaBank || ""}
                                    onChange={(e) => setForm({ ...form, namaBank: e.target.value })}
                                    className={`h-10 text-[13px] rounded-none ${invalid("namaBank") ? "border-destructive" : ""}`}
                                  />
                                  <datalist id="penerimaan-namaBank">{namaBankSuggestions.map((x) => <option key={x} value={x} />)}</datalist>
                                </>
                              ) : (
                                <Input value={selectedItem?.namaBank || ""} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border border-[#d0d0d0] bg-[#f8fafc] p-3">
                      <div className="text-[12px] font-semibold text-[#111827] mb-2">Preview</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[12px] text-[#111827]">
                        <div>No Bukti: <span className="font-mono">{mode !== "view" ? (form.noBukti || generateNoBukti()) : (selectedItem?.noBukti || "—")}</span></div>
                        <div>Tanggal: <span className="font-mono">{(mode !== "view" ? form.tanggal : selectedItem?.tanggal) || "—"}</span></div>
                        <div>Uraian: <span className="font-mono">{(mode !== "view" ? form.uraian : selectedItem?.uraian) || "—"}</span></div>
                        <div>Jumlah: <span className="font-mono">Rp {fmt(mode !== "view" ? calcJumlah : (selectedItem?.jumlah || 0))}</span></div>
                        <div>Penyetor: <span className="font-mono">{(mode !== "view" ? form.nama : selectedItem?.nama) || "—"}</span></div>
                        {jenis === "bank" && (
                          <div>Bank: <span className="font-mono">{(mode !== "view" ? form.namaBank : selectedItem?.namaBank) || "—"}</span></div>
                        )}
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground">Terbilang: {terbilang}</div>
                      {Object.keys(errors).length > 0 && mode !== "view" && (
                        <div className="mt-3 rounded-lg border border-[#ffd3d3] bg-[#fff1f1] p-3 text-[11px] text-destructive">
                          {Object.values(errors).map((v, idx) => <div key={idx}>{v}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rincian" className="mt-3 flex-1 min-h-0 overflow-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <div className="font-semibold text-[#111827]">
                        Nomor Bukti: <span className="font-mono">{mode !== "view" ? (form.noBukti || generateNoBukti()) : (selectedItem?.noBukti || "")}</span>
                      </div>
                      <div className="font-semibold text-[#111827]">Rp {fmt(mode !== "view" ? calcJumlah : (selectedItem?.jumlah || 0))}</div>
                    </div>

                    <div className="border border-[#d0d0d0] bg-white overflow-hidden">
                      <div className="max-h-[40vh] md:max-h-[46vh] overflow-auto">
                        <RawTable className="min-w-[980px]">
                          <TableHeader>
                            <TableRow className="bg-[#f4f4f4] sticky top-0 z-10">
                              <TableHead className="w-10 text-[12px] font-semibold">#</TableHead>
                              <TableHead className="text-[12px] font-semibold whitespace-nowrap w-[160px]">Kd Rincian</TableHead>
                              <TableHead className="text-[12px] font-semibold whitespace-nowrap w-[120px]">Sumber</TableHead>
                              <TableHead className="text-[12px] font-semibold">Nama Rekening</TableHead>
                              <TableHead className="text-[12px] font-semibold text-right whitespace-nowrap w-[160px]">Nilai</TableHead>
                              <TableHead className="text-[12px] font-semibold text-right whitespace-nowrap w-[160px]">Sisa</TableHead>
                              {mode !== "view" && <TableHead className="w-14"></TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayRincian.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={mode !== "view" ? 7 : 6} className="text-center text-muted-foreground py-10 text-sm">
                                  Belum ada rincian
                                </TableCell>
                              </TableRow>
                            ) : displayRincian.map((r, idx) => {
                              const info = rincianInfo.get(r.kodeRekening);
                              const sisa = info?.sisa;
                              const sumber = r.sumberDana || info?.sumberDana || "";
                              const over = typeof sisa === "number" && sisa >= 0 && r.nilai > sisa;
                              return (
                                <TableRow key={r.id} className={`${idx % 2 ? "bg-white/70" : "bg-transparent"} hover:bg-[#e8f2ff]`}>
                                  <TableCell className="text-[13px] text-muted-foreground">{idx + 1}</TableCell>
                                  <TableCell className="text-[13px] font-mono whitespace-nowrap">{r.kodeRekening}</TableCell>
                                  <TableCell className="text-[13px] whitespace-nowrap">{sumber || "—"}</TableCell>
                                  <TableCell className="text-[13px]">
                                    <div className="truncate max-w-[560px]" title={r.namaRekening}>{r.namaRekening}</div>
                                  </TableCell>
                                  <TableCell className={`text-[13px] text-right whitespace-nowrap tabular-nums ${over ? "text-[#b91c1c] font-semibold" : ""}`}>
                                    {fmt(r.nilai)}
                                  </TableCell>
                                  <TableCell className="text-[13px] text-right whitespace-nowrap tabular-nums text-muted-foreground">
                                    {typeof sisa === "number" ? fmt(sisa) : "—"}
                                  </TableCell>
                                  {mode !== "view" && (
                                    <TableCell className="text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-destructive text-[11px]"
                                        onClick={() => removeRincian(r.id)}
                                      >
                                        Hapus
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })}
                            {displayRincian.length > 0 && (
                              <TableRow className="bg-[#f4f4f4] font-semibold">
                                <TableCell colSpan={4} className="text-[13px] text-right text-[#111827]">Total</TableCell>
                                <TableCell className="text-[13px] text-right text-[#111827] tabular-nums">{fmt(displayRincian.reduce((s, r) => s + (r.nilai || 0), 0))}</TableCell>
                                <TableCell className="text-[13px] text-right text-[#111827]"> </TableCell>
                                {mode !== "view" && <TableCell />}
                              </TableRow>
                            )}
                          </TableBody>
                        </RawTable>
                      </div>
                    </div>

                    {mode !== "view" && (
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                        <div className="border border-[#d0d0d0] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="text-[13px] font-semibold text-[#111827]">Tambah Rincian</div>
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="text-muted-foreground">Sisa:</span>
                              <span className={`font-semibold tabular-nums ${rincianDraft.over ? "text-[#b91c1c]" : "text-[#111827]"}`}>
                                {typeof rincianDraft.sisa === "number" ? `Rp ${fmt(rincianDraft.sisa)}` : "—"}
                              </span>
                              <span className="text-muted-foreground">Sumber:</span>
                              <span className="font-semibold text-[#111827]">{rincianDraft.sumberDana || "—"}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] gap-x-4 gap-y-3 items-center text-[13px]">
                            <Label>Kd Rincian</Label>
                            <div className="flex gap-2">
                              <Combobox
                                value={rincianForm.kodeRekening}
                                onValueChange={(v) => {
                                  const opts = getPendapatanOptions(loadState());
                                  const o = opts.find((x) => x.kodeRekening === v);
                                  setRincianForm({ ...rincianForm, kodeRekening: v, namaRekening: o?.namaRekening || "", sumberDana: o?.sumberDana || rincianForm.sumberDana });
                                }}
                                options={rincianOptions}
                                placeholder="Pilih rekening..."
                                className={`h-10 text-[13px] flex-1 rounded-none ${!rincianDraft.kodeOk ? "border-destructive" : ""}`}
                                contentClassName="w-[520px]"
                                searchPlaceholder="Cari kode / nama rekening..."
                              />
                              <Button type="button" variant="outline" className="h-10 px-3 text-[13px] rounded-none" disabled>
                                ...
                              </Button>
                            </div>
                            {!rincianDraft.kodeOk && (
                              <>
                                <div />
                                <div className="text-[11px] text-destructive">Wajib pilih kode rincian</div>
                              </>
                            )}

                            <Label>Sumber Dana</Label>
                            <Select value={rincianForm.sumberDana} onValueChange={v => setRincianForm({ ...rincianForm, sumberDana: v })}>
                              <SelectTrigger className="h-10 text-[13px] rounded-none"><SelectValue placeholder="Pilih" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PAD">PAD</SelectItem>
                                <SelectItem value="DDS">DDS (Dana Desa)</SelectItem>
                                <SelectItem value="ADD">ADD</SelectItem>
                                <SelectItem value="BHP">BHP (Bagi Hasil Pajak)</SelectItem>
                                <SelectItem value="BHR">BHR (Bagi Hasil Retribusi)</SelectItem>
                                <SelectItem value="PBK">PBK (Pendapatan Bantuan Kab)</SelectItem>
                                <SelectItem value="PBP">PBP (Pendapatan Bantuan Prov)</SelectItem>
                              </SelectContent>
                            </Select>

                            <Label>Nama Rekening</Label>
                            <Input value={rincianForm.namaRekening} readOnly className="h-10 text-[13px] bg-[#f2f2f2] rounded-none" />

                            <Label>Nilai</Label>
                            <div className="space-y-1">
                              <Input
                                type="number"
                                value={rincianForm.nilai || ""}
                                onChange={e => setRincianForm({ ...rincianForm, nilai: Number(e.target.value) })}
                                className={`h-10 text-[13px] text-right tabular-nums rounded-none ${!rincianDraft.nilaiOk ? "border-destructive" : ""}`}
                              />
                              {!rincianDraft.nilaiOk ? (
                                <div className="text-[11px] text-destructive">Nilai harus lebih dari 0</div>
                              ) : rincianDraft.over ? (
                                <div className="text-[11px] text-[#b91c1c]">Nilai melebihi sisa anggaran. Tetap boleh disimpan.</div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground">Isi nilai rincian untuk menghitung jumlah otomatis</div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-end justify-end">
                          <Button type="button" className="h-10 text-[13px] rounded-none" onClick={addRincian} disabled={!rincianDraft.canAdd}>
                            Tambah Rincian
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Pilih data atau klik Tambah untuk mulai
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[#8e8e8e] bg-[#f4f4f4] px-3 py-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" disabled>
          <Printer className="h-4 w-4 mr-2" /> Cetak
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleTambah} disabled={mode !== "view"}>
          <Plus className="h-4 w-4 mr-2" /> Tambah
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleUbah} disabled={mode !== "view"}>
          <Pencil className="h-4 w-4 mr-2" /> Ubah
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none text-destructive" onClick={handleHapus} disabled={mode !== "view"}>
          <Trash2 className="h-4 w-4 mr-2" /> Hapus
        </Button>
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={handleBatal} disabled={mode === "view"}>
          <X className="h-4 w-4 mr-2" /> Batal
        </Button>
        {jenis === "tunai" ? (
          <>
            <Button
              size="sm"
              className="h-9 text-[12px] rounded-none"
              onClick={() => { setPreviewMutasiTunai(true); setPreviewOpen(true); }}
              disabled={mode === "view"}
            >
              <Save className="h-4 w-4 mr-2" /> Preview + Mutasi
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 text-[12px] rounded-none"
              onClick={() => { setPreviewMutasiTunai(false); setPreviewOpen(true); }}
              disabled={mode === "view"}
            >
              <Save className="h-4 w-4 mr-2" /> Preview Simpan
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="h-9 text-[12px] rounded-none"
            onClick={() => { setPreviewMutasiTunai(false); setPreviewOpen(true); }}
            disabled={mode === "view"}
          >
            <Save className="h-4 w-4 mr-2" /> Preview Simpan
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-9 text-[12px] rounded-none" onClick={() => window.history.back()}>
          <DoorOpen className="h-4 w-4 mr-2" /> Tutup
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Preview Penerimaan</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border border-[#d0d0d0] bg-white p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <div>No Bukti: <span className="font-mono">{form.noBukti || generateNoBukti()}</span></div>
                <div>Tanggal: <span className="font-mono">{form.tanggal || "—"}</span></div>
                <div className="md:col-span-2">Uraian: <span className="font-mono">{form.uraian || "—"}</span></div>
                <div>Jumlah: <span className="font-mono">Rp {fmt(calcJumlah)}</span></div>
                <div>Penyetor: <span className="font-mono">{form.nama || "—"}</span></div>
                {jenis === "bank" && (
                  <>
                    <div>Rekening: <span className="font-mono">{form.rekening || "—"}</span></div>
                    <div>Nama Bank: <span className="font-mono">{form.namaBank || "—"}</span></div>
                    <div>KPPN: <span className="font-mono">{form.kppn || "—"}</span></div>
                  </>
                )}
                <div className="md:col-span-2 text-[12px] text-muted-foreground">Terbilang: {terbilang}</div>
              </div>
            </div>

            <div className="border border-[#d0d0d0] bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-[#111827]">Rincian</div>
                <div className="text-[12px] text-muted-foreground">{displayRincian.length} baris</div>
              </div>
              {displayRincian.length > 0 ? (
                <div className="mt-3 max-h-[40vh] overflow-auto border border-[#d0d0d0]">
                  <RawTable className="min-w-[980px]">
                    <TableHeader>
                      <TableRow className="bg-[#f4f4f4] sticky top-0 z-10">
                        <TableHead className="h-10 px-3 w-10 text-[12px] font-semibold">#</TableHead>
                        <TableHead className="h-10 px-3 text-[12px] font-semibold whitespace-nowrap w-[160px]">Kd Rincian</TableHead>
                        <TableHead className="h-10 px-3 text-[12px] font-semibold whitespace-nowrap w-[120px]">Sumber</TableHead>
                        <TableHead className="h-10 px-3 text-[12px] font-semibold">Nama Rekening</TableHead>
                        <TableHead className="h-10 px-3 text-[12px] font-semibold text-right whitespace-nowrap w-[160px]">Nilai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRincian.map((r, idx) => (
                        <TableRow key={r.id} className={`${idx % 2 ? "bg-white/70" : "bg-transparent"}`}>
                          <TableCell className="px-3 py-2 text-[13px] text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="px-3 py-2 text-[13px] font-mono whitespace-nowrap">{r.kodeRekening}</TableCell>
                          <TableCell className="px-3 py-2 text-[13px] whitespace-nowrap">{r.sumberDana || rincianInfo.get(r.kodeRekening)?.sumberDana || "—"}</TableCell>
                          <TableCell className="px-3 py-2 text-[13px]">
                            <div className="truncate max-w-[560px]" title={r.namaRekening}>{r.namaRekening}</div>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-[13px] text-right whitespace-nowrap tabular-nums">{fmt(r.nilai)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </RawTable>
                </div>
              ) : (
                <div className="mt-3 text-[12px] text-muted-foreground">Belum ada rincian.</div>
              )}
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="rounded-lg border border-[#ffd3d3] bg-[#fff1f1] p-3 text-[12px] text-destructive">
                {Object.values(errors).map((v, idx) => <div key={idx}>{v}</div>)}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Kembali</Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                handleSimpan({ catatMutasiTunai: previewMutasiTunai });
              }}
              disabled={mode === "view" || Object.keys(errors).length > 0}
            >
              Konfirmasi Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function PenerimaanDesa() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("silpa");
  const desaProfile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}"); } catch { return {}; }
  }, []);
  const namaDesa = (desaProfile?.namaDesa || "Desa Simulasi").toString();

  return (
    <div className="flex flex-col h-full">
      <FormPageHeader title="Penerimaan dan Penyetoran" subtitle="Realisasi Pendapatan Desa" />

      <div className="flex-1 p-3 overflow-hidden">
        <div className="h-full flex flex-col border border-[#8e8e8e] bg-[#efefef] overflow-hidden">
          <div className="bg-gradient-to-b from-[#0b8a1f] to-[#c7f3c7] border-b border-[#8e8e8e]">
            <div className="py-2 text-center font-extrabold tracking-widest text-[#0b2a0f]">
              {namaDesa.toUpperCase()}
            </div>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div
              className="w-56 border-r border-[#8e8e8e] overflow-hidden"
              style={{
                backgroundImage: `url(${bgSawah})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="h-full bg-white/60 backdrop-blur-[1px] p-3">
                <div className="text-[11px] font-semibold mb-2">Menu</div>
                <div className="space-y-1">
                  {([
                    { id: "silpa", label: "SILPA Tahun Lalu", Icon: Layers },
                    { id: "tunai", label: "Penerimaan Tunai", Icon: Banknote },
                    { id: "bank", label: "Penerimaan Bank", Icon: Landmark },
                  ] as Array<{ id: ActiveTab; label: string; Icon: any }>).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActiveTab(m.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 text-[13px] border ${
                        activeTab === m.id
                          ? "bg-[#0b74d1] text-white border-[#0b74d1]"
                          : "bg-white/70 hover:bg-white border-[#c8c8c8] text-[#1f2937]"
                      }`}
                    >
                      <m.Icon className="h-4 w-4" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden p-3">
              {activeTab === "silpa" && <SilpaTab />}
              {activeTab === "tunai" && <PenerimaanTab jenis="tunai" />}
              {activeTab === "bank" && <PenerimaanTab jenis="bank" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
