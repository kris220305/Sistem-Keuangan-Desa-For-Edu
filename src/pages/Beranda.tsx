import { useState, useEffect } from "react";
import { BookOpen, Eye, ShieldCheck, Sprout } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Materi Edukasi",
    desc: "Pembelajaran seputar keuangan desa",
    color: "bg-emerald-600",
  },
  {
    icon: Eye,
    title: "Transparan",
    desc: "Mendorong transparansi dalam pengelolaan keuangan desa",
    color: "bg-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Akuntabel",
    desc: "Meningkatkan akuntabilitas pengelolaan dana desa",
    color: "bg-emerald-600",
  },
  {
    icon: Sprout,
    title: "Berkelanjutan",
    desc: "Mewujudkan pembangunan desa yang berkelanjutan",
    color: "bg-emerald-600",
  },
];

export default function Beranda() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col justify-center relative px-8 md:px-16 lg:px-24 min-h-[60%]">
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(152,40%,8%/0.75)] via-[hsl(152,40%,8%/0.5)] to-transparent" />

        {/* Hero content */}
        <div className={`relative z-10 max-w-2xl transition-all duration-700 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-heading text-white leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            Sistem Pengelolaan
            <br />
            Keuangan Desa
            <br />
            <span className="text-emerald-400 italic">For Education</span>
          </h1>

          {/* Decorative line */}
          <div className={`mt-5 h-1 w-16 bg-emerald-500 rounded-full transition-all duration-700 delay-300 ${loaded ? "opacity-100 w-16" : "opacity-0 w-0"}`} />

          <p className={`mt-5 text-sm md:text-base text-white/80 max-w-lg leading-relaxed transition-all duration-700 delay-400 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Media edukasi untuk memahami pengelolaan keuangan desa
            secara transparan, akuntabel, dan bertanggung jawab.
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className={`relative z-10 px-6 md:px-12 lg:px-20 pb-6 transition-all duration-700 delay-500 ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`group flex items-start gap-3 p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 hover:bg-white/15 hover:border-white/25 transition-all duration-500 delay-${(i + 1) * 100}`}
            >
              <div className={`shrink-0 w-9 h-9 rounded-lg ${f.color} flex items-center justify-center shadow-lg`}>
                <f.icon size={18} className="text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {f.title}
                </h3>
                <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
