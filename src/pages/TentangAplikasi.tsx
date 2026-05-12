export default function TentangAplikasi() {
  return (
    <div className="h-full flex flex-col">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-heading">Tentang Aplikasi</h1>
          <p className="text-sm text-muted-foreground">
            Dasar hukum: Permendagri No. 18 Tahun 2020 tentang Pengelolaan Keuangan Desa
          </p>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-hidden">
        <div className="content-card h-full overflow-hidden rounded-lg border">
          <iframe
            src="/permendagri-18-2020.pdf"
            className="w-full h-full"
            title="Permendagri 18 Tahun 2020"
          />
        </div>
      </div>
    </div>
  );
}
