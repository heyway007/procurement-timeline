import { parseSocHolidayCalendar } from "./official-calendar";
import type { OfficialHolidayInput } from "./repository";

export interface HolidaySource {
  fetchYear(year: number): Promise<OfficialHolidayInput[]>;
  sourceUrl(year: number): string;
}

const SOURCE_URLS: Record<number, string> = {
  2026: "https://www.soc.go.th/?p=33672",
};

const SOURCE_LABEL = "สำนักเลขาธิการคณะรัฐมนตรี";

const FALLBACK_HOLIDAYS: Record<number, Omit<OfficialHolidayInput, "sourceUrl" | "sourceLabel">[]> = {
  2026: [
    { date: "2026-01-01", name: "วันขึ้นปีใหม่", scope: "NATIONWIDE" },
    { date: "2026-01-02", name: "วันหยุดราชการเพิ่มเป็นกรณีพิเศษ", scope: "NATIONWIDE" },
    { date: "2026-03-03", name: "วันมาฆบูชา", scope: "NATIONWIDE" },
    { date: "2026-04-06", name: "วันจักรี", scope: "NATIONWIDE" },
    { date: "2026-04-13", name: "วันสงกรานต์", scope: "NATIONWIDE" },
    { date: "2026-04-14", name: "วันสงกรานต์", scope: "NATIONWIDE" },
    { date: "2026-04-15", name: "วันสงกรานต์", scope: "NATIONWIDE" },
    { date: "2026-05-04", name: "วันฉัตรมงคล", scope: "NATIONWIDE" },
    { date: "2026-05-11", name: "วันพืชมงคล", scope: "NATIONWIDE" },
    { date: "2026-06-01", name: "วันหยุดชดเชยวันวิสาขบูชา", scope: "NATIONWIDE" },
    { date: "2026-06-03", name: "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี", scope: "NATIONWIDE" },
    { date: "2026-07-28", name: "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว", scope: "NATIONWIDE" },
    { date: "2026-07-29", name: "วันอาสาฬหบูชา", scope: "NATIONWIDE" },
    { date: "2026-07-30", name: "วันเข้าพรรษา", scope: "NATIONWIDE" },
    { date: "2026-08-12", name: "วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง และวันแม่แห่งชาติ", scope: "NATIONWIDE" },
    { date: "2026-10-13", name: "วันคล้ายวันสวรรคตพระบาทสมเด็จพระบรมชนกาธิเบศรฯ", scope: "NATIONWIDE" },
    { date: "2026-10-16", name: "วันหยุดราชการเป็นกรณีพิเศษในพื้นที่กรุงเทพมหานคร", scope: "BANGKOK" },
    { date: "2026-10-23", name: "วันปิยมหาราช", scope: "NATIONWIDE" },
    { date: "2026-12-05", name: "วันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9 วันชาติ และวันพ่อแห่งชาติ", scope: "NATIONWIDE" },
    { date: "2026-12-07", name: "วันหยุดชดเชยวันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9", scope: "NATIONWIDE" },
    { date: "2026-12-10", name: "วันรัฐธรรมนูญ", scope: "NATIONWIDE" },
    { date: "2026-12-31", name: "วันสิ้นปี", scope: "NATIONWIDE" },
  ],
};

function fallbackHolidays(year: number, sourceUrl: string): OfficialHolidayInput[] | null {
  const holidays = FALLBACK_HOLIDAYS[year];
  if (!holidays) return null;
  return holidays.map((holiday) => ({
    ...holiday,
    sourceUrl,
    sourceLabel: `${SOURCE_LABEL} (ข้อมูลสำรอง)`,
  }));
}

export class SocHolidaySource implements HolidaySource {
  sourceUrl(year: number): string {
    const url = SOURCE_URLS[year];
    if (!url) throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    return url;
  }

  async fetchYear(year: number): Promise<OfficialHolidayInput[]> {
    const url = this.sourceUrl(year);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ProcurementTimeline/1.0 (+official-holiday-sync)", Accept: "text/html" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("text/html")) throw new Error("OFFICIAL_SOURCE_INVALID");
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > 2_000_000) throw new Error("OFFICIAL_SOURCE_TOO_LARGE");
      const html = await response.text();
      if (Buffer.byteLength(html, "utf8") > 2_000_000) throw new Error("OFFICIAL_SOURCE_TOO_LARGE");
      return parseSocHolidayCalendar(html, year, url);
    } catch (error: unknown) {
      const fallback = fallbackHolidays(year, url);
      if (fallback) return fallback;
      if (error instanceof Error && error.message.startsWith("OFFICIAL_SOURCE_")) throw error;
      throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }
}
