import { isSocAnnualCalendarTitle, parseSocHolidayPublication, socPlainText } from "./official-calendar";
import { officialSocUrl, SocSourceReader } from "./official-http";
import type { OfficialHolidayInput } from "./repository";

export type OfficialHolidayCalendar = {
  holidays: OfficialHolidayInput[];
  coverage: "FULL_YEAR" | "PARTIAL";
  cached: boolean;
  annualSourceUrl?: string;
};

export interface HolidaySource {
  fetchYear(year: number): Promise<OfficialHolidayInput[]>;
  fetchCalendarYear?(year: number): Promise<OfficialHolidayCalendar>;
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
  private discoveredUrls = new Map<number, string>();

  sourceUrl(year: number): string {
    if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("OFFICIAL_SOURCE_INVALID");
    return this.discoveredUrls.get(year) ?? SOURCE_URLS[year] ?? `https://www.soc.go.th/?s=${encodeURIComponent(`วันหยุดราชการ ${year + 543}`)}`;
  }

  async fetchYear(year: number): Promise<OfficialHolidayInput[]> {
    return (await this.fetchCalendarYear(year)).holidays;
  }

  async fetchCalendarYear(year: number): Promise<OfficialHolidayCalendar> {
    const originalUrl = this.sourceUrl(year);
    const reader = new SocSourceReader();
    const partial = new Map<string, OfficialHolidayInput>();
    const visited = new Set<string>();
    let annual: { holidays: OfficialHolidayInput[]; url: string; priority: number } | null = null;
    let failure = new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    const remember = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "";
      const priority = (message: string) => message === "OFFICIAL_SOURCE_TOO_LARGE" ? 3 : message === "OFFICIAL_SOURCE_INVALID" ? 2 : 1;
      if (errorMessage.startsWith("OFFICIAL_SOURCE_") && priority(errorMessage) >= priority(failure.message)) failure = new Error(errorMessage);
    };
    const parse = (html: string, url: string, priority: number): void => {
      const publication = parseSocHolidayPublication(html, year, url);
      if (publication.coverage === "FULL_YEAR") {
        if (!annual || priority > annual.priority) annual = { holidays: publication.holidays, url, priority };
        return;
      }
      // WordPress returns newest posts first; keep the first announcement for a date.
      for (const holiday of publication.holidays) if (!partial.has(holiday.date)) partial.set(holiday.date, holiday);
    };
    const candidateTitle = (title: string) => {
      const text = socPlainText(title);
      return isSocAnnualCalendarTitle(title, year)
        || (/วันหยุดราชการ/.test(text) && /เพิ่มเติม|เพิ่มเป็นกรณีพิเศษ|กรณีพิเศษ/.test(text) && text.includes(String(year + 543)));
    };
    const readPage = async (url: string, priority: number): Promise<void> => {
      const safeUrl = officialSocUrl(url);
      if (visited.has(safeUrl)) return;
      visited.add(safeUrl);
      parse(await reader.read(safeUrl, "html"), safeUrl, priority);
    };
    try {
      if (SOURCE_URLS[year] || this.discoveredUrls.has(year)) {
        try {
          await readPage(originalUrl, 1);
        } catch (error) { remember(error); }
      }

      // WordPress returns the post's official URL and rendered body, avoiding annual post-id configuration.
      try {
        const restUrl = `https://www.soc.go.th/wp-json/wp/v2/posts?search=${year + 543}&per_page=20&_fields=link,title,content`;
        const posts: unknown = JSON.parse(await reader.read(restUrl, "json"));
        if (!Array.isArray(posts) || posts.length > 20) throw new Error("OFFICIAL_SOURCE_INVALID");
        for (const post of posts) {
          if (!post || typeof post !== "object") continue;
          const title = post.title?.rendered;
          if (typeof title !== "string" || !candidateTitle(title)) continue;
          try {
            if (typeof post.link !== "string" || typeof post.content?.rendered !== "string") throw new Error("OFFICIAL_SOURCE_INVALID");
            const url = officialSocUrl(post.link);
            visited.add(url);
            parse(`<h1>${title}</h1>${post.content.rendered}`, url, 3);
          } catch (error) { remember(error); }
        }
      } catch (error) { remember(error); }

      const searchUrl = `https://www.soc.go.th/?s=${encodeURIComponent(`วันหยุดราชการ ${year + 543}`)}`;
      for (const listingUrl of [searchUrl, "https://www.soc.go.th/?cat=190", "https://www.soc.go.th/?page_id=7557"]) {
        try {
          const html = await reader.read(listingUrl, "html");
          for (const link of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
            if (!candidateTitle(link[3])) continue;
            try {
              const url = officialSocUrl(link[2].replace(/&amp;/gi, "&"), listingUrl);
              await readPage(url, 2);
            } catch (error) { remember(error); }
          }
        } catch (error) { remember(error); }
      }
      if (annual || partial.size) {
        // The selected annual publication is a snapshot; later announcements add/override dates.
        const selectedAnnual = annual as { holidays: OfficialHolidayInput[]; url: string } | null;
        const combined = new Map(selectedAnnual?.holidays.map((holiday) => [holiday.date, holiday]) ?? []);
        for (const holiday of partial.values()) combined.set(holiday.date, holiday);
        const holidays = [...combined.values()].sort((a, b) => a.date.localeCompare(b.date));
        this.discoveredUrls.set(year, selectedAnnual?.url ?? holidays[0].sourceUrl);
        return {
          holidays,
          coverage: selectedAnnual ? "FULL_YEAR" : "PARTIAL",
          cached: false,
          ...(selectedAnnual ? { annualSourceUrl: selectedAnnual.url } : {}),
        };
      }
      const fallback = fallbackHolidays(year, originalUrl);
      if (fallback) return { holidays: fallback, coverage: "PARTIAL", cached: true };
      throw failure;
    } finally {
      reader.close();
    }
  }
}
