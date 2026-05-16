import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { loadState, saveState, type SPPItem, type SPPRincian, type BuktiTransaksi } from "@/data/app-state";
import { getPembiayaanPengeluaranOptions } from "@/lib/financial-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { useEditingPresence } from "@/hooks/use-editing-presence";

type Mode = "view" | "add" | "edit";
type ActiveTab = "spp" | "rincian" | "bukti";

export default function SPPPembiayaan() {
  const [items, setItems] = useState<SPPItem[]>([]);
  const [selected, setSelected] = useState<SPPItem | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [activeTab, setActiveTab] = useState<ActiveTab>("spp");
  const { setMyModule } = useEditingPresence();

  useEffect(() => { setMyModule("spp_pembiayaan"); return () => setMyModule(null); }, [setMyModule]);

  const [form, setForm] = useState({ tanggalSPP: "", nomorSPP: "", uraian: "", jumlah: 0, pembayaran: "bank" as "tunai" | "bank" });

  const [rincianMode, setRincianMode] = useState<Mode>("view");
  const [selectedRincian, setSelectedRincian] = useState<SPPRincian | null>(null);
  const [rincianForm, setRincianForm] = useState<Omit<SPPRincian, "id">>({ kodeRekening: "", namaRekening: "", nilai: 0 });

  const [buktiMode, setBuktiMode] = useState<Mode>("view");
  const [selectedBukti, setSelectedBukti] = useState<BuktiTransaksi | null>(null);
  const [buktiForm, setBuktiForm] = useState({ tanggal: "", noBukti: "", keterangan: "", jumlah: 0, nama: "", alamat: "", kodeBank: "", noRekBank: "", namaBank: "", npwp: "" });

  // Only show rekening 6.2.x (Pengeluaran Pembiayaan)
  const rekeningPembiayaan = getRekeningDetail("pembiayaan").filter(r => r.kode.startsWith("6.2"));

  useEffect(() => {
    setItems(loadState().spp.filter(i => i.jenis === "pembiayaan"));
  }, []);

  // Listen for realtime updates from group members
  useEffect(() => {
    const onUpdate = () => setItems(loadState().spp.filter(i => i.jenis === "pembiayaan"));
    window.addEventListener("siskeudes:state-updated", onUpdate);
    return () => window.removeEventListener("siskeudes:state-updated", onUpdate);
  }, []);

  const save = (allItems: SPPItem[]) => {
    const state = loadState();
    const other = state.spp.filter(i => i.jenis !== "pembiayaan");
    state.spp = [...other, ...allItems];
    saveState(state);
    setItems(allItems);
  };

  const generateNoSPP = () => `${String(items.length + 1).padStart(4, "0")}/SPP/05.2001/2024`;
  const generateNoBukti = () => `${String((selected?.buktiTransaksi.length || 0) + 1).padStart(5, "0")}/KWT/05.2001/2024`;
  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  // SPP Actions
  const handleTambah = () => { setMode("add"); setSelected(null); setForm({ tanggalSPP: new Date().toISOString().slice(0, 10), nomorSPP: generateNoSPP(), uraian: "", jumlah: 0, pembayaran: "bank" }); setActiveTab("spp"); };
  const handleUbah = () => { if (!selected) { toast.error("Pilih data terlebih dahulu"); return; } if (selected.isFinal) { toast.error("SPP sudah Final"); return; } setMode("edit"); setForm({ tanggalSPP: selected.tanggalSPP, nomorSPP: selected.nomorSPP, uraian: selected.uraian, jumlah: selected.jumlah, pembayaran: selected.pembayaran || "bank" }); };
  const handleHapus = () => { if (!selected) { toast.error("Pilih data terlebih dahulu"); return; } if (selected.isFinal) { toast.error("SPP sudah Final"); return; } save(items.filter(i => i.id !== selected.id)); setSelected(null); setMode("view"); toast.success("Data berhasil dihapus"); };
  const handleBatal = () => setMode("view");

  const handleSimpan = () => {
    if (!form.tanggalSPP || !form.uraian) { toast.error("Lengkapi data SPP"); return; }
    if (mode === "add") {
      const newItem: SPPItem = { id: crypto.randomUUID(), jenis: "pembiayaan", tanggalSPP: form.tanggalSPP, nomorSPP: form.nomorSPP || generateNoSPP(), uraian: form.uraian, jumlah: form.jumlah, isFinal: false, pembayaran: form.pembayaran, rincian: [], buktiTransaksi: [] };
      save([...items, newItem]);
      setSelected(newItem);
      toast.success("SPP Pembiayaan berhasil disimpan");
    } else if (mode === "edit" && selected) {
      const updated = items.map(i => i.id === selected.id ? { ...i, tanggalSPP: form.tanggalSPP, nomorSPP: form.nomorSPP, uraian: form.uraian, pembayaran: form.pembayaran } : i);
      save(updated);
      setSelected(updated.find(i => i.id === selected.id) || null);
      toast.success("SPP Pembiayaan berhasil diperbarui");
    }
    trackFormProgress("spp");
    setMode("view");
  };

  const toggleFinal = () => {
    if (!selected) return;
    const rTotal = selected.rincian.reduce((s, r) => s + r.nilai, 0);
    if (!selected.isFinal && rTotal === 0) { toast.error("Tambahkan rincian terlebih dahulu"); return; }
    if (!selected.isFinal && selected.buktiTransaksi.length === 0) { toast.error("Tambahkan bukti transaksi terlebih dahulu"); return; }
    const updated = items.map(i => i.id === selected.id ? { ...i, isFinal: !i.isFinal, jumlah: rTotal || i.jumlah } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    toast.success(selected.isFinal ? "Status Final dibatalkan" : "SPP ditetapkan sebagai Final");
  };

  // Rincian — hard-lock vs anggaran Pembiayaan Pengeluaran per rekening
  const handleSimpanRincian = () => {
    if (!selected || !rincianForm.kodeRekening) { toast.error("Pilih rekening"); return; }
    if (!rincianForm.nilai || rincianForm.nilai <= 0) { toast.error("Nilai harus lebih dari 0"); return; }
    const opts = getPembiayaanPengeluaranOptions(loadState(), rincianMode === "edit" ? selectedRincian?.id : undefined);
    const opt = opts.find(o => o.kodeRekening === rincianForm.kodeRekening);
    if (!opt) { toast.error("Rekening pembiayaan pengeluaran belum dianggarkan"); return; }
    if (rincianForm.nilai > opt.sisa) {
      toast.error(`Nilai melebihi sisa anggaran (Rp ${fmt(opt.sisa)})`);
      return;
    }
    let updRincian: SPPRincian[];
    if (rincianMode === "add") { updRincian = [...selected.rincian, { id: crypto.randomUUID(), ...rincianForm }]; }
    else { updRincian = selected.rincian.map(r => r.id === selectedRincian?.id ? { ...r, ...rincianForm } : r); }
    const newJumlah = updRincian.reduce((s, r) => s + r.nilai, 0);
    const updated = items.map(i => i.id === selected.id ? { ...i, rincian: updRincian, jumlah: newJumlah } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    setRincianMode("view"); setSelectedRincian(null);
    toast.success("Rincian disimpan");
  };

  // Bukti
  const handleSimpanBukti = () => {
    if (!selected || !buktiForm.noBukti) { toast.error("Lengkapi data bukti"); return; }
    const newBukti: BuktiTransaksi = {
      id: buktiMode === "edit" && selectedBukti ? selectedBukti.id : crypto.randomUUID(),
      tanggal: buktiForm.tanggal, noBukti: buktiForm.noBukti, keterangan: buktiForm.keterangan,
      jumlah: buktiForm.jumlah, penerima: "", nama: buktiForm.nama, alamat: buktiForm.alamat,
      potonganPajak: buktiMode === "edit" && selectedBukti ? selectedBukti.potonganPajak : [],
    };
    let updBukti: BuktiTransaksi[];
    if (buktiMode === "add") { updBukti = [...selected.buktiTransaksi, newBukti]; }
    else { updBukti = selected.buktiTransaksi.map(b => b.id === selectedBukti?.id ? newBukti : b); }
    const updated = items.map(i => i.id === selected.id ? { ...i, buktiTransaksi: updBukti } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    setBuktiMode("view"); setSelectedBukti(null);
    toast.success("Bukti transaksi disimpan");
  };

  const ActionBar = ({ onTambah, onUbah, onHapus, onBatal, onSimpan, onTutup }: { onTambah: () => void; onUbah: () => void; onHapus: () => void; onBatal: () => void; onSimpan: () => void; onTutup: () => void }) => (
    <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onTambah}><Plus size={12} />Tambah</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onUbah}><Pencil size={12} />Ubah</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onHapus}><Trash2 size={12} />Hapus</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onBatal}><X size={12} />Batal</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onSimpan}><Save size={12} />Simpan</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onTutup}><DoorOpen size={12} />Tutup</Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="SPP Pengeluaran Pembiayaan" subtitle="Surat Permintaan Pembayaran Pembiayaan" />

      <div className="flex-1 p-4 flex gap-0">
        {/* Vertical Tabs */}
        <div className="flex flex-col border border-border rounded-l-md overflow-hidden bg-muted/30">
          {(["spp", "rincian", "bukti"] as ActiveTab[]).map(tab => (
            <button key={tab}
              onClick={() => { if (tab !== "spp" && !selected) { toast.error("Pilih SPP terlebih dahulu"); return; } setActiveTab(tab); }}
              className={`px-3 py-6 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
              {tab === "spp" ? "SPP" : tab === "rincian" ? "Rincian SPP" : "Bukti Pengeluaran"}
            </button>
          ))}
        </div>

        <div className="flex-1 border border-l-0 border-border rounded-r-md bg-card flex flex-col overflow-hidden">

          {/* TAB SPP */}
          {activeTab === "spp" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader><TableRow className="bg-secondary/50 text-[11px]">
                    <TableHead>Tgl_SPP</TableHead><TableHead>No_SPP</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Jumlah</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada data</TableCell></TableRow>
                    : items.map(item => (
                      <TableRow key={item.id} className={`cursor-pointer text-[11px] ${selected?.id === item.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelected(item); setMode("view"); setSelectedBukti(null); }}
                        onDoubleClick={() => { setSelected(item); setMode("view"); setSelectedBukti(null); setActiveTab("rincian"); }}>
                        <TableCell>{item.tanggalSPP}</TableCell><TableCell className="font-mono">{item.nomorSPP}</TableCell><TableCell className="max-w-[200px] truncate">{item.uraian}</TableCell><TableCell className="text-right font-medium">{fmt(item.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">No SPP</Label>
                  <Input className="h-7 text-[11px]" value={mode !== "view" ? form.nomorSPP : selected?.nomorSPP || ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, nomorSPP: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Tgl SPP</Label>
                  <Input type="date" className="h-7 text-[11px]" value={mode !== "view" ? form.tanggalSPP : selected?.tanggalSPP || ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, tanggalSPP: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Pembayaran</Label>
                  {mode !== "view" ? (
                    <Select value={form.pembayaran} onValueChange={(v) => setForm({ ...form, pembayaran: v as "tunai" | "bank" })}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tunai">Tunai</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-7 text-[11px]" readOnly value={(selected?.pembayaran || "bank") === "tunai" ? "Tunai" : "Bank"} />
                  )}
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Uraian</Label>
                  <Input className="h-7 text-[11px]" value={mode !== "view" ? form.uraian : selected?.uraian || ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, uraian: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Jumlah</Label>
                  <Input className="h-7 text-[11px] text-right font-medium" readOnly value={fmt(mode !== "view" ? form.jumlah : selected?.jumlah || 0)} /></div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-20 shrink-0">Status</Label>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium ${selected?.isFinal ? "text-green-600" : "text-muted-foreground"}`}>{selected?.isFinal ? "✓ Final" : "Belum Final"}</span>
                    {selected && mode === "view" && <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={toggleFinal}>{selected.isFinal ? "UnFinal" : "Set Final"}</Button>}
                  </div>
                </div>
              </div>
              <ActionBar onTambah={handleTambah} onUbah={handleUbah} onHapus={handleHapus} onBatal={handleBatal} onSimpan={handleSimpan} onTutup={() => window.history.back()} />
            </div>
          )}

          {/* TAB RINCIAN */}
          {activeTab === "rincian" && selected && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/20 text-[11px]">
                <span className="font-semibold">Nomor SPP:</span> <span className="font-mono">{selected.nomorSPP}</span>
                <span className="ml-6 font-semibold">Rp {fmt(selected.jumlah)}</span>
              </div>
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader><TableRow className="bg-secondary/50 text-[11px]">
                    <TableHead>Kd_Rincian</TableHead><TableHead>NoID</TableHead><TableHead>Nama_Rincian</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead className="text-right">Nilai</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {selected.rincian.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">Belum ada rincian</TableCell></TableRow>
                    : selected.rincian.map((r, idx) => {
                      const opts = getPembiayaanPengeluaranOptions(loadState());
                      const o = opts.find(x => x.kodeRekening === r.kodeRekening);
                      return (
                      <TableRow key={r.id} className={`cursor-pointer text-[11px] ${selectedRincian?.id === r.id ? "bg-primary/10" : "hover:bg-muted/50"}`} onClick={() => setSelectedRincian(r)} onDoubleClick={() => { setSelectedRincian(r); setActiveTab("bukti"); }}>
                        <TableCell className="font-mono">{r.kodeRekening}</TableCell><TableCell>{idx + 1}</TableCell><TableCell>{r.namaRekening}</TableCell><TableCell className="text-right text-[10px] text-muted-foreground">{o ? fmt(o.sisa) : "-"}</TableCell><TableCell className="text-right font-medium">{fmt(r.nilai)}</TableCell>
                      </TableRow>);
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Rincian</Label>
                  <Select value={rincianMode !== "view" ? rincianForm.kodeRekening : selectedRincian?.kodeRekening || ""} disabled={rincianMode === "view"}
                    onValueChange={v => {
                      const opts = getPembiayaanPengeluaranOptions(loadState(), rincianMode === "edit" ? selectedRincian?.id : undefined);
                      const o = opts.find(x => x.kodeRekening === v);
                      setRincianForm({ ...rincianForm, kodeRekening: v, namaRekening: o?.namaRekening || "" });
                    }}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih Pembiayaan Pengeluaran (yang dianggarkan)" /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const opts = getPembiayaanPengeluaranOptions(loadState(), rincianMode === "edit" ? selectedRincian?.id : undefined);
                        return opts.length === 0
                          ? <SelectItem value="__empty" disabled>Belum ada Pembiayaan Pengeluaran</SelectItem>
                          : opts.map(o => <SelectItem key={o.pembiayaanId} value={o.kodeRekening}>{o.kodeRekening} — {o.namaRekening} (Sisa: {fmt(o.sisa)})</SelectItem>);
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nama Rincian</Label>
                  <Input className="h-7 text-[11px]" readOnly value={rincianMode !== "view" ? rincianForm.namaRekening : selectedRincian?.namaRekening || ""} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nilai</Label>
                  <Input type="number" className="h-7 text-[11px] text-right" disabled={rincianMode === "view"}
                    value={rincianMode !== "view" ? rincianForm.nilai || "" : selectedRincian?.nilai || ""} onChange={e => setRincianForm({ ...rincianForm, nilai: Number(e.target.value) })} /></div>
              </div>
              <ActionBar
                onTambah={() => { if (selected.isFinal) { toast.error("SPP sudah Final"); return; } setRincianMode("add"); setSelectedRincian(null); setRincianForm({ kodeRekening: "", namaRekening: "", nilai: 0 }); }}
                onUbah={() => { if (!selectedRincian) { toast.error("Pilih rincian"); return; } setRincianMode("edit"); setRincianForm({ kodeRekening: selectedRincian.kodeRekening, namaRekening: selectedRincian.namaRekening, nilai: selectedRincian.nilai }); }}
                onHapus={() => { if (!selectedRincian) return; if (selected.isFinal) { toast.error("SPP sudah Final"); return; } const upd = items.map(i => i.id === selected.id ? { ...i, rincian: i.rincian.filter(r => r.id !== selectedRincian.id), jumlah: i.rincian.filter(r => r.id !== selectedRincian.id).reduce((s,r) => s+r.nilai, 0) } : i); save(upd); setSelected(upd.find(i => i.id === selected.id) || null); setSelectedRincian(null); toast.success("Rincian dihapus"); }}
                onBatal={() => { setRincianMode("view"); setSelectedRincian(null); }}
                onSimpan={handleSimpanRincian}
                onTutup={() => setActiveTab("spp")}
              />
            </div>
          )}

          {/* TAB BUKTI PENGELUARAN */}
          {activeTab === "bukti" && selected && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader><TableRow className="bg-secondary/50 text-[11px]">
                    <TableHead>Tgl_Bukti</TableHead><TableHead>No_Bukti</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Nilai</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {selected.buktiTransaksi.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada bukti</TableCell></TableRow>
                    : selected.buktiTransaksi.map(b => (
                      <TableRow key={b.id} className={`cursor-pointer text-[11px] ${selectedBukti?.id === b.id ? "bg-primary/10" : "hover:bg-muted/50"}`} onClick={() => { setSelectedBukti(b); setBuktiMode("view"); }} onDoubleClick={() => { setSelectedBukti(b); setBuktiMode("view"); }}>
                        <TableCell>{b.tanggal}</TableCell><TableCell className="font-mono">{b.noBukti}</TableCell><TableCell className="max-w-[180px] truncate">{b.keterangan}</TableCell><TableCell className="text-right font-medium">{fmt(b.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 bg-muted/10">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">No Bukti</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.noBukti : selectedBukti?.noBukti || ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, noBukti: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Tgl Bukti</Label>
                      <Input type="date" className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.tanggal : selectedBukti?.tanggal || ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, tanggal: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Uraian</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.keterangan : selectedBukti?.keterangan || ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, keterangan: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Nilai</Label>
                      <Input type="number" className="h-7 text-[11px] text-right" disabled={buktiMode === "view"} value={buktiMode !== "view" ? buktiForm.jumlah || "" : selectedBukti?.jumlah || ""} onChange={e => setBuktiForm({ ...buktiForm, jumlah: Number(e.target.value) })} /></div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Penerima</p>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Nama</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.nama : selectedBukti?.nama || ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, nama: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Alamat</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.alamat : selectedBukti?.alamat || ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, alamat: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Kode Bank</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.kodeBank : ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, kodeBank: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">No Rek Bank</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.noRekBank : ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, noRekBank: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">Nama Bank</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.namaBank : ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, namaBank: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-20 shrink-0">NPWP</Label>
                      <Input className="h-7 text-[11px]" value={buktiMode !== "view" ? buktiForm.npwp : ""} readOnly={buktiMode === "view"} onChange={e => setBuktiForm({ ...buktiForm, npwp: e.target.value })} /></div>
                  </div>
                </div>
              </div>
              <ActionBar
                onTambah={() => { if (selected.isFinal) { toast.error("SPP sudah Final"); return; } setBuktiMode("add"); setSelectedBukti(null); setBuktiForm({ tanggal: new Date().toISOString().slice(0, 10), noBukti: generateNoBukti(), keterangan: "", jumlah: 0, nama: "", alamat: "", kodeBank: "", noRekBank: "", namaBank: "", npwp: "" }); }}
                onUbah={() => { if (!selectedBukti) { toast.error("Pilih bukti"); return; } setBuktiMode("edit"); setBuktiForm({ tanggal: selectedBukti.tanggal, noBukti: selectedBukti.noBukti, keterangan: selectedBukti.keterangan, jumlah: selectedBukti.jumlah, nama: selectedBukti.nama, alamat: selectedBukti.alamat, kodeBank: "", noRekBank: "", namaBank: "", npwp: "" }); }}
                onHapus={() => { if (!selectedBukti) return; if (selected.isFinal) { toast.error("SPP sudah Final"); return; } const upd = items.map(i => i.id === selected.id ? { ...i, buktiTransaksi: i.buktiTransaksi.filter(b => b.id !== selectedBukti.id) } : i); save(upd); setSelected(upd.find(i => i.id === selected.id) || null); setSelectedBukti(null); toast.success("Bukti dihapus"); }}
                onBatal={() => { setBuktiMode("view"); setSelectedBukti(null); }}
                onSimpan={handleSimpanBukti}
                onTutup={() => setActiveTab("spp")}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
