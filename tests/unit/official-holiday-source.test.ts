import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseSocHolidayCalendar } from "@/lib/holidays/official-calendar";

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
