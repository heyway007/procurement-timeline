const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiShortDateParts = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiLongDateParts = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiMonthYear = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const thaiBaht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});

export type CalendarDay = {
  iso: string;
  day: number;
  inMonth: boolean;
  selected: boolean;
};

function dateFromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00+07:00`);
}

function dateParts(
  formatter: Intl.DateTimeFormat,
  iso: string,
): Record<string, string> {
  return Object.fromEntries(
    formatter.formatToParts(dateFromIso(iso)).map((part) => [part.type, part.value]),
  );
}

function isoFromUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWorkingIsoDate(iso: string, holidays: ReadonlySet<string>): boolean {
  const day = dateFromIso(iso).getDay();
  return day !== 0 && day !== 6 && !holidays.has(iso);
}

export function formatThaiDate(iso: string): string {
  return thaiDate.format(dateFromIso(iso));
}

export function formatBaht(value: number): string {
  return thaiBaht.format(value);
}

export function isWeekendIso(iso: string): boolean {
  const day = dateFromIso(iso).getDay();
  return day === 0 || day === 6;
}

export function previousWorkingDate(
  iso: string,
  holidays: ReadonlySet<string> = new Set(),
): string {
  const date = dateFromIso(iso);
  do {
    date.setDate(date.getDate() - 1);
  } while (!isWorkingIsoDate(isoFromUtcDate(date), holidays));

  return isoFromUtcDate(date);
}

export function formatThaiDateWithWeekday(iso: string): string {
  const parts = dateParts(thaiShortDateParts, iso);
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

export function formatThaiDateRangeWithWeekday(startIso: string, endIso: string): string {
  return `${formatThaiDateWithWeekday(startIso)} - ${formatThaiDateWithWeekday(endIso)}`;
}

export function formatThaiFullDateWithWeekday(iso: string): string {
  const parts = dateParts(thaiLongDateParts, iso);
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

export function formatThaiMonthYear(iso: string): string {
  return thaiMonthYear.format(dateFromIso(iso));
}

export function buildMonthCalendar(iso: string): CalendarDay[] {
  const [year, month] = iso.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(firstOfMonth);
  start.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dayIso = isoFromUtcDate(date);
    return {
      iso: dayIso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
      selected: dayIso === iso,
    };
  });
}
