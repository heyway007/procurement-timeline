import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSocHolidayCalendar } from "@/lib/holidays/official-calendar";
import { SocHolidaySource } from "@/lib/holidays/official-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSocHolidayCalendar", () => {
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
