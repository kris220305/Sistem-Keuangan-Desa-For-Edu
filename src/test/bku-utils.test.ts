import { describe, expect, it } from "vitest";
import { buildBkuFilename, formatPeriodeKey, formatTanggalId, sanitizeFilePart } from "@/lib/bku-utils";

describe("bku-utils", () => {
  it("sanitizeFilePart mengubah spasi dan karakter khusus jadi underscore", () => {
    expect(sanitizeFilePart("Desa Simulasi / Unit A")).toBe("Desa_Simulasi_Unit_A");
    expect(sanitizeFilePart("")).toBe("");
  });

  it("formatPeriodeKey membentuk key periode", () => {
    expect(formatPeriodeKey("2024-01-01", "2024-12-31")).toBe("20240101-20241231");
    expect(formatPeriodeKey("2024-01-01", "")).toBe("20240101");
    expect(formatPeriodeKey("", "2024-12-31")).toBe("20241231");
    expect(formatPeriodeKey("", "")).toBe("periode");
  });

  it("formatTanggalId mengubah YYYY-MM-DD ke DD/MM/YYYY", () => {
    expect(formatTanggalId("2024-02-03")).toBe("03/02/2024");
    expect(formatTanggalId("xx")).toBe("xx");
  });

  it("buildBkuFilename mengikuti format BKU_<jenis>_<unit>_<periode>.<ext>", () => {
    const f = buildBkuFilename({ jenis: "tunai", unit: "Desa Simulasi", start: "2024-01-01", end: "2024-12-31", ext: "pdf" });
    expect(f).toBe("BKU_TUNAI_Desa_Simulasi_20240101-20241231.pdf");
    const f2 = buildBkuFilename({ jenis: "utama", unit: "Unit", start: "2024-01-01", end: "2024-12-31", ext: "xlsx" });
    expect(f2).toBe("BKU_UTAMA_Unit_20240101-20241231.xlsx");
    const f3 = buildBkuFilename({ jenis: "bank", unit: "Unit", start: "2024-01-01", end: "2024-12-31", ext: "pdf" });
    expect(f3).toBe("BKU_BANK_Unit_20240101-20241231.pdf");
  });
});
