import { useState, useEffect } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { trackFormProgress } from "@/lib/session-manager";
import { loadState, saveState, type PencairanSPP, type SPPItem } from "@/data/app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, X, Save, Printer, DoorOpen, Lock } from "lucide-react";
import { toast } from "sonner";

type Mode = "view" | "add" | "edit";
type ActiveTab = "sppFinal" | "buktiPencairan";

export default function PencairanSPPPage() {
  const [pencairan, setPencairan] = useState<PencairanSPP[]>([]);
  const [sppList, setSppList] = useState<SPPItem[]>([]);
  const [selectedSPP, setSelectedSPP] = useState<SPPItem | null>(null);
  const [selectedPencairan, setSelectedPencairan] = useState<PencairanSPP | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [activeTab, setActiveTab] = useState<ActiveTab>("sppFinal");

  const [form, setForm] = useState({
    nomorPencairan: "", tanggal: "", noBukti: "", tglBayar: "",
    uraian: "", pembayaran: "bank" as "tunai" | "bank",
    jumlah: 0, potongan: 0, namaBank: "BPD Simulasi", cmsId: "",
  });

  useEffect(() => {
    const state = loadState();
    setPencairan(state.pencairan);
    setSppList(state.spp.filter(s => s.isFinal));
  }, []);

  const save = (newItems: PencairanSPP[]) => {
    setPencairan(newItems);
    const state = loadState();
    state.pencairan = newItems;
    saveState(state);
  };

  const fmt = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2 });

  const pencairanForSPP = (sppId: string) => pencairan.filter(p => p.sppId === sppId);

  const generateNoPencairan = (spp: SPPItem) => {
    const count = pencairan.filter(p => p.sppId === spp.id).length + 1;
    return `${String(count).padStart(4, "0")}/SPP/05.2001/2024`;
  };

  const generateNoBukti = () => {
    const count = pencairan.length + 1;
    return `${String(count).padStart(4, "0")}/BANK/05.2001/2024`;
  };

  const handleTambah = () => {
    if (!selectedSPP) { toast.error("Pilih SPP Final terlebih dahulu"); return; }
    setMode("add");
    setSelectedPencairan(null);
    setActiveTab("buktiPencairan");
    setForm({
      nomorPencairan: generateNoPencairan(selectedSPP),
      tanggal: new Date().toISOString().slice(0, 10),
      noBukti: generateNoBukti(),
      tglBayar: new Date().toISOString().slice(0, 10),
      uraian: selectedSPP.uraian,
      pembayaran: "bank", jumlah: selectedSPP.jumlah,
      potongan: 0, namaBank: "BPD Simulasi", cmsId: "",
    });
  };

  const handleHapus = () => {
    if (!selectedPencairan) { toast.error("Pilih data pencairan"); return; }
    save(pencairan.filter(p => p.id !== selectedPencairan.id));
    setSelectedPencairan(null);
    setMode("view");
    toast.success("Data pencairan dihapus");
  };

  const handleSimpan = () => {
    if (!selectedSPP || !form.tanggal) { toast.error("Lengkapi data"); return; }
    const netto = form.jumlah - form.potongan;
    if (mode === "add") {
      const newItem: PencairanSPP = {
        id: crypto.randomUUID(),
        sppId: selectedSPP.id,
        nomorPencairan: form.nomorPencairan,
        tanggal: form.tanggal,
        noCek: form.noBukti,
        pembayaran: form.pembayaran,
        jumlah: form.jumlah,
        potongan: form.potongan,
        netto,
      };
      save([...pencairan, newItem]);
      setSelectedPencairan(newItem);
      toast.success("SPP berhasil dicairkan");
    }
    trackFormProgress("pencairan");
    setMode("view");
  };

  const handleBatal = () => { setMode("view"); };

  const handleKunciBukti = () => {
    toast.info("Bukti pencairan telah dikunci");
  };

  // Double-click: SPP Final row → navigate to Bukti Pencairan tab
  const handleSPPDoubleClick = (spp: SPPItem) => {
    setSelectedSPP(spp);
    setSelectedPencairan(null);
    setActiveTab("buktiPencairan");
  };

  return (
    <div className="h-full flex flex-col">
      <FormPageHeader title="Pencairan SPP di Kas Desa" subtitle="Bukti pencairan" />

      <div className="flex-1 p-4 flex gap-0">
        <div className="flex flex-col border border-border rounded-l-md overflow-hidden bg-muted/30">
          <button onClick={() => setActiveTab("sppFinal")}
            className={`px-3 py-6 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === "sppFinal" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>SPP Final</button>
          <button onClick={() => { if (selectedSPP) setActiveTab("buktiPencairan"); else toast.error("Pilih SPP terlebih dahulu"); }}
            className={`px-3 py-6 text-[10px] font-semibold border-b border-border transition-colors ${activeTab === "buktiPencairan" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>Bukti Pencairan</button>
        </div>

        <div className="flex-1 border border-l-0 border-border rounded-r-md bg-card flex flex-col overflow-hidden">
          {activeTab === "sppFinal" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/20">
                <p className="text-[11px] font-semibold">SPP Final Yang Sudah Dicairkan :</p>
              </div>
              <div className="flex-1 overflow-auto">
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
                    {sppList.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Belum ada SPP Final</TableCell></TableRow>
                    ) : sppList.map(spp => (
                      <TableRow key={spp.id}
                        className={`cursor-pointer text-[11px] ${selectedSPP?.id === spp.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedSPP(spp); setSelectedPencairan(null); }}
                        onDoubleClick={() => handleSPPDoubleClick(spp)}>
                        <TableCell>{spp.tanggalSPP}</TableCell>
                        <TableCell className="font-mono">{spp.nomorSPP}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{spp.uraian}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(spp.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === "buktiPencairan" && selectedSPP && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center gap-4">
                <div className="text-[11px]">
                  <span className="font-semibold">Nomor Pencairan:</span>{" "}
                  <span className="font-mono">{mode !== "view" ? form.nomorPencairan : selectedPencairan?.nomorPencairan || "-"}</span>
                </div>
                <div className="text-[11px]">
                  <span className="font-semibold">Tanggal:</span>{" "}
                  <span>{mode !== "view" ? form.tanggal : selectedPencairan?.tanggal || "-"}</span>
                </div>
              </div>

              <div className="flex-shrink-0 max-h-[120px] overflow-auto border-b border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 text-[11px]">
                      <TableHead className="font-semibold">No_Cek</TableHead>
                      <TableHead className="font-semibold">Tgl_Cek</TableHead>
                      <TableHead className="font-semibold">Keterangan</TableHead>
                      <TableHead className="font-semibold text-right">Netto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pencairanForSPP(selectedSPP.id).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-xs">Belum ada pencairan</TableCell></TableRow>
                    ) : pencairanForSPP(selectedSPP.id).map(pc => (
                      <TableRow key={pc.id}
                        className={`cursor-pointer text-[11px] ${selectedPencairan?.id === pc.id ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        onClick={() => { setSelectedPencairan(pc); setMode("view"); }}>
                        <TableCell className="font-mono">{pc.noCek}</TableCell>
                        <TableCell>{pc.tanggal}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{selectedSPP.uraian}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(pc.netto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex-1 p-4 space-y-3 bg-muted/10 overflow-auto">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">No Bukti</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.noBukti : selectedPencairan?.noCek || ""}
                        onChange={e => setForm({...form, noBukti: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Tgl Bayar</Label>
                      <Input type="date" className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.tglBayar : selectedPencairan?.tanggal || ""}
                        onChange={e => setForm({...form, tglBayar: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Uraian</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.uraian : selectedSPP?.uraian || ""}
                        onChange={e => setForm({...form, uraian: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Pembayaran</Label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1 text-[11px]">
                          <input type="radio" name="pembayaran" value="tunai" disabled={mode === "view"}
                            checked={(mode !== "view" ? form.pembayaran : selectedPencairan?.pembayaran) === "tunai"}
                            onChange={() => setForm({...form, pembayaran: "tunai"})} />
                          Tunai
                        </label>
                        <label className="flex items-center gap-1 text-[11px]">
                          <input type="radio" name="pembayaran" value="bank" disabled={mode === "view"}
                            checked={(mode !== "view" ? form.pembayaran : selectedPencairan?.pembayaran) === "bank"}
                            onChange={() => setForm({...form, pembayaran: "bank"})} />
                          Bank
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Nama Bank</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.namaBank : "BPD Simulasi"}
                        onChange={e => setForm({...form, namaBank: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">CMS ID</Label>
                      <Input className="h-7 text-[11px]" readOnly={mode === "view"}
                        value={mode !== "view" ? form.cmsId : ""}
                        onChange={e => setForm({...form, cmsId: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Jumlah</Label>
                      <Input type="number" className="h-7 text-[11px] text-right font-medium" readOnly={mode === "view"}
                        value={mode !== "view" ? form.jumlah || "" : selectedPencairan?.jumlah || ""}
                        onChange={e => setForm({...form, jumlah: Number(e.target.value)})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Potongan</Label>
                      <Input type="number" className="h-7 text-[11px] text-right font-medium" readOnly={mode === "view"}
                        value={mode !== "view" ? form.potongan || "" : selectedPencairan?.potongan || ""}
                        onChange={e => setForm({...form, potongan: Number(e.target.value)})} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[11px] w-20 shrink-0">Dibayarkan</Label>
                      <Input className="h-7 text-[11px] text-right font-medium bg-muted" readOnly
                        value={fmt(mode !== "view" ? form.jumlah - form.potongan : selectedPencairan?.netto || 0)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleTambah}><Plus size={12} />Tambah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" disabled><Pencil size={12} />Ubah</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleHapus}><Trash2 size={12} />Hapus</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleBatal}><X size={12} />Batal</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleSimpan}><Save size={12} />Simpan</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Printer size={12} />Cetak</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={handleKunciBukti}><Lock size={12} />Kunci Bukti</Button>
        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => window.history.back()}><DoorOpen size={12} />Tutup</Button>
      </div>
    </div>
  );
}
