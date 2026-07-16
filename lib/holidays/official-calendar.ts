import type { HolidayScope, OfficialHolidayInput } from "./repository";

const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
};

const SOURCE_LABEL = "สำนักเลขาธิการคณะรัฐมนตรี";

function plainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ");
}

export function parseSocHolidayCalendar(html: string, year: number, sourceUrl: string): OfficialHolidayInput[] {
  const text = plainText(html);
  const monthPattern = Object.keys(THAI_MONTHS).join("|");
  const pattern = new RegExp(`(?:วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์|อาทิตย์)ที่\\s*)?(\\d{1,2})\\s+(${monthPattern})\\s+(25\\d{2})([^\\n]{2,240})`, "g");
  const byDate = new Map<string, OfficialHolidayInput>();
  for (const match of text.matchAll(pattern)) {
    const gregorianYear = Number(match[3]) - 543;
    if (gregorianYear !== year) continue;
    const month = THAI_MONTHS[match[2]];
    const date = `${year}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    const rawName = match[4].replace(/^\s*[-–—:]?\s*/, "").trim();
    if (!rawName || !/วันหยุด|วันขึ้นปีใหม่|วันจักรี|วันสงกรานต์|วันฉัตรมงคล|วันวิสาขบูชา|วันอาสาฬหบูชา|วันเข้าพรรษา|วันเฉลิมพระชนมพรรษา|วันปิยมหาราช|วันรัฐธรรมนูญ|วันคล้ายวัน/.test(rawName)) continue;
    const scope: HolidayScope = /กรุงเทพมหานคร|กทม\./.test(rawName) ? "BANGKOK" : "NATIONWIDE";
    byDate.set(date, { date, name: rawName, scope, sourceUrl, sourceLabel: SOURCE_LABEL });
  }
  const result = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (result.length === 0) throw new Error("OFFICIAL_SOURCE_INVALID");
  return result;
}

