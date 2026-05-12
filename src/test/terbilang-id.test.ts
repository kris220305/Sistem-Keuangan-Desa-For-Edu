import { describe, expect, it } from "vitest";
import { terbilangId, terbilangRupiah } from "@/lib/terbilang-id";

describe("terbilang-id", () => {
  it("angka dasar", () => {
    expect(terbilangId(0)).toBe("nol");
    expect(terbilangId(1)).toBe("satu");
    expect(terbilangId(10)).toBe("sepuluh");
    expect(terbilangId(11)).toBe("sebelas");
    expect(terbilangId(15)).toBe("lima belas");
    expect(terbilangId(21)).toBe("dua puluh satu");
    expect(terbilangId(100)).toBe("seratus");
    expect(terbilangId(101)).toBe("seratus satu");
    expect(terbilangId(110)).toBe("seratus sepuluh");
  });

  it("ribuan dan seterusnya", () => {
    expect(terbilangId(1000)).toBe("seribu");
    expect(terbilangId(1500)).toBe("seribu lima ratus");
    expect(terbilangId(1234567)).toBe("satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh");
  });

  it("negatif dan rupiah", () => {
    expect(terbilangId(-2)).toBe("minus dua");
    expect(terbilangRupiah(12)).toBe("dua belas rupiah");
  });
});

