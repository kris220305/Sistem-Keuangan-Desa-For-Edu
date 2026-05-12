const angka = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];

function tigaDigit(n: number): string {
  const a = Math.floor(n / 100);
  const b = Math.floor((n % 100) / 10);
  const c = n % 10;

  const parts: string[] = [];
  if (a > 0) parts.push(a === 1 ? "seratus" : `${angka[a]} ratus`);
  if (b === 1) {
    if (c === 0) parts.push("sepuluh");
    else if (c === 1) parts.push("sebelas");
    else parts.push(`${angka[c]} belas`);
  } else {
    if (b > 1) parts.push(`${angka[b]} puluh`);
    if (c > 0) parts.push(angka[c]);
  }
  return parts.join(" ").trim();
}

export function terbilangId(n: number): string {
  if (!Number.isFinite(n)) return "";
  const neg = n < 0;
  let x = Math.floor(Math.abs(n));
  if (x === 0) return "nol";

  const groups = ["", "ribu", "juta", "miliar", "triliun"];
  const parts: string[] = [];
  let i = 0;
  while (x > 0 && i < groups.length) {
    const chunk = x % 1000;
    if (chunk) {
      let t = tigaDigit(chunk);
      const g = (i === 1 && chunk === 1) ? "" : groups[i];
      if (i === 1 && chunk === 1) t = "seribu";
      parts.unshift([t, g].filter(Boolean).join(" "));
    }
    x = Math.floor(x / 1000);
    i += 1;
  }
  const out = parts.join(" ").trim();
  return (neg ? `minus ${out}` : out).trim();
}

export function terbilangRupiah(n: number): string {
  const t = terbilangId(n);
  return t ? `${t} rupiah` : "";
}
