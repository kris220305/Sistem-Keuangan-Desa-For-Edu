import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface MenuItem {
  label: string;
  path?: string;
  children?: MenuItem[];
  separator?: boolean;
}

const menuStructure: MenuItem[] = [
  {
    label: "File",
    children: [
      { label: "Beranda", path: "/" },
    ],
  },
  {
    label: "Parameter",
    children: [
      { label: "Data Umum Desa", path: "/data-umum" },
      { label: "separator", separator: true },
      { label: "Referensi Kegiatan", path: "/parameter/bidang-kegiatan" },
      { label: "Referensi Sumberdana", path: "/parameter/sumber-dana" },
      { label: "Rekening APB Desa", path: "/parameter/rekening" },
      { label: "Output Kegiatan DD", path: "/parameter/output-kegiatan" },
      { label: "separator2", separator: true },
      { label: "Detail Kegiatan", path: "/detail-kegiatan" },
    ],
  },
  {
    label: "Penganggaran",
    children: [
      { label: "Pendapatan Desa", path: "/penganggaran/pendapatan" },
      { label: "Belanja Desa", path: "/penganggaran/belanja" },
      { label: "Pembiayaan Desa", path: "/penganggaran/pembiayaan" },
    ],
  },
  {
    label: "Penatausahaan",
    children: [
      { label: "Penerimaan Desa", path: "/penatausahaan/penerimaan" },
      { label: "separator", separator: true },
      { label: "SPP Panjar Kegiatan", path: "/penatausahaan/spp-panjar" },
      { label: "SPP Definitif", path: "/penatausahaan/spp-definitif" },
      { label: "SPP Pengeluaran Pembiayaan", path: "/penatausahaan/spp-pembiayaan" },
      { label: "SPJ Kegiatan", path: "/penatausahaan/spj" },
      { label: "separator2", separator: true },
      { label: "Penyetoran Pajak", path: "/penatausahaan/penyetoran-pajak" },
      { label: "Mutasi Kas", path: "/penatausahaan/mutasi-kas" },
    ],
  },
  {
    label: "Pembukuan",
    children: [
      { label: "Saldo Awal", path: "/pembukuan/saldo-awal" },
      { label: "Jurnal Umum", path: "/pembukuan/jurnal-umum" },
    ],
  },
  {
    label: "Laporan",
    children: [
      {
        label: "Penganggaran",
        children: [
          { label: "Penjabaran APBDes", path: "/laporan/penjabaran" },
        ],
      },
      {
        label: "Realisasi",
        children: [
          { label: "LRA — Realisasi APBDes", path: "/laporan/lra" },
          { label: "LRA Desa per Kegiatan", path: "/laporan/lra-desa" },
        ],
      },
      {
        label: "Penatausahaan",
        children: [
          { label: "Buku Kas Umum (BKU)", path: "/laporan/bku" },
          { label: "Buku Pembantu Pajak", path: "/laporan/bkp-pajak" },
        ],
      },
      {
        label: "Neraca",
        children: [
          { label: "Laporan Kekayaan Milik Desa", path: "/laporan/neraca" },
        ],
      },
    ],
  },
  {
    label: "Admin",
    children: [
      { label: "Login Admin", path: "/admin" },
      { label: "separator", separator: true },
      { label: "Tentang Aplikasi", path: "/tentang" },
    ],
  },
];

export default function TopMenuBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setOpenSub(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpenMenu(null);
    setOpenSub(null);
  };

  const isActivePath = (item: MenuItem): boolean => {
    if (item.path && item.path === location.pathname) return true;
    if (item.children) return item.children.some(isActivePath);
    return false;
  };

  return (
    <div ref={barRef} className="relative z-50">
      {/* Single header bar matching mockup */}
      <div className="bg-gradient-to-r from-[hsl(152,40%,12%)] to-[hsl(152,35%,18%)] border-b border-[hsl(152,30%,25%)] flex items-center px-4 h-11 shadow-md">
        {/* Logo + App name (left) */}
        <div className="flex items-center gap-2.5 mr-6 shrink-0 cursor-pointer" onClick={() => handleNavigate("/")}>
          <div className="w-8 h-8 rounded-lg bg-emerald-600/90 flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 text-white">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div className="leading-tight">
            <span className="text-[11px] font-semibold text-white block">Sistem Pengelolaan</span>
            <span className="text-[11px] font-semibold text-white block">Keuangan Desa</span>
            <span className="text-[9px] text-emerald-300/80 italic">For Education</span>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/20 mr-4" />

        {/* Menu items (center/right) */}
        <div className="flex items-center gap-0.5">
          {menuStructure.map((menu) => {
            const active = isActivePath(menu);
            return (
              <div key={menu.label} className="relative">
                <button
                  className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-all duration-150
                    ${openMenu === menu.label
                      ? "bg-white/15 text-white"
                      : active
                      ? "text-emerald-300 font-semibold"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  onClick={() => {
                    if (menu.children) {
                      setOpenMenu(openMenu === menu.label ? null : menu.label);
                    } else if (menu.path) {
                      handleNavigate(menu.path);
                    }
                  }}
                  onMouseEnter={() => openMenu && openMenu !== menu.label && setOpenMenu(menu.label)}
                >
                  {menu.label}
                </button>
                {openMenu === menu.label && menu.children && (
                  <div className="absolute left-0 top-full mt-1 bg-popover border border-border shadow-xl rounded-lg min-w-[230px] py-1 z-50 animate-dropdown-in origin-top">
                    {menu.children.map((item) => {
                      if (item.separator) {
                        return <div key={item.label} className="border-t border-border my-1 mx-3" />;
                      }
                      if (item.children) {
                        return (
                          <div
                            key={item.label}
                            className="relative"
                            onMouseEnter={() => setOpenSub(item.label)}
                            onMouseLeave={() => setOpenSub(null)}
                          >
                            <button
                              className={`w-full text-left px-4 py-1.5 text-xs flex items-center justify-between rounded-sm mx-1 transition-colors duration-100
                                ${openSub === item.label ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                              style={{ width: 'calc(100% - 8px)' }}
                            >
                              <span>{item.label}</span>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 ml-3 opacity-50">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </button>
                            {openSub === item.label && (
                              <div className="absolute left-full top-0 bg-popover border border-border shadow-xl rounded-md min-w-[250px] py-1 z-50 animate-dropdown-in origin-top-left -ml-0.5">
                                {item.children.map((sub) =>
                                  <button
                                    key={sub.label}
                                    className={`w-full text-left px-4 py-1.5 text-xs transition-colors duration-100 rounded-sm mx-1 hover:bg-primary/10 hover:text-primary
                                      ${sub.path === location.pathname ? "bg-primary/10 text-primary font-medium" : ""}`}
                                    style={{ width: 'calc(100% - 8px)' }}
                                    onClick={() => sub.path && handleNavigate(sub.path)}
                                  >
                                    {sub.label}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <button
                          key={item.label}
                          className={`w-full text-left px-4 py-1.5 text-xs transition-colors duration-100 rounded-sm mx-1 hover:bg-primary/10 hover:text-primary
                            ${item.path === location.pathname ? "bg-primary/10 text-primary font-medium" : ""}`}
                          style={{ width: 'calc(100% - 8px)' }}
                          onClick={() => item.path && handleNavigate(item.path)}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
