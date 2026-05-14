import { useState, useEffect } from "react";

export default function Beranda() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(152,40%,10%/0.55)] via-[hsl(152,40%,10%/0.35)] to-[hsl(152,40%,10%/0.65)] backdrop-blur-[1px]" />

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
        <h1 className={`text-4xl md:text-5xl lg:text-6xl font-extrabold font-heading tracking-tight text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)] transition-all duration-700 delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          SISKEUDES BUDDY
        </h1>

        {/* Subtitle */}
        <div className={`mt-3 transition-all duration-700 delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="inline-block px-5 py-4 rounded-2xl bg-[hsl(152,45%,10%/0.35)] backdrop-blur-md border border-[hsl(0,0%,100%/0.18)] shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
            <p className="text-lg md:text-4xl font-semibold font-heading text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              Sistem Pengelolaan Keuangan Desa
            </p>
            <p className="mt-1 text-3xl md:text-5xl font-bold text-white/95 tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
              For Education
            </p>
          </div>
        </div>

        {/* Decorative line */}
        <div className={`mx-auto mt-6 h-0.5 bg-gradient-to-r from-transparent via-[hsl(45,90%,55%)] to-transparent transition-all duration-1000 delay-700 ${loaded ? 'w-48 opacity-100' : 'w-0 opacity-0'}`} />

        {/* Tagline */}
        <p className={`mt-5 text-xs md:text-sm text-[hsl(0,0%,85%)] italic max-w-md mx-auto drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition-all duration-700 delay-[900ms] ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Menuju Tatakelola Keuangan Desa yang Akuntabel dan Transparan
        </p>

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
