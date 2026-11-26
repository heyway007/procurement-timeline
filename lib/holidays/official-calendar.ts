import type { HolidayScope, OfficialHolidayInput } from "./repository";

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};
const SOURCE_LABEL = "สำนักเลขาธิการคณะรัฐมนตรี";
const HOLIDAY_NAME = /วัน(?:หยุด(?:ราชการ|ชดเชย)|ขึ้นปีใหม่|มาฆบูชา|จักรี|พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลก|สงกรานต์|ฉัตรมงคล|(?:พระราชพิธี)?พืชมงคล|วิสาขบูชา|อาสาฬหบูชา|เข้าพรรษา|เฉลิมพระชนมพรรษา|คล้ายวัน(?:พระบรมราชสมภพ|พระราชสมภพ|สวรรคต)|นวมินทรมหาราช|ปิยมหาราช|รัฐธรรมนูญ|สิ้นปี|แม่แห่งชาติ|พ่อแห่งชาติ)/;

export function socPlainText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|li|tr|h[1-6]|div|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
      const code = Number.parseInt(hex ?? decimal ?? "0", hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50))
    .replace(/[ \t\r]+/g, " ").trim();
}

export function isSocAnnualCalendarTitle(title: string, year: number): boolean {
  const text = socPlainText(title);
  if (/เพิ่มเติม|กรณีพิเศษ|ธนาคาร|สถาบันการเงิน|เอกชน|สถานเอกอัครราชทูต|ประชุม|เตรียม/.test(text)) return false;
  const compact = text.replace(/[\s.]/g, "");
  return new RegExp(`(?:ปฏิทิน|ภาพรวม)?วันหยุดราชการ(?:ประจำปี|ปี)?(?:พศ)?${year + 543}(?:\\D|$)`).test(compact);
}

function hasAnnualHeading(html: string, year: number): boolean {
  return [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .some((match) => isSocAnnualCalendarTitle(match[1], year));
}

function realDate(year: number, month: number, day: number): string {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() + 1 !== month || value.getUTCDate() !== day) {
    throw new Error("OFFICIAL_SOURCE_INVALID");
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Reads dated holiday rows; a publication's completeness is assessed separately. */
export function parseSocHolidayCalendar(html: string, year: number, sourceUrl: string): OfficialHolidayInput[] {
  const annual = hasAnnualHeading(html, year);
  const text = socPlainText(html);
  if (!annual && !/วันหยุดราชการ/.test(text)) throw new Error("OFFICIAL_SOURCE_INVALID");
  const rows = text.split(/\n+/).map((row) => row.trim()).filter(Boolean);
  const dates = new RegExp(`(?<!\\d)(?:(\\d{1,2})\\s+(${Object.keys(THAI_MONTHS).join("|")})(?:\\s+(\\d{4}))?|(\\d{1,2})\\s*/\\s*(\\d{1,2})\\s*/\\s*(\\d{4}))(?!\\d)`, "g");
  const byDate = new Map<string, OfficialHolidayInput>();
  for (const row of rows) {
    const dateMatches = [...row.matchAll(dates)];
    const remainder = dateMatches.reduce((text, match) => text.replace(match[0], " "), row);
    // A complete-looking calendar must not silently lose rows using an unknown date format.
    if (annual && HOLIDAY_NAME.test(row) && /\d{1,4}\s*[/|.-]\s*\d|\d{1,2}\s*[ก-๙]{1,3}\.|\d{1,2}\s+[ก-๙]+\s+\d{4}/.test(remainder)) {
      throw new Error("OFFICIAL_SOURCE_INVALID");
    }
    for (const match of dateMatches) {
      const declaredYear = match[3] ?? match[6];
      if (declaredYear ? Number(declaredYear) !== year && Number(declaredYear) - 543 !== year : !annual) continue;
      const afterDate = row.slice((match.index ?? 0) + match[0].length).trim();
      // The date in a special announcement must itself be designated as a holiday.
      if (!annual && !/^(?:เป็น|ให้เป็น)?\s*วันหยุดราชการ(?:เพิ่มเติม|เพิ่ม|เป็นกรณีพิเศษ|กรณีพิเศษ)/.test(afterDate)) continue;
      if (/ไม่(?:ถือ)?เป็นวันหยุดราชการ/.test(row)) continue;
      const nameMatch = HOLIDAY_NAME.exec(afterDate) ?? (annual ? HOLIDAY_NAME.exec(row.slice(0, match.index)) : null);
      if (!nameMatch) continue;
      const nameText = HOLIDAY_NAME.test(afterDate) ? afterDate : row.slice(0, match.index);
      const name = nameText.slice(nameMatch.index).replace(/\s+/g, " ").trim();
      if (!name || name.length > 500) throw new Error("OFFICIAL_SOURCE_INVALID");
      const date = realDate(year, match[2] ? THAI_MONTHS[match[2]] : Number(match[5]), Number(match[1] ?? match[4]));
      const scope: HolidayScope = /กรุงเทพมหานคร|กทม\./.test(name) ? "BANGKOK" : "NATIONWIDE";
      byDate.set(date, { date, name, scope, sourceUrl, sourceLabel: SOURCE_LABEL });
    }
  }
  const result = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (result.length === 0) throw new Error("OFFICIAL_SOURCE_INVALID");
  return result;
}

function hasCoreHolidays(holidays: OfficialHolidayInput[]): boolean {
  const nationwide = holidays.filter((holiday) => holiday.scope === "NATIONWIDE");
  const has = (name: RegExp, month?: string) => nationwide.some((holiday) => name.test(holiday.name) && (!month || holiday.date.slice(5, 7) === month));
  const songkran = nationwide.filter((holiday) => /สงกรานต์/.test(holiday.name) && holiday.date.slice(5, 7) === "04");
  return songkran.length >= 3 && has(/ขึ้นปีใหม่/, "01") && has(/มาฆบูชา/)
    && has(/จักรี|พระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลก/, "04") && has(/ฉัตรมงคล/, "05")
    && has(/พืชมงคล/, "05") && has(/วิสาขบูชา/) && has(/เข้าพรรษา/) && has(/อาสาฬหบูชา/)
    && has(/เฉลิมพระชนมพรรษา.*(?:ราชินี|สุทิดา)/, "06")
    && has(/เฉลิมพระชนมพรรษา.*(?:พระเจ้าอยู่หัว|วชิร)/, "07")
    && has(/แม่แห่งชาติ|พระบรมราชชนนีพันปีหลวง/, "08")
    && has(/นวมินทรมหาราช|คล้ายวันสวรรคต/, "10") && has(/ปิยมหาราช/, "10")
    && has(/พ่อแห่งชาติ|พระบรมราชสมภพ/, "12") && has(/รัฐธรรมนูญ/, "12") && has(/สิ้นปี/, "12");
}

export function parseSocHolidayPublication(html: string, year: number, sourceUrl: string): {
  holidays: OfficialHolidayInput[];
  coverage: "FULL_YEAR" | "PARTIAL";
} {
  const holidays = parseSocHolidayCalendar(html, year, sourceUrl);
  if (hasAnnualHeading(html, year)) {
    if (!hasCoreHolidays(holidays)) throw new Error("OFFICIAL_SOURCE_INVALID");
    return { holidays, coverage: "FULL_YEAR" };
  }
  return { holidays, coverage: "PARTIAL" };
}
