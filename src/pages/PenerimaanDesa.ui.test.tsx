import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PenerimaanDesa from "@/pages/PenerimaanDesa";

function seedLocalStorage() {
  localStorage.setItem("siskeudes_desa_profile", JSON.stringify({ namaDesa: "Desa Test" }));
  localStorage.setItem(
    "siskeudes_state",
    JSON.stringify({
      silpa: [
        {
          id: "s1",
          tanggal: "2024-01-01",
          nomorBukti: "SILPA-001",
          uraian: "SiLPA Tahun Lalu",
          isProses: false,
          rincian: [
            { id: "sr1", kodeRekening: "1.1.01", namaRekening: "Kas", debet: 100000, kredit: 100000 },
          ],
        },
      ],
      penerimaan: [
        {
          id: "t1",
          jenis: "tunai",
          tanggal: "2024-01-02",
          noBukti: "0001/TBP/05.2001/2024",
          uraian: "Penerimaan tunai",
          jumlah: 50000,
          kodeRekening: "",
          namaRekening: "",
          penyetor: "",
          nama: "Andi",
          alamat: "",
          ttd: "",
          rincian: [
            { id: "tr1", kodeRekening: "4.1.01", namaRekening: "Pendapatan A", sumberDana: "PAD", nilai: 50000 },
          ],
        },
        {
          id: "b1",
          jenis: "bank",
          tanggal: "2024-01-03",
          noBukti: "0002/TBP/05.2001/2024",
          uraian: "Penerimaan bank",
          jumlah: 60000,
          kodeRekening: "",
          namaRekening: "",
          penyetor: "",
          nama: "Budi",
          alamat: "",
          ttd: "",
          rekening: "1234567890",
          namaBank: "BRI",
          kppn: "KPPN X",
          rincian: [
            { id: "br1", kodeRekening: "4.1.02", namaRekening: "Pendapatan B", sumberDana: "ADD", nilai: 60000 },
          ],
        },
      ],
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  seedLocalStorage();
});

describe("PenerimaanDesa – tampilan detail mengikuti baris yang dipilih", () => {
  it("menampilkan detail SiLPA setelah memilih baris", () => {
    render(
      <MemoryRouter>
        <PenerimaanDesa />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("SILPA-001"));
    expect(screen.getByDisplayValue("SILPA-001")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SiLPA Tahun Lalu")).toBeInTheDocument();
  });

  it("menampilkan detail Penerimaan Tunai setelah memilih baris", () => {
    render(
      <MemoryRouter>
        <PenerimaanDesa />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Penerimaan Tunai" }));
    expect(screen.getByText("REALISASI PENERIMAAN TUNAI")).toBeInTheDocument();
    fireEvent.click(screen.getByText("0001/TBP/05.2001/2024"));
    expect(screen.getByDisplayValue("0001/TBP/05.2001/2024")).toBeInTheDocument();
    const tabPenyetor = screen.getByRole("tab", { name: "Penyetor" });
    fireEvent.pointerDown(tabPenyetor);
    fireEvent.click(tabPenyetor);
    expect(screen.getByDisplayValue("Andi")).toBeInTheDocument();
  });

  it("menampilkan detail Penerimaan Bank setelah memilih baris", () => {
    render(
      <MemoryRouter>
        <PenerimaanDesa />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Penerimaan Bank" }));
    expect(screen.getByText("REALISASI PENERIMAAN BANK")).toBeInTheDocument();
    fireEvent.click(screen.getByText("0002/TBP/05.2001/2024"));
    const tabBank = screen.getByRole("tab", { name: "Bank" });
    fireEvent.pointerDown(tabBank);
    fireEvent.click(tabBank);
    expect(screen.getByDisplayValue("1234567890")).toBeInTheDocument();
    expect(screen.getByDisplayValue("BRI")).toBeInTheDocument();
  });
});
