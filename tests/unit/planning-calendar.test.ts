import { describe, expect, it } from "vitest";
import { mergePlanningHolidays, withPlanningHolidayDates } from "@/lib/holidays/planning-calendar";
import type { HolidayRecord } from "@/lib/holidays/repository";
import { addWorkingDays } from "@/lib/schedule/date";

describe("planning holiday calendar", () => {
  it.each([
    [2027, ["2027-01-01", "2027-02-21", "2027-02-22", "2027-05-20", "2027-07-18", "2027-07-19", "2027-07-20", "2027-10-25", "2027-12-06"]],
    [2028, ["2028-01-01", "2028-01-03", "2028-02-10", "2028-05-08", "2028-06-05", "2028-07-06", "2028-07-07", "2028-08-14", "2028-12-11"]],
  ])("provides %i government holidays and substitutes without stored data", (year, dates) => {
    const holidays = mergePlanningHolidays([], year);
    expect(holidays.map((holiday) => holiday.date)).toEqual(expect.arrayContaining(dates));
    expect(holidays.every((holiday) => holiday.origin === "PLANNED" && holiday.lastConfirmedAt === null)).toBe(true);
    expect(holidays.every((holiday) => holiday.date.startsWith(`${year}-`))).toBe(true);
    expect(new Set(holidays.map((holiday) => holiday.date)).size).toBe(holidays.length);
    expect(holidays.some((holiday) => /พืชมงคล|แรงงาน|กรณีพิเศษ/.test(holiday.name))).toBe(false);
  });

  it("keeps persisted manual and official holidays authoritative on the same date", () => {
    const manual: HolidayRecord = {
      id: "manual", date: "2027-01-01", name: "วันหยุดหน่วยงาน", sourceNote: "manual",
      scope: "NATIONWIDE", origin: "MANUAL", officialSourceUrl: null, officialSourceLabel: null,
      lastConfirmedAt: null, createdAt: "2026-11-26T00:00:00.000Z", updatedAt: "2026-11-26T00:00:00.000Z",
    };
    const official: HolidayRecord = { ...manual, id: "official", date: "2027-05-20", name: "วันวิสาขบูชา", origin: "OFFICIAL_SYNC" };
    const stored = [official, manual];
    const holidays = mergePlanningHolidays(stored, 2027);
    expect(holidays.filter((holiday) => holiday.date === manual.date)).toEqual([manual]);
    expect(holidays.filter((holiday) => holiday.date === official.date)).toEqual([official]);
    expect(holidays[0]).toEqual(manual);
    expect(stored).toEqual([official, manual]);
  });

  it("excludes future holidays when calculating timelines across years and consecutive holidays", () => {
    const dates = withPlanningHolidayDates(["2027-01-04"]);
    expect(addWorkingDays("2026-12-31", 1, dates)).toBe("2027-01-05");
    expect(addWorkingDays("2027-07-16", 1, dates)).toBe("2027-07-21");
    expect(addWorkingDays("2027-12-31", 1, dates)).toBe("2028-01-04");
  });

  it("does not invent a calendar outside the bundled years", () => {
    expect(mergePlanningHolidays([], 2026)).toEqual([]);
    expect(mergePlanningHolidays([], 2029)).toEqual([]);
  });

  it("removes projected dates after a complete official calendar replaces a year", () => {
    const official: HolidayRecord = {
      id: "official", date: "2027-02-23", name: "วันมาฆบูชา", sourceNote: "ประกาศประจำปี",
      scope: "NATIONWIDE", origin: "OFFICIAL_SYNC", officialSourceUrl: "https://www.soc.go.th/annual-2570",
      officialSourceLabel: "สลค.", lastConfirmedAt: "2026-12-01T00:00:00.000Z",
      createdAt: "2026-12-01T00:00:00.000Z", updatedAt: "2026-12-01T00:00:00.000Z",
    };

    expect(mergePlanningHolidays([official], 2027, true)).toEqual([official]);
    const dates = withPlanningHolidayDates([official.date], [2027]);
    expect(dates.has("2027-02-22")).toBe(false);
    expect(dates.has("2027-02-23")).toBe(true);
    expect(dates.has("2028-01-03")).toBe(true);
    expect(addWorkingDays("2027-02-19", 1, dates)).toBe("2027-02-22");
  });
});
