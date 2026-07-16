const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new Error("INVALID_ISO_DATE");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) {
    throw new Error("INVALID_ISO_DATE");
  }

  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function plusCalendarDay(value: string): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatIsoDate(date);
}

export function isWorkingDay(
  value: string,
  holidays: ReadonlySet<string>,
): boolean {
  const day = parseIsoDate(value).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(value);
}

export function addWorkingDays(
  value: string,
  amount: number,
  holidays: ReadonlySet<string>,
): string {
  parseIsoDate(value);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("INVALID_WORKING_DAY_AMOUNT");
  }

  let cursor = value;
  let additions = 0;
  while (additions < amount) {
    cursor = plusCalendarDay(cursor);
    if (isWorkingDay(cursor, holidays)) {
      additions += 1;
    }
  }

  return cursor;
}

export function countWorkingDayAdditions(
  from: string,
  to: string,
  holidays: ReadonlySet<string>,
): number {
  parseIsoDate(from);
  parseIsoDate(to);
  if (to <= from) {
    throw new Error("DATE_MUST_BE_AFTER_PREVIOUS");
  }
  if (!isWorkingDay(to, holidays)) {
    throw new Error("DATE_MUST_BE_WORKING_DAY");
  }

  let cursor = from;
  let additions = 0;
  while (cursor < to) {
    cursor = plusCalendarDay(cursor);
    if (isWorkingDay(cursor, holidays)) {
      additions += 1;
    }
  }

  return additions;
}
