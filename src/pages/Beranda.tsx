import { useState, useEffect } from "react";
import bgLandscape from "@/assets/bg-sawah-sunset.jpg";
import { saveState, loadState } from "@/data/app-state";
import { getDemoSeedData } from "@/data/demo-seed-data";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Database, Trash2 } from "lucide-react";

export default function Beranda() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(152,40%,10%/0.3)] via-transparent to-[hsl(152,40%,10%/0.5)]" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) =>
        <div
          key={i}
          className="absolute rounded-full bg-primary/10 animate-float"
          style={{
            width: `${20 + i * 15}px`,
            height: `${20 + i * 15}px`,
            left: `${10 + i * 15}%`,
            top: `${20 + i * 10}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${3 + i * 0.8}s`
          }} />

        )}
      </div>

      {/* Main content */}
      <div className={`relative z-10 text-center transition-all duration-1000 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Logo/Icon */}
        <div className={`mx-auto mb-6 w-20 h-20 rounded-2xl bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-2xl animate-pulse-glow transition-all duration-700 delay-200 ${loaded ? 'scale-100' : 'scale-75'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-primary-foreground">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className={`text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight transition-all duration-700 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          

          
        </h1>

        {/* Subtitle */}
        <div className={`mt-3 transition-all duration-700 delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-lg font-semibold font-heading drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] text-popover-foreground md:text-4xl">
            Sistem Pengelolaan Keuangan Desa
          </p>
          <p className="text-[hsl(0,0%,90%)] mt-1 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] text-5xl">
            For Education
          </p>
        </div>

        {/* Decorative line */}
        <div className={`mx-auto mt-6 h-0.5 bg-gradient-to-r from-transparent via-[hsl(45,90%,55%)] to-transparent transition-all duration-1000 delay-700 ${loaded ? 'w-48 opacity-100' : 'w-0 opacity-0'}`} />

        {/* Tagline */}
        <p className={`mt-5 text-xs md:text-sm text-[hsl(0,0%,85%)] italic max-w-md mx-auto drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-all duration-700 delay-[900ms] ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Menuju Tatakelola Keuangan Desa yang Akuntabel dan Transparan
        </p>

        {/* Demo Data Buttons */}
        <div className={`mt-4 flex flex-col items-center gap-2 transition-all duration-700 delay-[1000ms] ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-[hsl(0,0%,100%/0.15)] backdrop-blur-md border-[hsl(0,0%,100%/0.3)] text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,100%/0.25)]"
            onClick={() => {
              const demo = getDemoSeedData();
              saveState(demo);
              toast.success("Data demo (Soal Desa Arfai 2024) berhasil dimuat! Silakan cek setiap form.");
            }}
          >
            <Database size={14} /> Muat Data Demo (Soal Desa Arfai)
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-[hsl(0,80%,50%/0.15)] backdrop-blur-md border-[hsl(0,80%,60%/0.3)] text-[hsl(0,80%,80%)] hover:bg-[hsl(0,80%,50%/0.25)]"
            onClick={() => {
              saveState({
                pendapatan: [], belanja: [], pembiayaan: [], penerimaan: [],
                silpa: [], spp: [], pencairan: [], penyetoranPajak: [],
                saldoAwal: [], spjPanjar: [], jurnalUmum: [], kegiatanAnggaran: [],
              });
              localStorage.removeItem('siskeudes_mutasi_kas');
              toast.success("Seluruh data input berhasil dihapus!");
            }}
          >
            <Trash2 size={14} /> Hapus Semua Data Input
          </Button>
        </div>

        {/* Year badge */}
        <div className={`mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(0,0%,100%/0.15)] backdrop-blur-md border border-[hsl(0,0%,100%/0.2)] transition-all duration-700 delay-[1100ms] ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(45,90%,55%)] animate-pulse" />
          <span className="text-xs text-[hsl(0,0%,90%)] font-medium">Tahun Anggaran 2026</span>
        </div>
      </div>

      {/* Bottom copyright */}
      <div className={`absolute bottom-4 left-0 right-0 text-center transition-all duration-700 delay-[1300ms] ${loaded ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-[10px] text-[hsl(0,0%,80%)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          ​
        </p>
      </div>
    </div>);

}