import { useState, useEffect, useMemo } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { getRekeningDetail } from "@/data/rekening-data";
import { getEffectivePencairan } from "@/lib/financial-engine";
import {
  loadState, saveState,
  type SPJPanjarItem, type SisaPanjarItem,
  type SPJRincian, type BuktiTransaksi, type PotonganPajak,
} from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { useEditingPresence } from "@/hooks/use-editing-presence";

type Mode = "view" | "add" | "edit";
// Top-level menus mirror the previous structure: 4 sub-tabs for SPJ Panjar + Sisa Panjar
type ActiveTab = "spj" | "rincian" | "kwitansi" | "potongan" | "sisa";

export default function SPJKegiatan() {
  const [state, setState] = useState(loadState());
  const [activeTab, setActiveTab] = useState<ActiveTab>("spj");
  const { setMyModule } = useEditingPresence();

  useEffect(() => { setMyModule("spj"); return () => setMyModule(null); }, [setMyModule]);

  useEffect(() => {
    const onUpd = () => setState(loadState());
    window.addEventListener("siskeudes:state-updated", onUpd);
    return () => window.removeEventListener("siskeudes:state-updated", onUpd);
  }, []);

  const persist = (next: ReturnType<typeof loadState>) => {
    saveState(next);
    setState(next);
  };

  const fmt = (n: number) => (n || 0).toLocaleString("id-ID", { minimumFractionDigits: 2 });

  // ============ SPJ PANJAR ============
  const panjarSPPs = state.spp.filter(s => s.jenis === "panjar" && s.isFinal);
  const [selectedSPJId, setSelectedSPJId] = useState<string | null>(null);
  const selectedSPJ = (state.spjPanjar || []).find(s => s.id === selectedSPJId) || null;
  const [mode, setMode] = useState<Mode>("view");

  const [spjForm, setSpjForm] = useState({
    sppId: "", nomorSPJ: "", tanggalSPJ: new Date().toISOString().slice(0, 10), keterangan: "",
  });

  // Rincian sub-form
  const [rincianMode, setRincianMode] = useState<Mode>("view");
  const [selectedRincianId, setSelectedRincianId] = useState<string | null>(null);
  const [rincianForm, setRincianForm] = useState<Omit<SPJRincian, "id">>({ kodeRekening: "", namaRekening: "", nilai: 0, belanjaId: "", noRef: "", kodeKegiatan: "", namaKegiatan: "" });

  // Kwitansi sub-form
  const [buktiMode, setBuktiMode] = useState<Mode>("view");
  const [selectedBuktiId, setSelectedBuktiId] = useState<string | null>(null);
  const [buktiForm, setBuktiForm] = useState<Omit<BuktiTransaksi, "id" | "potonganPajak">>({ tanggal: new Date().toISOString().slice(0, 10), noBukti: "", keterangan: "", jumlah: 0, penerima: "", nama: "", alamat: "" });

  const rekeningPajak = getRekeningDetail("non_anggaran");

  const generateNoSPJ = () => `${String((state.spjPanjar || []).length + 1).padStart(4, "0")}/SPJ/05.2001/2024`;
  const generateNoBukti = () => `${String(((selectedSPJ?.buktiKwitansi?.length) || 0) + 1).padStart(5, "0")}/KWT/05.2001/2024`;

  const sppOptions = useMemo(() => panjarSPPs.map(s => ({ id: s.id, no: s.nomorSPP, jumlah: s.jumlah, uraian: s.uraian, rincian: s.rincian })), [panjarSPPs]);
  const sppRincianOptions = useMemo(() => {
    if (!selectedSPJ) return [];
    const spp = panjarSPPs.find(s => s.id === selectedSPJ.sppId);
    return spp?.rincian || [];
  }, [selectedSPJ, panjarSPPs]);

  // ===== SPJ Header CRUD =====
  const handleTambahSPJ = () => {
    setActiveTab("spj");
    setMode("add");
    setSelectedSPJId(null);
    setSpjForm({ sppId: "", nomorSPJ: generateNoSPJ(), tanggalSPJ: new Date().toISOString().slice(0, 10), keterangan: "" });
  };
  const handleUbahSPJ = () => {
    if (!selectedSPJ) { toast.error("Pilih SPJ"); return; }
    setMode("edit");
    setSpjForm({ sppId: selectedSPJ.sppId, nomorSPJ: selectedSPJ.nomorSPJ, tanggalSPJ: selectedSPJ.tanggalSPJ, keterangan: selectedSPJ.keterangan || "" });
  };
  const handleHapusSPJ = () => {
    if (!selectedSPJ) { toast.error("Pilih SPJ"); return; }
    persist({ ...state, spjPanjar: (state.spjPanjar || []).filter(s => s.id !== selectedSPJ.id) });
    setSelectedSPJId(null);
    toast.success("SPJ dihapus");
  };
  const handleSimpanSPJ = () => {
    if (mode === "add") {
      if (!spjForm.sppId) { toast.error("Pilih No SPP"); return; }
      const spp = panjarSPPs.find(s => s.id === spjForm.sppId);
      if (!spp) return;
      const totalCair = getEffectivePencairan(state).filter(p => p.sppId === spp.id).reduce((s, p) => s + p.netto, 0) || spp.jumlah;
      // Auto-populate buktiKwitansi from SPP's buktiTransaksi
      const autoBukti: BuktiTransaksi[] = (spp.buktiTransaksi || []).map(bt => ({
        id: crypto.randomUUID(),
        tanggal: bt.tanggal,
        noBukti: bt.noBukti,
        keterangan: bt.keterangan,
        jumlah: bt.jumlah,
        penerima: bt.penerima,
        nama: bt.nama,
        alamat: bt.alamat,
        potonganPajak: bt.potonganPajak ? [...bt.potonganPajak] : [],
      }));
      // Auto-populate potongan from SPP's buktiTransaksi potonganPajak
      const autoPotongan: PotonganPajak[] = (spp.buktiTransaksi || []).flatMap(bt =>
        (bt.potonganPajak || []).filter(p => p.nilai > 0)
      );
      // Auto-populate rincianSPJ from SPP's rincian
      const autoRincian: SPJRincian[] = (spp.rincian || []).map(r => ({
        id: crypto.randomUUID(),
        kodeRekening: r.kodeRekening,
        namaRekening: r.namaRekening,
        nilai: r.nilai,
        belanjaId: r.id,
        noRef: r.noRef || "",
        kodeKegiatan: r.kodeKegiatan || "",
        namaKegiatan: r.namaKegiatan || "",
      }));
      const jumlahSPJ = autoRincian.reduce((a, r) => a + (r.nilai || 0), 0);
      const newItem: SPJPanjarItem = {
        id: crypto.randomUUID(), sppId: spp.id, tanggalSPJ: spjForm.tanggalSPJ, nomorSPJ: spjForm.nomorSPJ,
        nomorSPP: spp.nomorSPP, jumlahCair: totalCair, jumlahSPJ, sisa: totalCair - jumlahSPJ,
        keterangan: spjForm.keterangan || spp.uraian,
        rincianSPJ: autoRincian, buktiKwitansi: autoBukti, potongan: autoPotongan,
      };
      persist({ ...state, spjPanjar: [...(state.spjPanjar || []), newItem] });
      setSelectedSPJId(newItem.id);
      toast.success("SPJ Panjar dibuat (rincian, kwitansi & potongan otomatis dari SPP)");
    } else if (mode === "edit" && selectedSPJ) {
      const updated = (state.spjPanjar || []).map(s => s.id === selectedSPJ.id
        ? { ...s, tanggalSPJ: spjForm.tanggalSPJ, nomorSPJ: spjForm.nomorSPJ, keterangan: spjForm.keterangan }
        : s);
      persist({ ...state, spjPanjar: updated });
      toast.success("SPJ diperbarui");
    }
    setMode("view");
    trackFormProgress("spj");
  };

  const updateSelectedSPJ = (patch: Partial<SPJPanjarItem>) => {
    if (!selectedSPJ) return;
    const next = (state.spjPanjar || []).map(s => {
      if (s.id !== selectedSPJ.id) return s;
      const merged = { ...s, ...patch };
      const jumlahSPJ = (merged.rincianSPJ || []).reduce((a, r) => a + (r.nilai || 0), 0);
      return { ...merged, jumlahSPJ, sisa: merged.jumlahCair - jumlahSPJ };
    });
    persist({ ...state, spjPanjar: next });
  };

  // ===== Rincian CRUD =====
  const handleTambahRincian = () => {
    if (!selectedSPJ) { toast.error("Pilih SPJ terlebih dahulu"); return; }
    setRincianMode("add"); setSelectedRincianId(null);
    setRincianForm({ kodeRekening: "", namaRekening: "", nilai: 0, belanjaId: "", noRef: "", kodeKegiatan: "", namaKegiatan: "" });
  };
  const handleSimpanRincian = () => {
    if (!selectedSPJ) return;
    if (!rincianForm.belanjaId) { toast.error("Pilih baris rincian SPP"); return; }
    if (rincianForm.nilai <= 0) { toast.error("Nilai harus > 0"); return; }
    let updR: SPJRincian[];
    if (rincianMode === "add") updR = [...(selectedSPJ.rincianSPJ || []), { id: crypto.randomUUID(), ...rincianForm }];
    else updR = (selectedSPJ.rincianSPJ || []).map(r => r.id === selectedRincianId ? { id: r.id, ...rincianForm } : r);
    updateSelectedSPJ({ rincianSPJ: updR });
    setRincianMode("view"); setSelectedRincianId(null);
    toast.success("Rincian disimpan");
  };
  const handleHapusRincian = () => {
    if (!selectedSPJ || !selectedRincianId) { toast.error("Pilih rincian"); return; }
    updateSelectedSPJ({ rincianSPJ: (selectedSPJ.rincianSPJ || []).filter(r => r.id !== selectedRincianId) });
    setSelectedRincianId(null);
    toast.success("Rincian dihapus");
  };

  // ===== Kwitansi CRUD =====
  const handleTambahBukti = () => {
    if (!selectedSPJ) { toast.error("Pilih SPJ"); return; }
    setBuktiMode("add"); setSelectedBuktiId(null);
    setBuktiForm({ tanggal: new Date().toISOString().slice(0, 10), noBukti: generateNoBukti(), keterangan: "", jumlah: 0, penerima: "", nama: "", alamat: "" });
  };
  const handleSimpanBukti = () => {
    if (!selectedSPJ) return;
    if (!buktiForm.noBukti) { toast.error("Isi nomor bukti"); return; }
    let updB: BuktiTransaksi[];
    if (buktiMode === "add") updB = [...(selectedSPJ.buktiKwitansi || []), { id: crypto.randomUUID(), ...buktiForm, potonganPajak: [] }];
    else updB = (selectedSPJ.buktiKwitansi || []).map(b => b.id === selectedBuktiId ? { ...b, ...buktiForm } : b);
    updateSelectedSPJ({ buktiKwitansi: updB });
    setBuktiMode("view"); setSelectedBuktiId(null);
    toast.success("Kwitansi disimpan");
  };
  const handleHapusBukti = () => {
    if (!selectedSPJ || !selectedBuktiId) { toast.error("Pilih kwitansi"); return; }
    updateSelectedSPJ({ buktiKwitansi: (selectedSPJ.buktiKwitansi || []).filter(b => b.id !== selectedBuktiId) });
    setSelectedBuktiId(null);
    toast.success("Kwitansi dihapus");
  };

  // ===== Potongan — otomatis dari buktiKwitansi =====
  // Tab Potongan hanya menampilkan ringkasan dari semua potongan di buktiKwitansi
  // User menambah potongan di level kwitansi (per bukti)
  const computedPotongan = useMemo(() => {
    if (!selectedSPJ) return [];
    return (selectedSPJ.buktiKwitansi || []).flatMap(bt =>
      (bt.potonganPajak || []).map(p => ({ ...p, noBukti: bt.noBukti, buktiId: bt.id }))
    );
  }, [selectedSPJ]);

  // Sync potongan[] array dari buktiKwitansi setiap kali buktiKwitansi berubah
  const syncPotonganFromBukti = (updatedBukti: BuktiTransaksi[]) => {
    const allPot: PotonganPajak[] = updatedBukti.flatMap(bt =>
      (bt.potonganPajak || []).map(p => ({ kodeRekening: p.kodeRekening, namaRekening: p.namaRekening, nilai: p.nilai }))
    );
    return allPot;
  };

  // Potongan per kwitansi — form state
  const [kwitansiPotForm, setKwitansiPotForm] = useState<PotonganPajak>({ kodeRekening: "", namaRekening: "", nilai: 0 });

  const selectedBukti = (selectedSPJ?.buktiKwitansi || []).find(b => b.id === selectedBuktiId) || null;
  const selectedBuktiPotongan = selectedBukti?.potonganPajak || [];

  const handleTambahPotKwitansi = () => {
    if (!selectedSPJ || !selectedBuktiId) { toast.error("Pilih kwitansi terlebih dahulu"); return; }
    if (!kwitansiPotForm.kodeRekening) { toast.error("Pilih rekening pajak"); return; }
    if (kwitansiPotForm.nilai <= 0) { toast.error("Nilai harus > 0"); return; }
    const updBukti = (selectedSPJ.buktiKwitansi || []).map(b => {
      if (b.id !== selectedBuktiId) return b;
      return { ...b, potonganPajak: [...(b.potonganPajak || []), { ...kwitansiPotForm }] };
    });
    updateSelectedSPJ({ buktiKwitansi: updBukti, potongan: syncPotonganFromBukti(updBukti) });
    setKwitansiPotForm({ kodeRekening: "", namaRekening: "", nilai: 0 });
    toast.success("Potongan pajak ditambahkan ke kwitansi");
  };

  const handleHapusPotKwitansi = (potIdx: number) => {
    if (!selectedSPJ || !selectedBuktiId) return;
    const updBukti = (selectedSPJ.buktiKwitansi || []).map(b => {
      if (b.id !== selectedBuktiId) return b;
      return { ...b, potonganPajak: (b.potonganPajak || []).filter((_, i) => i !== potIdx) };
    });
    updateSelectedSPJ({ buktiKwitansi: updBukti, potongan: syncPotonganFromBukti(updBukti) });
    toast.success("Potongan dihapus");
  };
  // ============ SISA PANJAR ============
  const [selectedSisaId, setSelectedSisaId] = useState<string | null>(null);
  const selectedSisa = (state.sisaPanjar || []).find(s => s.id === selectedSisaId) || null;
  const [sisaMode, setSisaMode] = useState<Mode>("view");
  const [sisaForm, setSisaForm] = useState<{ spjId: string; tanggal: string; buktiNo: string; nominal: number; keterangan: string }>({
    spjId: "", tanggal: new Date().toISOString().slice(0, 10), buktiNo: "", nominal: 0, keterangan: "",
  });

  const handleTambahSisa = () => {
    setActiveTab("sisa"); setSisaMode("add"); setSelectedSisaId(null);
    const count = (state.sisaPanjar || []).length + 1;
    setSisaForm({ spjId: "", tanggal: new Date().toISOString().slice(0, 10), buktiNo: `${String(count).padStart(4, "0")}/SISA/05.2001/2024`, nominal: 0, keterangan: "" });
  };
  const handleUbahSisa = () => {
    if (!selectedSisa) { toast.error("Pilih data"); return; }
    setSisaMode("edit");
    setSisaForm({ spjId: selectedSisa.spjId, tanggal: selectedSisa.tanggal, buktiNo: selectedSisa.buktiNo, nominal: selectedSisa.nominal, keterangan: selectedSisa.keterangan || "" });
  };
  const handleSimpanSisa = () => {
    if (!sisaForm.spjId) { toast.error("Pilih No SPJ"); return; }
    const spj = (state.spjPanjar || []).find(s => s.id === sisaForm.spjId);
    if (!spj) return;
    if (sisaMode === "add") {
      const newItem: SisaPanjarItem = { id: crypto.randomUUID(), spjId: spj.id, nomorSPJ: spj.nomorSPJ,
        tanggal: sisaForm.tanggal, buktiNo: sisaForm.buktiNo, nominal: sisaForm.nominal, keterangan: sisaForm.keterangan };
      persist({ ...state, sisaPanjar: [...(state.sisaPanjar || []), newItem] });
      setSelectedSisaId(newItem.id);
    } else if (sisaMode === "edit" && selectedSisa) {
      const upd = (state.sisaPanjar || []).map(s => s.id === selectedSisa.id ? { ...s, ...sisaForm, nomorSPJ: spj.nomorSPJ } : s);
      persist({ ...state, sisaPanjar: upd });
    }
    setSisaMode("view");
    trackFormProgress("spj");
    toast.success("Data sisa panjar disimpan");
  };
  const handleHapusSisa = () => {
    if (!selectedSisaId) { toast.error("Pilih data"); return; }
    persist({ ...state, sisaPanjar: (state.sisaPanjar || []).filter(s => s.id !== selectedSisaId) });
    setSelectedSisaId(null);
    toast.success("Data dihapus");
  };

  // ===== Action Bar =====
  const ActionBar = ({ onTambah, onUbah, onHapus, onBatal, onSimpan }: { onTambah: () => void; onUbah?: () => void; onHapus: () => void; onBatal: () => void; onSimpan: () => void }) => (
    <div className="px-4 py-2 border-t border-border bg-muted/20 backdrop-blur-sm flex items-center gap-1">
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onTambah}><Plus size={12} />Tambah</Button>
      {onUbah && <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onUbah}><Pencil size={12} />Ubah</Button>}
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onHapus}><Trash2 size={12} />Hapus</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onBatal}><X size={12} />Batal</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={onSimpan}><Save size={12} />Simpan</Button>
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
      <div className="flex-1" />
      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => window.history.back()}><DoorOpen size={12} />Tutup</Button>
    </div>
  );

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "spj", label: "SPJ" },
    { id: "rincian", label: "Rincian SPJ" },
    { id: "kwitansi", label: "Bukti Kwitansi" },
    { id: "potongan", label: "Potongan" },
    { id: "sisa", label: "Sisa Panjar" },
  ];

  const subtitleByTab: Record<ActiveTab, string> = {
    spj: "SPJ Panjar Kegiatan",
    rincian: "Rincian SPJ",
    kwitansi: "Bukti Kwitansi",
    potongan: "Potongan Pajak",
    sisa: "Sisa Panjar",
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Pengesahan SPJ Kegiatan" subtitle={subtitleByTab[activeTab]} />

      <div className="flex-1 p-4 flex gap-0 overflow-hidden">
        {/* Vertical Tabs (left) */}
        <div className="flex flex-col border border-border rounded-l-md overflow-hidden bg-card/60 backdrop-blur-sm">
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => {
                if (t.id !== "spj" && t.id !== "sisa" && !selectedSPJ) { toast.error("Pilih SPJ terlebih dahulu"); return; }
                setActiveTab(t.id);
              }}
              className={`px-3 py-5 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"}`}
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 border border-l-0 border-border rounded-r-md bg-card/80 backdrop-blur-md flex flex-col overflow-hidden">

          {/* ===== TAB: SPJ ===== */}
          {activeTab === "spj" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 text-[11px]">
                      <TableHead className="font-semibold">Tgl SPJ</TableHead>
                      <TableHead className="font-semibold">No SPJ</TableHead>
                      <TableHead className="font-semibold">No SPP</TableHead>
                      <TableHead className="font-semibold">Keterangan</TableHead>
                      <TableHead className="font-semibold text-right">Cair</TableHead>
                      <TableHead className="font-semibold text-right">SPJ</TableHead>
                      <TableHead className="font-semibold text-right">Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(state.spjPanjar || []).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">Belum ada SPJ Panjar</TableCell></TableRow>
                    ) : (state.spjPanjar || []).map(s => (
                      <TableRow key={s.id}
                        className={`cursor-pointer text-[11px] ${selectedSPJId === s.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedSPJId(s.id); setMode("view"); }}
                        onDoubleClick={() => { setSelectedSPJId(s.id); setMode("view"); setActiveTab("rincian"); }}>
                        <TableCell>{s.tanggalSPJ}</TableCell>
                        <TableCell className="font-mono">{s.nomorSPJ}</TableCell>
                        <TableCell className="font-mono">{s.nomorSPP}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.keterangan}</TableCell>
                        <TableCell className="text-right">{fmt(s.jumlahCair)}</TableCell>
                        <TableCell className="text-right">{fmt(s.jumlahSPJ)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(s.sisa)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">No SPP</Label>
                  {mode === "add" ? (
                    <Select value={spjForm.sppId} onValueChange={v => setSpjForm({ ...spjForm, sppId: v })}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih SPP Panjar Final" /></SelectTrigger>
                      <SelectContent>
                        {sppOptions.length === 0 ? <SelectItem value="__empty" disabled>Tidak ada SPP Panjar Final</SelectItem>
                          : sppOptions.map(o => <SelectItem key={o.id} value={o.id} className="text-[11px]">{o.no} — Rp {fmt(o.jumlah)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-7 text-[11px]" readOnly value={selectedSPJ?.nomorSPP || ""} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">No SPJ</Label>
                  <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? spjForm.nomorSPJ : selectedSPJ?.nomorSPJ || ""}
                    onChange={e => setSpjForm({ ...spjForm, nomorSPJ: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">Tgl SPJ</Label>
                  <Input type="date" className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? spjForm.tanggalSPJ : selectedSPJ?.tanggalSPJ || ""}
                    onChange={e => setSpjForm({ ...spjForm, tanggalSPJ: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">Keterangan</Label>
                  <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                    value={mode !== "view" ? spjForm.keterangan : selectedSPJ?.keterangan || ""}
                    onChange={e => setSpjForm({ ...spjForm, keterangan: e.target.value })} />
                </div>
              </div>
              <ActionBar onTambah={handleTambahSPJ} onUbah={handleUbahSPJ} onHapus={handleHapusSPJ} onBatal={() => setMode("view")} onSimpan={handleSimpanSPJ} />
            </div>
          )}

          {/* ===== TAB: RINCIAN SPJ ===== */}
          {activeTab === "rincian" && selectedSPJ && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/30 text-[11px] flex items-center justify-between">
                <span><span className="text-muted-foreground">SPJ:</span> <span className="font-mono font-semibold">{selectedSPJ.nomorSPJ}</span> — {selectedSPJ.keterangan}</span>
                <span className="text-muted-foreground">Total Rincian: <span className="font-semibold text-foreground">Rp {fmt((selectedSPJ.rincianSPJ || []).reduce((s, r) => s + r.nilai, 0))}</span></span>
              </div>
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 text-[11px]">
                      <TableHead>No.Ref</TableHead>
                      <TableHead>Kode Rekening</TableHead>
                      <TableHead>Nama Rincian</TableHead>
                      <TableHead>Kegiatan</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedSPJ.rincianSPJ || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-xs">Belum ada rincian</TableCell></TableRow>
                    ) : (selectedSPJ.rincianSPJ || []).map(r => (
                      <TableRow key={r.id}
                        className={`cursor-pointer text-[11px] ${selectedRincianId === r.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedRincianId(r.id); setRincianMode("view"); setRincianForm({ kodeRekening: r.kodeRekening, namaRekening: r.namaRekening, nilai: r.nilai, belanjaId: r.belanjaId, noRef: r.noRef || "", kodeKegiatan: r.kodeKegiatan || "", namaKegiatan: r.namaKegiatan || "" }); }}>
                        <TableCell className="font-mono">{r.noRef || "-"}</TableCell>
                        <TableCell className="font-mono">{r.kodeRekening}</TableCell>
                        <TableCell>{r.namaRekening}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={r.namaKegiatan}>{r.kodeKegiatan} {r.namaKegiatan ? `— ${r.namaKegiatan}` : ""}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 bg-muted/10">
                <div className="col-span-2 flex items-center gap-2">
                  <Label className="text-[11px] w-28 shrink-0">Pilih Rincian SPP</Label>
                  <Select value={rincianForm.belanjaId || ""} disabled={rincianMode === "view"} onValueChange={v => {
                    const opt = sppRincianOptions.find(o => o.id === v);
                    if (opt) setRincianForm({
                      kodeRekening: opt.kodeRekening, namaRekening: opt.namaRekening, nilai: opt.nilai,
                      belanjaId: opt.id, noRef: opt.noRef || "", kodeKegiatan: opt.kodeKegiatan || "", namaKegiatan: opt.namaKegiatan || "",
                    });
                  }}>
                    <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih baris dari Rincian SPP" /></SelectTrigger>
                    <SelectContent>{sppRincianOptions.map(o => <SelectItem key={o.id} value={o.id} className="text-[11px]">[{o.noRef || "-"}] {o.kodeRekening} — {o.namaRekening}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-28 shrink-0">Kode Rekening</Label>
                  <Input className="h-7 text-[11px] font-mono" readOnly value={rincianForm.kodeRekening} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-28 shrink-0">Nama Rincian</Label>
                  <Input className="h-7 text-[11px]" readOnly value={rincianForm.namaRekening} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-28 shrink-0">Kegiatan</Label>
                  <Input className="h-7 text-[11px]" readOnly value={`${rincianForm.kodeKegiatan || ""} ${rincianForm.namaKegiatan ? `— ${rincianForm.namaKegiatan}` : ""}`} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-28 shrink-0">Nilai</Label>
                  <Input type="number" className="h-7 text-[11px] text-right" readOnly={rincianMode === "view"}
                    value={rincianForm.nilai || ""} onChange={e => setRincianForm({ ...rincianForm, nilai: Number(e.target.value) })} /></div>
              </div>
              <ActionBar onTambah={handleTambahRincian}
                onUbah={() => { if (!selectedRincianId) { toast.error("Pilih rincian"); return; } setRincianMode("edit"); }}
                onHapus={handleHapusRincian} onBatal={() => setRincianMode("view")} onSimpan={handleSimpanRincian} />
            </div>
          )}

          {/* ===== TAB: KWITANSI ===== */}
          {activeTab === "kwitansi" && selectedSPJ && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/30 text-[11px]">
                <span className="text-muted-foreground">SPJ:</span> <span className="font-mono font-semibold">{selectedSPJ.nomorSPJ}</span>
              </div>
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 text-[11px]">
                      <TableHead>Tgl</TableHead>
                      <TableHead>No Bukti</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedSPJ.buktiKwitansi || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-xs">Belum ada kwitansi</TableCell></TableRow>
                    ) : (selectedSPJ.buktiKwitansi || []).map(b => (
                      <TableRow key={b.id}
                        className={`cursor-pointer text-[11px] ${selectedBuktiId === b.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedBuktiId(b.id); setBuktiMode("view"); setBuktiForm({ tanggal: b.tanggal, noBukti: b.noBukti, keterangan: b.keterangan, jumlah: b.jumlah, penerima: b.penerima || "", nama: b.nama || "", alamat: b.alamat || "" }); }}>
                        <TableCell>{b.tanggal}</TableCell>
                        <TableCell className="font-mono">{b.noBukti}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{b.keterangan}</TableCell>
                        <TableCell>{b.nama}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(b.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 bg-muted/10">
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Tanggal</Label>
                  <Input type="date" className="h-7 text-[11px]" readOnly={buktiMode === "view"} value={buktiForm.tanggal} onChange={e => setBuktiForm({ ...buktiForm, tanggal: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">No Bukti</Label>
                  <Input className="h-7 text-[11px] font-mono" readOnly={buktiMode === "view"} value={buktiForm.noBukti} onChange={e => setBuktiForm({ ...buktiForm, noBukti: e.target.value })} /></div>
                <div className="col-span-2 flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Keterangan</Label>
                  <Input className="h-7 text-[11px]" readOnly={buktiMode === "view"} value={buktiForm.keterangan} onChange={e => setBuktiForm({ ...buktiForm, keterangan: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Penerima</Label>
                  <Input className="h-7 text-[11px]" readOnly={buktiMode === "view"} value={buktiForm.nama} onChange={e => setBuktiForm({ ...buktiForm, nama: e.target.value, penerima: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Jumlah</Label>
                  <Input type="number" className="h-7 text-[11px] text-right" readOnly={buktiMode === "view"} value={buktiForm.jumlah || ""} onChange={e => setBuktiForm({ ...buktiForm, jumlah: Number(e.target.value) })} /></div>
                <div className="col-span-2 flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Alamat</Label>
                  <Input className="h-7 text-[11px]" readOnly={buktiMode === "view"} value={buktiForm.alamat} onChange={e => setBuktiForm({ ...buktiForm, alamat: e.target.value })} /></div>
              </div>
              <ActionBar onTambah={handleTambahBukti}
                onUbah={() => { if (!selectedBuktiId) { toast.error("Pilih kwitansi"); return; } setBuktiMode("edit"); }}
                onHapus={handleHapusBukti} onBatal={() => setBuktiMode("view")} onSimpan={handleSimpanBukti} />

              {/* Potongan Pajak per Kwitansi (inline) */}
              {selectedBukti && (
                <div className="border-t border-border p-3 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold">Potongan Pajak — {selectedBukti.noBukti}</p>
                    <p className="text-[10px] text-muted-foreground">Total: Rp {fmt(selectedBuktiPotongan.reduce((s, p) => s + p.nilai, 0))}</p>
                  </div>
                  {selectedBuktiPotongan.length > 0 && (
                    <div className="border border-border rounded overflow-hidden">
                      <Table>
                        <TableHeader><TableRow className="bg-secondary/40 text-[10px]">
                          <TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead className="w-8"></TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {selectedBuktiPotongan.map((p, i) => (
                            <TableRow key={i} className="text-[10px]">
                              <TableCell className="font-mono">{p.kodeRekening}</TableCell>
                              <TableCell>{p.namaRekening}</TableCell>
                              <TableCell className="text-right">{fmt(p.nilai)}</TableCell>
                              <TableCell><Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleHapusPotKwitansi(i)}><Trash2 size={10} /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select value={kwitansiPotForm.kodeRekening} onValueChange={v => {
                      const r = rekeningPajak.find(x => x.kode === v);
                      setKwitansiPotForm({ kodeRekening: v, namaRekening: r?.uraian || "", nilai: kwitansiPotForm.nilai });
                    }}>
                      <SelectTrigger className="h-6 text-[10px] w-[180px]"><SelectValue placeholder="Rekening pajak" /></SelectTrigger>
                      <SelectContent>{rekeningPajak.map(r => <SelectItem key={r.kode} value={r.kode} className="text-[10px]">{r.kode} — {r.uraian}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="h-6 text-[10px] w-24 text-right" placeholder="Nilai"
                      value={kwitansiPotForm.nilai || ""} onChange={e => setKwitansiPotForm({ ...kwitansiPotForm, nilai: Number(e.target.value) })} />
                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={handleTambahPotKwitansi}><Plus size={10} />Tambah</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: POTONGAN (Read-only summary dari buktiKwitansi) ===== */}
          {activeTab === "potongan" && selectedSPJ && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/30 text-[11px] flex items-center justify-between">
                <span><span className="text-muted-foreground">SPJ:</span> <span className="font-mono font-semibold">{selectedSPJ.nomorSPJ}</span></span>
                <span className="text-[10px] text-muted-foreground italic">Otomatis dari Bukti Kwitansi → Penyetoran Pajak</span>
              </div>
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 text-[11px]">
                      <TableHead>No Bukti Kwitansi</TableHead>
                      <TableHead>Kode Rekening</TableHead>
                      <TableHead>Nama Rekening</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computedPotongan.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-xs">Belum ada potongan pajak. Tambahkan di tab Bukti Kwitansi.</TableCell></TableRow>
                    ) : computedPotongan.map((p, i) => (
                      <TableRow key={i} className="text-[11px]">
                        <TableCell className="font-mono">{p.noBukti}</TableCell>
                        <TableCell className="font-mono">{p.kodeRekening}</TableCell>
                        <TableCell>{p.namaRekening}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(p.nilai)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 py-3 bg-muted/10 border-t border-border">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Total Potongan Pajak:</span>
                  <span className="font-semibold">Rp {fmt(computedPotongan.reduce((s, p) => s + p.nilai, 0))}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Potongan pajak diinput per kwitansi di tab "Bukti Kwitansi". Pilih kwitansi lalu tambah potongan di bagian bawah.
                </p>
              </div>
            </div>
          )}

          {/* ===== TAB: SISA PANJAR ===== */}
          {activeTab === "sisa" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/60 text-[11px]">
                      <TableHead>Tgl</TableHead>
                      <TableHead>No SPJ</TableHead>
                      <TableHead>Bukti Sisa</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-right">Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(state.sisaPanjar || []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">Belum ada bukti sisa panjar</TableCell></TableRow>
                    ) : (state.sisaPanjar || []).map(s => (
                      <TableRow key={s.id}
                        className={`cursor-pointer text-[11px] ${selectedSisaId === s.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedSisaId(s.id); setSisaMode("view"); }}>
                        <TableCell>{s.tanggal}</TableCell>
                        <TableCell className="font-mono">{s.nomorSPJ}</TableCell>
                        <TableCell className="font-mono">{s.buktiNo}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{s.keterangan}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(s.nominal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-2 bg-muted/10">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] w-24 shrink-0">No SPJ</Label>
                  {sisaMode !== "view" ? (
                    <Select value={sisaForm.spjId} onValueChange={v => {
                      const spj = (state.spjPanjar || []).find(s => s.id === v);
                      setSisaForm({ ...sisaForm, spjId: v, nominal: spj?.sisa || 0, keterangan: spj ? `Sisa panjar ${spj.nomorSPJ}` : "" });
                    }}>
                      <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Pilih SPJ Panjar" /></SelectTrigger>
                      <SelectContent>
                        {(state.spjPanjar || []).length === 0 ? <SelectItem value="__empty" disabled>Belum ada SPJ Panjar</SelectItem>
                          : (state.spjPanjar || []).map(s => <SelectItem key={s.id} value={s.id} className="text-[11px]">{s.nomorSPJ} — sisa Rp {fmt(s.sisa)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-7 text-[11px]" readOnly value={selectedSisa?.nomorSPJ || ""} />
                  )}
                </div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Bukti Sisa</Label>
                  <Input className="h-7 text-[11px] font-mono" readOnly={sisaMode === "view"}
                    value={sisaMode !== "view" ? sisaForm.buktiNo : selectedSisa?.buktiNo || ""}
                    onChange={e => setSisaForm({ ...sisaForm, buktiNo: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Tanggal</Label>
                  <Input type="date" className="h-7 text-[11px]" readOnly={sisaMode === "view"}
                    value={sisaMode !== "view" ? sisaForm.tanggal : selectedSisa?.tanggal || ""}
                    onChange={e => setSisaForm({ ...sisaForm, tanggal: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Nominal</Label>
                  <Input type="number" className="h-7 text-[11px] text-right" readOnly={sisaMode === "view"}
                    value={sisaMode !== "view" ? sisaForm.nominal || "" : selectedSisa?.nominal || ""}
                    onChange={e => setSisaForm({ ...sisaForm, nominal: Number(e.target.value) })} /></div>
                <div className="col-span-2 flex items-center gap-2"><Label className="text-[11px] w-24 shrink-0">Keterangan</Label>
                  <Input className="h-7 text-[11px]" readOnly={sisaMode === "view"}
                    value={sisaMode !== "view" ? sisaForm.keterangan : selectedSisa?.keterangan || ""}
                    onChange={e => setSisaForm({ ...sisaForm, keterangan: e.target.value })} /></div>
              </div>
              <ActionBar onTambah={handleTambahSisa} onUbah={handleUbahSisa} onHapus={handleHapusSisa} onBatal={() => setSisaMode("view")} onSimpan={handleSimpanSisa} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
