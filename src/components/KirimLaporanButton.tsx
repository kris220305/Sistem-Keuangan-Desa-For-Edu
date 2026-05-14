import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { isCurrentUserLeader, submitReport } from "@/lib/session-manager";
import { loadState } from "@/data/app-state";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function KirimLaporanButton() {
  const [isLeader, setIsLeader] = useState(false);
  const [sending, setSending] = useState(false);
  const groupId = localStorage.getItem("siskeudes_group_id");

  useEffect(() => {
    if (groupId) {
      isCurrentUserLeader().then(setIsLeader);
    }
  }, [groupId]);

  if (!groupId || !isLeader) return null;

  const handleKirim = async () => {
    setSending(true);
    try {
      const state = loadState();
      const sessionProgress = JSON.parse(localStorage.getItem("siskeudes_app_state") || "{}");

      const sessionId = localStorage.getItem("siskeudes_session_id") || "";
      const res = await submitReport({ ...state, _progress: sessionProgress });
      const reportId = (res as any)?.id as string | undefined;

      // Generate and upload PDF of current report page
      const reportContent = document.querySelector("[id$='-content']") as HTMLElement;
      if (reportContent) {
        try {
          const canvas = await html2canvas(reportContent, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL("image/jpeg", 0.9);
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          let heightLeft = pdfHeight;
          let position = 0;
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
          
          while (heightLeft > 0) {
            position = -(pdfHeight - heightLeft);
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
          }
          
          const pdfBlob = pdf.output("blob");
          const desaProfile = JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}");
          const userName = localStorage.getItem("siskeudes_user_name") || "unknown";
          const villageName = (desaProfile.namaDesa || "unknown").replace(/\s+/g, "_");
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
          
          // Get report type from the page title/id
          const contentEl = document.querySelector("[id$='-content']");
          const reportType = contentEl?.id?.replace("-content", "") || "laporan";
          
          const fileName = `${reportType}_${dateStr}_${timeStr}.pdf`;
          if (isConvexEnabled && convex && reportId && sessionId) {
            const { uploadUrl } = await convex.mutation(anyApi.reportSubmissions.generateUploadUrl, {
              sessionId,
              reportId,
            } as any);
            const uploadRes = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": "application/pdf" },
              body: pdfBlob,
            });
            if (uploadRes.ok) {
              const uploadJson = await uploadRes.json();
              const storageId = uploadJson.storageId as string;
              await convex.mutation(anyApi.reportSubmissions.attachPdf, {
                sessionId,
                reportId,
                storageId,
                fileName,
              } as any);
            }
          }
        } catch (err) {
          console.error("PDF upload error:", err);
        }
      }

      toast.success("Laporan berhasil dikirim ke Admin!");
    } catch {
      toast.error("Gagal mengirim laporan");
    } finally {
      setSending(false);
    }
  };

  return (
    <Button size="sm" onClick={handleKirim} disabled={sending} variant="default" className="gap-2 bg-green-600 hover:bg-green-700">
      <Send size={14} /> {sending ? "Mengirim..." : "Kirim ke Admin"}
    </Button>
  );
}
