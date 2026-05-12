import { useState } from "react";
import FormPageHeader from "@/components/FormPageHeader";
import { bidangKegiatanData } from "@/data/siskeudes-data";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from "lucide-react";

export default function ParameterBidangKegiatan() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>(["01"]);

  const toggleExpand = (kode: string) => {
    setExpanded((prev) =>
      prev.includes(kode) ? prev.filter((k) => k !== kode) : [...prev, kode]
    );
  };

  const filtered = search
    ? bidangKegiatanData.filter(
        (item) =>
          item.kode.includes(search) ||
          item.nama.toLowerCase().includes(search.toLowerCase())
      )
    : bidangKegiatanData;

  const bidangs = filtered.filter((i) => i.level === "bidang");

  return (
    <div>
      <FormPageHeader title="Parameter Bidang & Kegiatan" subtitle="Referensi Bidang, Sub Bidang, dan Kegiatan Desa" />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama kegiatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="content-card divide-y divide-border">
          {bidangs.map((bidang) => {
            const isExpanded = expanded.includes(bidang.kode);
            const subBidangs = filtered.filter(
              (i) => i.level === "sub_bidang" && i.kode.startsWith(bidang.kode + ".")
            );
            return (
              <div key={bidang.kode}>
                <button
                  onClick={() => toggleExpand(bidang.kode)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                  {isExpanded ? <FolderOpen size={16} className="text-primary" /> : <Folder size={16} className="text-muted-foreground" />}
                  <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{bidang.kode}</span>
                  <span className="text-sm font-semibold">{bidang.nama}</span>
                </button>
                {isExpanded && (
                  <div className="pl-10 pb-2">
                    {subBidangs.map((sub) => {
                      const subExpanded = expanded.includes(sub.kode);
                      const kegiatans = filtered.filter(
                        (i) => i.level === "kegiatan" && i.kode.startsWith(sub.kode.replace(/\.$/, "") + ".")
                      );
                      return (
                        <div key={sub.kode}>
                          <button
                            onClick={() => toggleExpand(sub.kode)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary/30 rounded-md transition-colors text-left"
                          >
                            {subExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span className="font-mono text-[11px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{sub.kode}</span>
                            <span className="text-sm">{sub.nama}</span>
                          </button>
                          {subExpanded && (
                            <div className="pl-8 space-y-0.5 pb-1">
                              {kegiatans.map((keg) => (
                                <div
                                  key={keg.kode}
                                  className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                                >
                                  <FileText size={12} className="text-muted-foreground" />
                                  <span className="font-mono text-[11px] text-muted-foreground">{keg.kode}</span>
                                  <span className="text-xs">{keg.nama}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
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
