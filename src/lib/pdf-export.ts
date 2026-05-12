/**
 * PDF Export utility using html2canvas + jspdf
 */
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export function getTahunAnggaran(): string {
  const desaProfile = JSON.parse(localStorage.getItem('siskeudes_desa_profile') || '{}');
  return desaProfile.tahunAnggaran || new Date().getFullYear().toString();
}

export function getTahunLalu(): string {
  const tahun = parseInt(getTahunAnggaran());
  return (tahun - 1).toString();
}

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Temporarily show all content for printing
  const origOverflow = element.style.overflow;
  const origHeight = element.style.height;
  element.style.overflow = 'visible';
  element.style.height = 'auto';
  
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });
  
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 10;
  const contentWidth = imgWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = margin;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);
  
  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }
  
  pdf.save(`${filename}.pdf`);
  
  // Restore
  element.style.overflow = origOverflow;
  element.style.height = origHeight;
}
