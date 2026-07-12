import { parseSocHolidayCalendar } from "./official-calendar";
import type { OfficialHolidayInput } from "./repository";

export interface HolidaySource {
  fetchYear(year: number): Promise<OfficialHolidayInput[]>;
  sourceUrl(year: number): string;
}

const SOURCE_URLS: Record<number, string> = {
  2026: "https://www.soc.go.th/?p=33672",
};

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
      if (error instanceof Error && error.message.startsWith("OFFICIAL_SOURCE_")) throw error;
      throw new Error("OFFICIAL_SOURCE_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }
}
