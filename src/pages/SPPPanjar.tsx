import { useState, useEffect, useMemo } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { loadState, saveState, type SPPItem, type SPPRincian, type BuktiTransaksi, type PotonganPajak } from "@/data/app-state";
import { getBelanjaOptionsForKegiatan, getSisaBelanjaItem } from "@/lib/financial-engine";
import { bidangKegiatanData } from "@/data/siskeudes-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { useEditingPresence } from "@/hooks/use-editing-presence";

type Mode = "view" | "add" | "edit";
type ActiveTab = "spp" | "rincian";

export default function SPPPanjar() {
  const [items, setItems] = useState<SPPItem[]>([]);
  const [selected, setSelected] = useState<SPPItem | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [activeTab, setActiveTab] = useState<ActiveTab>("spp");
  const { setMyModule } = useEditingPresence();

  useEffect(() => { setMyModule("spp_panjar"); return () => setMyModule(null); }, [setMyModule]);

  const [form, setForm] = useState({ tanggalSPP: "", nomorSPP: "", uraian: "", jumlah: 0, pembayaran: "tunai" as "tunai" | "bank", penerimaPanjar: "", nama: "", kodeBank: "", noRekBank: "", namaBank: "" });

  const [rincianMode, setRincianMode] = useState<Mode>("view");
  const [selectedRincian, setSelectedRincian] = useState<SPPRincian | null>(null);
  const [rincianForm, setRincianForm] = useState<Omit<SPPRincian, "id">>({ kodeRekening: "", namaRekening: "", nilai: 0, belanjaId: "", noRef: "", kodeKegiatan: "", kodeBidang: "", namaKegiatan: "" });
  const [pickedKegiatan, setPickedKegiatan] = useState<string>("");

  const [buktiMode, setBuktiMode] = useState<Mode>("view");
  const [selectedBukti, setSelectedBukti] = useState<BuktiTransaksi | null>(null);
  const [buktiForm, setBuktiForm] = useState({ tanggal: "", noBukti: "", keterangan: "", jumlah: 0, penerima: "", nama: "", alamat: "", kodeBank: "", noRekBank: "", namaBank: "", npwp: "" });

  const [potMode, setPotMode] = useState<Mode>("view");
  const [selectedPot, setSelectedPot] = useState<PotonganPajak | null>(null);
  const [potForm, setPotForm] = useState<PotonganPajak>({ kodeRekening: "", namaRekening: "", nilai: 0 });

  const rekeningBelanja = getRekeningDetail("belanja");
  const rekeningPajak = getRekeningDetail("non_anggaran");

  useEffect(() => {
    setItems(loadState().spp.filter(i => i.jenis === "panjar"));
  }, []);

  // Listen for realtime updates from group members
  useEffect(() => {
    const onUpdate = () => setItems(loadState().spp.filter(i => i.jenis === "panjar"));
    window.addEventListener("siskeudes:state-updated", onUpdate);
    return () => window.removeEventListener("siskeudes:state-updated", onUpdate);
  }, []);

  const save = (allSpp: SPPItem[]) => {
    const state = loadState();
    const otherSpp = state.spp.filter(i => i.jenis !== "panjar");
    state.spp = [...otherSpp, ...allSpp];
    saveState(state);
    setItems(allSpp);
  };

  const generateNoSPP = () => `${String(items.length + 1).padStart(4, "0")}/SPP/05.2001/2024`;
  const generateNoBukti = () => `${String((selected?.buktiTransaksi.length || 0) + 1).padStart(5, "0")}/KWT/05.2001/2024`;
  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  // SPP Actions
  const handleTambah = () => { setMode("add"); setSelected(null); setForm({ tanggalSPP: new Date().toISOString().slice(0, 10), nomorSPP: generateNoSPP(), uraian: "", jumlah: 0, pembayaran: "tunai", penerimaPanjar: "", nama: "", kodeBank: "", noRekBank: "", namaBank: "" }); setActiveTab("spp"); };
  const handleUbah = () => { if (!selected) { toast.error("Pilih data terlebih dahulu"); return; } if (selected.isFinal) { toast.error("SPP sudah Final"); return; } setMode("edit"); setForm({ tanggalSPP: selected.tanggalSPP, nomorSPP: selected.nomorSPP, uraian: selected.uraian, jumlah: selected.jumlah, pembayaran: selected.pembayaran || "bank", penerimaPanjar: "", nama: "", kodeBank: "", noRekBank: "", namaBank: "" }); };
  const handleHapus = () => { if (!selected) { toast.error("Pilih data terlebih dahulu"); return; } if (selected.isFinal) { toast.error("SPP sudah Final"); return; } save(items.filter(i => i.id !== selected.id)); setSelected(null); setMode("view"); toast.success("Data berhasil dihapus"); };
  const handleBatal = () => { setMode("view"); };

  const handleSimpan = () => {
    if (!form.tanggalSPP || !form.uraian) { toast.error("Lengkapi data SPP"); return; }
    if (mode === "add") {
      const newItem: SPPItem = { id: crypto.randomUUID(), jenis: "panjar", tanggalSPP: form.tanggalSPP, nomorSPP: form.nomorSPP || generateNoSPP(), uraian: form.uraian, jumlah: form.jumlah, isFinal: false, pembayaran: form.pembayaran, rincian: [], buktiTransaksi: [] };
      save([...items, newItem]);
      setSelected(newItem);
      toast.success("SPP Panjar berhasil disimpan");
    } else if (mode === "edit" && selected) {
      const updated = items.map(i => i.id === selected.id ? { ...i, tanggalSPP: form.tanggalSPP, nomorSPP: form.nomorSPP, uraian: form.uraian, jumlah: form.jumlah, pembayaran: form.pembayaran } : i);
      save(updated);
      setSelected(updated.find(i => i.id === selected.id) || null);
      toast.success("SPP Panjar berhasil diperbarui");
    }
    trackFormProgress("spp");
    setMode("view");
  };

  const toggleFinal = () => {
    if (!selected) return;
    const rTotal = selected.rincian.reduce((s, r) => s + r.nilai, 0);
    if (!selected.isFinal && rTotal === 0) { toast.error("Tambahkan rincian terlebih dahulu"); return; }
    const updated = items.map(i => i.id === selected.id ? { ...i, isFinal: !i.isFinal, jumlah: rTotal || i.jumlah } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    toast.success(selected.isFinal ? "Status Final dibatalkan" : "SPP ditetapkan sebagai Final");
  };

  // Rincian Actions — bridge ke Belanja per No.Ref + hard-lock
  const handleSimpanRincian = () => {
    if (!selected || !rincianForm.belanjaId) { toast.error("Pilih baris Belanja (No. Ref) terlebih dahulu"); return; }
    if (!rincianForm.nilai || rincianForm.nilai <= 0) { toast.error("Nilai harus lebih dari 0"); return; }
    const sisa = getSisaBelanjaItem(loadState(), rincianForm.belanjaId, rincianMode === "edit" ? selectedRincian?.id : undefined);
    if (rincianForm.nilai > sisa) {
      toast.error(`Nilai melebihi sisa anggaran (Rp ${fmt(sisa)}) — tidak dapat disimpan`);
      return;
    }
    let updRincian: SPPRincian[];
    if (rincianMode === "add") { updRincian = [...selected.rincian, { id: crypto.randomUUID(), ...rincianForm }]; }
    else { updRincian = selected.rincian.map(r => r.id === selectedRincian?.id ? { ...r, ...rincianForm } : r); }
    const newJumlah = updRincian.reduce((s, r) => s + r.nilai, 0);
    const updated = items.map(i => i.id === selected.id ? { ...i, rincian: updRincian, jumlah: newJumlah } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    setRincianMode("view");
    setSelectedRincian(null);
    toast.success("Rincian disimpan");
  };

  // List kegiatan unik dari Belanja yang sudah diinput
  const kegiatanOptions = useMemo(() => {
    const state = loadState();
    const seen = new Map<string, { kode: string; nama: string; kodeBidang: string }>();
    state.belanja.forEach(b => {
      if (!seen.has(b.kodeKegiatan)) seen.set(b.kodeKegiatan, { kode: b.kodeKegiatan, nama: b.namaKegiatan, kodeBidang: b.kodeBidang });
    });
    return Array.from(seen.values());
  }, [items, activeTab, rincianMode]);

  const belanjaOptions = useMemo(() => {
    if (!pickedKegiatan) return [];
    return getBelanjaOptionsForKegiatan(loadState(), pickedKegiatan, rincianMode === "edit" ? selectedRincian?.id : undefined);
  }, [pickedKegiatan, items, rincianMode, selectedRincian]);

  // Bukti Actions
  const handleSimpanBukti = () => {
    if (!selected || !buktiForm.noBukti) { toast.error("Lengkapi data bukti"); return; }
    const newBukti: BuktiTransaksi = {
      id: buktiMode === "edit" && selectedBukti ? selectedBukti.id : crypto.randomUUID(),
      tanggal: buktiForm.tanggal, noBukti: buktiForm.noBukti, keterangan: buktiForm.keterangan,
      jumlah: buktiForm.jumlah, penerima: buktiForm.penerima, nama: buktiForm.nama, alamat: buktiForm.alamat,
      potonganPajak: buktiMode === "edit" && selectedBukti ? selectedBukti.potonganPajak : [],
    };
    let updBukti: BuktiTransaksi[];
    if (buktiMode === "add") { updBukti = [...selected.buktiTransaksi, newBukti]; }
    else { updBukti = selected.buktiTransaksi.map(b => b.id === selectedBukti?.id ? newBukti : b); }
    const updated = items.map(i => i.id === selected.id ? { ...i, buktiTransaksi: updBukti } : i);
    save(updated);
    setSelected(updated.find(i => i.id === selected.id) || null);
    setBuktiMode("view");
    setSelectedBukti(null);
    toast.success("Bukti transaksi disimpan");
  };

  // Potongan Actions
  const handleSimpanPot = () => {
    if (!selected || !selectedBukti || !potForm.kodeRekening) { toast.error("Lengkapi data potongan"); return; }
    let updPot: PotonganPajak[];
    if (potMode === "add") { updPot = [...selectedBukti.potonganPajak, potForm]; }
    else { updPot = selectedBukti.potonganPajak.map((p, i) => i === selectedBukti.potonganPajak.indexOf(selectedPot!) ? potForm : p); }
    const updBukti = selected.buktiTransaksi.map(b => b.id === selectedBukti.id ? { ...b, potonganPajak: updPot } : b);
    const updated = items.map(i => i.id === selected.id ? { ...i, buktiTransaksi: updBukti } : i);
    save(updated);
    const newSelected = updated.find(i => i.id === selected.id) || null;
    setSelected(newSelected);
    setSelectedBukti(newSelected?.buktiTransaksi.find(b => b.id === selectedBukti.id) || null);
    setPotMode("view");
    setSelectedPot(null);
    toast.success("Potongan pajak disimpan");
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
      <FormPageHeader title="Permintaan Panjar Kegiatan" subtitle="SPP Panjar" />

      <div className="flex-1 p-4 flex gap-0">
        {/* Vertical Tabs */}
        <div className="flex flex-col border border-border rounded-l-md overflow-hidden bg-muted/30">
          {(["spp", "rincian"] as ActiveTab[]).map(tab => (
            <button key={tab}
              onClick={() => {
                if (tab !== "spp" && !selected) { toast.error("Pilih SPP terlebih dahulu"); return; }
                setActiveTab(tab);
              }}
              className={`px-3 py-5 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
              {tab === "spp" ? "SPP" : "Rincian SPP"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 border border-l-0 border-border rounded-r-md bg-card flex flex-col overflow-hidden">

          {/* ===== TAB SPP ===== */}
          {activeTab === "spp" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 text-[11px]">
                      <TableHead className="font-semibold">Tgl_SPP</TableHead>
                      <TableHead className="font-semibold">No_SPP</TableHead>
                      <TableHead className="font-semibold">Keterangan</TableHead>
                      <TableHead className="font-semibold text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada data</TableCell></TableRow>
                    ) : items.map(item => (
                      <TableRow key={item.id}
                        className={`cursor-pointer text-[11px] ${selected?.id === item.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelected(item); setMode("view"); setSelectedBukti(null); }}
                        onDoubleClick={() => { setSelected(item); setMode("view"); setSelectedBukti(null); setActiveTab("rincian"); }}>
                        <TableCell>{item.tanggalSPP}</TableCell>
                        <TableCell className="font-mono">{item.nomorSPP}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.uraian}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(item.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 space-y-2 bg-muted/10">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="space-y-2">
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
                        <span className={`text-[11px] font-medium ${selected?.isFinal ? "text-green-600" : "text-muted-foreground"}`}>
                          {selected?.isFinal ? "✓ Final" : "Belum Final"}
                        </span>
                        {selected && mode === "view" && (
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={toggleFinal}>
                            {selected.isFinal ? "UnFinal" : "Set Final"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Penerima Panjar</Label>
                      <Input className="h-7 text-[11px]" value={mode !== "view" ? form.penerimaPanjar : ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, penerimaPanjar: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nama</Label>
                      <Input className="h-7 text-[11px]" value={mode !== "view" ? form.nama : ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, nama: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Kode Bank</Label>
                      <Input className="h-7 text-[11px]" value={mode !== "view" ? form.kodeBank : ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, kodeBank: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">No Rek Bank</Label>
                      <Input className="h-7 text-[11px]" value={mode !== "view" ? form.noRekBank : ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, noRekBank: e.target.value })} /></div>
                    <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nama Bank</Label>
                      <Input className="h-7 text-[11px]" value={mode !== "view" ? form.namaBank : ""} readOnly={mode === "view"} onChange={e => setForm({ ...form, namaBank: e.target.value })} /></div>
                  </div>
                </div>
              </div>
              <ActionBar onTambah={handleTambah} onUbah={handleUbah} onHapus={handleHapus} onBatal={handleBatal} onSimpan={handleSimpan} onTutup={() => window.history.back()} />
            </div>
          )}
          {/* ===== TAB RINCIAN ===== */}
          {activeTab === "rincian" && selected && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/20 text-[11px]">
                <span className="font-semibold">Nomor SPP:</span> <span className="font-mono">{selected.nomorSPP}</span>
                <span className="ml-6 font-semibold">Rp {fmt(selected.jumlah)}</span>
              </div>
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader><TableRow className="bg-secondary/50 text-[11px]">
                    <TableHead>No.Ref</TableHead><TableHead>Kd_Rincian</TableHead><TableHead>Nama_Rincian</TableHead><TableHead>Kegiatan</TableHead><TableHead className="text-right">Nilai</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {selected.rincian.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">Belum ada rincian</TableCell></TableRow>
                    : selected.rincian.map((r) => (
                      <TableRow key={r.id}
                        className={`cursor-pointer text-[11px] ${selectedRincian?.id === r.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedRincian(r)}>

                        <TableCell className="font-mono">{r.noRef || "-"}</TableCell>
                        <TableCell className="font-mono">{r.kodeRekening}</TableCell>
                        <TableCell>{r.namaRekening}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground max-w-[180px] truncate">{r.kodeKegiatan ? `${r.kodeKegiatan} ${r.namaKegiatan || ""}` : "-"}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 space-y-2 bg-muted/10">
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Bidang/Kegiatan</Label>
                  <Select value={pickedKegiatan} disabled={rincianMode === "view"} onValueChange={v => { setPickedKegiatan(v); setRincianForm({ ...rincianForm, belanjaId: "", noRef: "", kodeRekening: "", namaRekening: "" }); }}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih Kegiatan (sumber pagu Belanja)" /></SelectTrigger>
                    <SelectContent>
                      {kegiatanOptions.length === 0 ? <SelectItem value="__empty" disabled>Belum ada Belanja yang diinput</SelectItem>
                      : kegiatanOptions.map(k => <SelectItem key={k.kode} value={k.kode}>{k.kode} — {k.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">No. Ref Belanja</Label>
                  <Select value={rincianForm.belanjaId || ""} disabled={rincianMode === "view" || !pickedKegiatan}
                    onValueChange={v => {
                      const opt = belanjaOptions.find(o => o.belanjaId === v);
                      const keg = kegiatanOptions.find(k => k.kode === pickedKegiatan);
                      if (opt) setRincianForm({ ...rincianForm, belanjaId: v, noRef: opt.noRef, kodeRekening: opt.kodeRekening, namaRekening: opt.namaRekening, kodeKegiatan: pickedKegiatan, kodeBidang: keg?.kodeBidang || "", namaKegiatan: keg?.nama || "" });
                    }}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih Baris Belanja (No.Ref)" /></SelectTrigger>
                    <SelectContent>
                      {belanjaOptions.length === 0 ? <SelectItem value="__empty" disabled>Tidak ada baris Belanja</SelectItem>
                      : belanjaOptions.map(o => <SelectItem key={o.belanjaId} value={o.belanjaId}>[{o.noRef || "-"}] {o.kodeRekening} — {o.namaRekening} (Sisa: {fmt(o.sisa)})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nama Rincian</Label>
                  <Input className="h-7 text-[11px]" readOnly value={rincianMode !== "view" ? rincianForm.namaRekening : selectedRincian?.namaRekening || ""} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nilai</Label>
                  <Input type="number" className="h-7 text-[11px] text-right" disabled={rincianMode === "view"}
                    value={rincianMode !== "view" ? rincianForm.nilai || "" : selectedRincian?.nilai || ""} onChange={e => setRincianForm({ ...rincianForm, nilai: Number(e.target.value) })} /></div>
                {rincianMode !== "view" && rincianForm.belanjaId && (
                  <p className="text-[10px] text-muted-foreground pl-[104px]">Sisa anggaran baris ini: <span className="font-semibold text-foreground">Rp {fmt(getSisaBelanjaItem(loadState(), rincianForm.belanjaId, rincianMode === "edit" ? selectedRincian?.id : undefined))}</span></p>
                )}
              </div>
              <ActionBar
                onTambah={() => { if (selected.isFinal) { toast.error("SPP sudah Final"); return; } setRincianMode("add"); setSelectedRincian(null); setPickedKegiatan(""); setRincianForm({ kodeRekening: "", namaRekening: "", nilai: 0, belanjaId: "", noRef: "", kodeKegiatan: "", kodeBidang: "", namaKegiatan: "" }); }}
                onUbah={() => { if (!selectedRincian) { toast.error("Pilih rincian"); return; } setRincianMode("edit"); setPickedKegiatan(selectedRincian.kodeKegiatan || ""); setRincianForm({ kodeRekening: selectedRincian.kodeRekening, namaRekening: selectedRincian.namaRekening, nilai: selectedRincian.nilai, belanjaId: selectedRincian.belanjaId || "", noRef: selectedRincian.noRef || "", kodeKegiatan: selectedRincian.kodeKegiatan || "", kodeBidang: selectedRincian.kodeBidang || "", namaKegiatan: selectedRincian.namaKegiatan || "" }); }}
                onHapus={() => { if (!selectedRincian) return; if (selected.isFinal) { toast.error("SPP sudah Final"); return; } const upd = items.map(i => i.id === selected.id ? { ...i, rincian: i.rincian.filter(r => r.id !== selectedRincian.id), jumlah: i.rincian.filter(r => r.id !== selectedRincian.id).reduce((s,r) => s+r.nilai, 0) } : i); save(upd); setSelected(upd.find(i => i.id === selected.id) || null); setSelectedRincian(null); toast.success("Rincian dihapus"); }}
                onBatal={() => { setRincianMode("view"); setSelectedRincian(null); setPickedKegiatan(""); }}
                onSimpan={handleSimpanRincian}
                onTutup={() => setActiveTab("spp")}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
