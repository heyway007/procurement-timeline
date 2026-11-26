import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSocHolidayCalendar } from "@/lib/holidays/official-calendar";
import { SocHolidaySource } from "@/lib/holidays/official-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSocHolidayCalendar", () => {
  it("reads split table cells, Thai numerals, and holiday names omitted by the old matcher", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8");
    const holidays = parseSocHolidayCalendar(html, 2027, "https://www.soc.go.th/?p=45123");
    expect(holidays).toHaveLength(19);
    expect(holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-22", name: "วันหยุดชดเชยวันมาฆบูชา" }),
      expect.objectContaining({ date: "2027-05-10", name: "วันพระราชพิธีพืชมงคลจรดพระนังคัลแรกนาขวัญ" }),
      expect.objectContaining({ date: "2027-10-13", name: "วันนวมินทรมหาราช" }),
      expect.objectContaining({ date: "2027-12-31", name: "วันสิ้นปี" }),
    ]));
  });

  it("rejects impossible dates instead of normalizing them into a different month", () => {
    expect(() => parseSocHolidayCalendar("<h1>วันหยุดราชการ ปี 2570</h1><p>31 กุมภาพันธ์ 2570 วันมาฆบูชา</p>", 2027, "https://www.soc.go.th/")).toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("does not import a meeting date from an article mentioning a holiday", () => {
    expect(() => parseSocHolidayCalendar("<h1>ประชุมเตรียมการวันมาฆบูชา</h1><p>15 กุมภาพันธ์ 2570 ประชุมเตรียมงานวันมาฆบูชา</p>", 2027, "https://www.soc.go.th/")).toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("normalizes Buddhist-year dates and Bangkok scope", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2569.html", "utf8");
    expect(parseSocHolidayCalendar(html, 2026, "https://www.soc.go.th/?p=33672")).toEqual([
      expect.objectContaining({ date: "2026-01-01", scope: "NATIONWIDE" }),
      expect.objectContaining({ date: "2026-01-02", scope: "NATIONWIDE" }),
      expect.objectContaining({ date: "2026-10-16", scope: "BANGKOK" }),
    ]);
  });

  it("rejects content without an unambiguous holiday date", () => {
    expect(() => parseSocHolidayCalendar("<p>วันหยุดราชการ</p>", 2026, "https://www.soc.go.th/")).toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("ignores dates outside the requested year", () => {
    expect(() => parseSocHolidayCalendar("<p>1 มกราคม 2568 วันขึ้นปีใหม่</p>", 2026, "https://www.soc.go.th/")).toThrow("OFFICIAL_SOURCE_INVALID");
  });
});

describe("SocHolidaySource", () => {
  const publishedUrl = "https://www.soc.go.th/?p=45123";

  function publishedPost(content: string, title = "วันหยุดราชการ ปี 2570", link = publishedUrl) {
    return { id: 45123, link, title: { rendered: title }, content: { rendered: content } };
  }

  function useRestPublication(post: ReturnType<typeof publishedPost>) {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/wp-json/wp/v2/posts" && url.searchParams.get("search")?.includes("2570")) {
        return Response.json([post]);
      }
      return new Response("Not found", { status: 404 });
    }));
  }

  it("discovers a newly published future annual calendar without knowing its post id", async () => {
    useRestPublication(publishedPost(await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8")));
    const source = new SocHolidaySource();
    const calendar = await source.fetchCalendarYear(2027);
    expect(calendar).toMatchObject({ coverage: "FULL_YEAR", cached: false });
    expect(calendar.holidays).toHaveLength(19);
    expect(calendar.holidays.every((holiday) => holiday.sourceUrl === publishedUrl)).toBe(true);
    expect(source.sourceUrl(2027)).toBe(publishedUrl);
    expect(await source.fetchYear(2027)).toHaveLength(19);
  });

  it("discovers an annual page linked from the official search result when REST is unavailable", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8");
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.has("s")) return new Response(`<h2><a href="/?p=45123">วันหยุดราชการ ปี 2570</a></h2>`, { headers: { "content-type": "text/html" } });
      if (url.searchParams.get("p") === "45123") return new Response(html, { headers: { "content-type": "text/html" } });
      return new Response("Forbidden", { status: 403 });
    }));
    expect(await new SocHolidaySource().fetchCalendarYear(2027)).toMatchObject({ coverage: "FULL_YEAR", cached: false });
  });

  it("refreshes a remembered annual publication and combines new announcements with its replacement", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8");
    const replacementUrl = "https://www.soc.go.th/?p=48999";
    const specialUrl = "https://www.soc.go.th/?p=49001";
    let refreshed = false;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/wp-json/wp/v2/posts") return Response.json(refreshed ? [
        publishedPost("<p>กำหนดให้วันที่ 12 เมษายน 2570 เป็นวันหยุดราชการเพิ่มเติมเป็นกรณีพิเศษ</p>", "วันหยุดราชการเพิ่มเติม ปี 2570", specialUrl),
        publishedPost(html, "วันหยุดราชการ ปี 2570", replacementUrl),
      ] : [publishedPost(html)]);
      if (url.searchParams.get("p") === "45123") return new Response(html, { headers: { "content-type": "text/html" } });
      return new Response("Not found", { status: 404 });
    }));
    const source = new SocHolidaySource();
    await source.fetchCalendarYear(2027);
    refreshed = true;
    const calendar = await source.fetchCalendarYear(2027);
    expect(calendar).toMatchObject({ coverage: "FULL_YEAR", cached: false, annualSourceUrl: replacementUrl });
    expect(calendar.holidays).toHaveLength(20);
    expect(calendar.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-01-01", sourceUrl: replacementUrl }),
      expect.objectContaining({ date: "2027-04-12", sourceUrl: specialUrl }),
    ]));
    expect(source.sourceUrl(2027)).toBe(replacementUrl);
  });

  it("reads a numeric Buddhist-year date instead of silently dropping the additional holiday row", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8");
    useRestPublication(publishedPost(`${html}<table><tr><td>12/04/2570</td><td>วันหยุดราชการเป็นกรณีพิเศษ</td></tr></table>`));
    const calendar = await new SocHolidaySource().fetchCalendarYear(2027);
    expect(calendar.coverage).toBe("FULL_YEAR");
    expect(calendar.holidays).toEqual(expect.arrayContaining([expect.objectContaining({ date: "2027-04-12" })]));
  });

  it("rejects full-year coverage when a date-bearing holiday row cannot be parsed", async () => {
    const html = await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8");
    useRestPublication(publishedPost(`${html}<table><tr><td>12|04|2570</td><td>วันหยุดราชการเป็นกรณีพิเศษ</td></tr></table>`));
    await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("imports a specific dated additional holiday as partial coverage", async () => {
    useRestPublication(publishedPost("<p>กำหนดให้วันที่ 12 เมษายน 2570 เป็นวันหยุดราชการเพิ่มเติมเป็นกรณีพิเศษ</p>", "การกำหนดวันหยุดราชการเพิ่มเติมเป็นกรณีพิเศษ ปี 2570"));
    const calendar = await new SocHolidaySource().fetchCalendarYear(2027);
    expect(calendar).toMatchObject({ coverage: "PARTIAL", cached: false });
    expect(calendar.holidays).toEqual([expect.objectContaining({ date: "2027-04-12", scope: "NATIONWIDE" })]);
  });

  it.each([
    ["an incomplete annual list", "<p>1 มกราคม 2570 วันขึ้นปีใหม่</p>"],
    ["an image-only publication", '<img src="/wp-content/uploads/2570-calendar.jpg" alt="วันหยุดราชการ ปี 2570">'],
    ["an impossible date", "<p>31 กุมภาพันธ์ 2570 วันมาฆบูชา</p>"],
  ])("does not promote %s to an official full-year calendar", async (_label, content) => {
    useRestPublication(publishedPost(content));
    await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("does not declare an annual calendar complete when one Songkran day is absent", async () => {
    const html = (await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8")).replace(/<tr><td>๑๔<\/td>[\s\S]*?<\/tr>/, "");
    useRestPublication(publishedPost(html));
    await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("never labels the curated 2026 fallback as current full-year confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const calendar = await new SocHolidaySource().fetchCalendarYear(2026);
    expect(calendar).toMatchObject({ coverage: "PARTIAL", cached: true });
    expect(calendar.holidays).toEqual(expect.arrayContaining([expect.objectContaining({ date: "2026-12-31" })]));
  });

  it.each(["http://www.soc.go.th/?p=45123", "https://www.soc.go.th.evil.test/?p=45123", "https://user:pass@www.soc.go.th/?p=45123"]) (
    "refuses publication links outside the HTTPS official origin: %s", async (link) => {
      useRestPublication(publishedPost(await readFile("tests/fixtures/soc-holidays-2570-table.html", "utf8"), undefined, link));
      await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_INVALID");
    },
  );

  it("refuses a redirect away from the official origin", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.test/calendar" } })));
    await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_INVALID");
  });

  it("rejects oversized source bodies before parsing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { headers: { "content-type": "application/json", "content-length": "3000000" } })));
    await expect(new SocHolidaySource().fetchCalendarYear(2027)).rejects.toThrow("OFFICIAL_SOURCE_TOO_LARGE");
  });

  it("falls back to the curated 2026 cabinet holiday list when the official page is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const holidays = await new SocHolidaySource().fetchYear(2026);

    expect(holidays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-01-02", scope: "NATIONWIDE" }),
        expect.objectContaining({ date: "2026-05-11", scope: "NATIONWIDE" }),
        expect.objectContaining({ date: "2026-10-16", scope: "BANGKOK" }),
        expect.objectContaining({ date: "2026-12-31", scope: "NATIONWIDE" }),
      ]),
    );
  });
});
