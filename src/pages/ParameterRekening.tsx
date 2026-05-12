import FormPageHeader from "@/components/FormPageHeader";

export default function ParameterRekening() {
  const rekeningData = [
    { kode: "1", uraian: "ASET", level: 0 },
    { kode: "1.1", uraian: "Aset Lancar", level: 1 },
    { kode: "1.1.1", uraian: "Kas dan Bank", level: 2 },
    { kode: "1.1.1.01", uraian: "Kas di Bendahara Desa", level: 3 },
    { kode: "1.1.1.02", uraian: "Rekening Kas Desa", level: 3 },
    { kode: "1.1.2", uraian: "Piutang", level: 2 },
    { kode: "1.1.2.01", uraian: "Piutang Sewa Tanah", level: 3 },
    { kode: "1.1.3", uraian: "Persediaan", level: 2 },
    { kode: "1.1.3.01", uraian: "Persediaan Benda Pos dan Materai", level: 3 },
    { kode: "1.2", uraian: "Investasi", level: 1 },
    { kode: "1.2.1", uraian: "Penyertaan Modal Pemerintah Desa", level: 2 },
    { kode: "1.3", uraian: "Aset Tetap", level: 1 },
    { kode: "1.3.1", uraian: "Tanah", level: 2 },
    { kode: "1.3.1.01", uraian: "Tanah Kas Desa", level: 3 },
    { kode: "1.3.2", uraian: "Peralatan dan Mesin", level: 2 },
    { kode: "1.3.3", uraian: "Gedung dan Bangunan", level: 2 },
    { kode: "1.3.4", uraian: "Jalan, Jaringan dan Instalasi", level: 2 },
    { kode: "2", uraian: "KEWAJIBAN", level: 0 },
    { kode: "2.1", uraian: "Kewajiban Jangka Pendek", level: 1 },
    { kode: "3", uraian: "EKUITAS", level: 0 },
    { kode: "3.1", uraian: "Ekuitas", level: 1 },
    { kode: "3.1.1.01", uraian: "Ekuitas", level: 2 },
    { kode: "4", uraian: "PENDAPATAN", level: 0 },
    { kode: "4.1", uraian: "Pendapatan Asli Desa", level: 1 },
    { kode: "4.2", uraian: "Pendapatan Transfer", level: 1 },
    { kode: "4.3", uraian: "Pendapatan Lain-lain", level: 1 },
    { kode: "5", uraian: "BELANJA", level: 0 },
    { kode: "5.1", uraian: "Belanja Pegawai", level: 1 },
    { kode: "5.2", uraian: "Belanja Barang dan Jasa", level: 1 },
    { kode: "5.3", uraian: "Belanja Modal", level: 1 },
    { kode: "5.4", uraian: "Belanja Tak Terduga", level: 1 },
    { kode: "6", uraian: "PEMBIAYAAN", level: 0 },
    { kode: "6.1", uraian: "Penerimaan Pembiayaan", level: 1 },
    { kode: "6.2", uraian: "Pengeluaran Pembiayaan", level: 1 },
  ];

  return (
    <div>
      <FormPageHeader title="Parameter Rekening APBDesa" subtitle="Struktur rekening aset, kewajiban, pendapatan, belanja, dan pembiayaan" />
      <div className="p-6">
        <div className="content-card overflow-hidden">
          <div className="divide-y divide-border">
            {rekeningData.map((item) => (
              <div
                key={item.kode}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors"
                style={{ paddingLeft: `${item.level * 24 + 16}px` }}
              >
                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded min-w-[80px]">{item.kode}</span>
                <span className={`text-sm ${item.level === 0 ? "font-bold" : item.level === 1 ? "font-medium" : ""}`}>
                  {item.uraian}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
