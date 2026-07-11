const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiBaht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

export function formatThaiDate(iso: string): string {
  return thaiDate.format(new Date(`${iso}T12:00:00+07:00`));
}

export function formatBaht(value: number): string {
  return thaiBaht.format(value);
}

export function isWeekendIso(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00+07:00`).getDay();
  return day === 0 || day === 6;
}
