import { describe, expect, it, vi } from "vitest";
import { HolidaySyncCoordinator } from "@/lib/holidays/sync-coordinator";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument } from "@/lib/google-drive/datastore";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import type { HolidaySource, OfficialHolidayCalendar } from "@/lib/holidays/official-source";

function setup(calendar: OfficialHolidayCalendar) {
  let now = Date.parse("2026-11-26T00:00:00.000Z");
  let content = JSON.stringify(createEmptyGoogleDriveDocument(new Date(now).toISOString()));
  const store = new GoogleDriveDataStore({
    readText: async () => content,
    writeText: async (next) => { content = next; },
  });
  const projects = new GoogleDriveProjectRepository(store);
  const holidays = new GoogleDriveHolidayRepository(store, projects);
  const fetchCalendarYear = vi.fn<NonNullable<HolidaySource["fetchCalendarYear"]>>().mockResolvedValue(calendar);
  const source: HolidaySource = { sourceUrl: () => "https://www.soc.go.th/?p=2027", fetchYear: async () => calendar.holidays, fetchCalendarYear };
  const coordinator = new HolidaySyncCoordinator(holidays, source, () => now);
  return { coordinator, holidays, projects, fetchCalendarYear, advance: (ms: number) => { now += ms; } };
}

const official: OfficialHolidayCalendar = { coverage: "FULL_YEAR", cached: false, holidays: [{
  date: "2027-02-23", name: "วันหยุดชดเชยวันมาฆบูชา", scope: "NATIONWIDE",
  sourceUrl: "https://www.soc.go.th/?p=2027", sourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี",
}] };

describe("automatic official holiday synchronization", () => {
  it("replaces projections in the calendar and scheduling after a complete official publication", async () => {
    const { coordinator, projects } = setup(official);
    const result = await coordinator.syncYear(2027);

    expect(result.sync.status).toBe("FRESH");
    expect(result.holidays).toEqual([expect.objectContaining({ date: "2027-02-23", origin: "OFFICIAL_SYNC" })]);
    expect((await projects.listHolidayDates()).has("2027-02-22")).toBe(false);
    expect((await projects.listHolidayDates()).has("2027-02-23")).toBe(true);
  });

  it("merges a partial announcement without replacing the rest of the planning year", async () => {
    const { coordinator } = setup({ ...official, coverage: "PARTIAL" });
    const result = await coordinator.syncYear(2027);

    expect(result.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-23", origin: "OFFICIAL_SYNC" }),
      expect.objectContaining({ date: "2027-07-20", origin: "PLANNED" }),
    ]));
    expect(result.coverage?.officialCalendarCompleteAt).toBeFalsy();
  });

  it("does not present bundled fallback as a live or complete official calendar", async () => {
    const { coordinator } = setup({ ...official, cached: true });
    const result = await coordinator.syncYear(2027);

    expect(result.sync.status).toBe("CACHED");
    expect(result.sync.lastSuccessfulSyncAt).toBeNull();
    expect(result.coverage?.officialCalendarCompleteAt).toBeFalsy();
    expect(result.holidays.find((holiday) => holiday.date === "2027-02-23")?.lastConfirmedAt).toBeNull();
  });

  it("limits successful checks to once daily, with an explicit refresh available", async () => {
    const { coordinator, fetchCalendarYear, advance } = setup(official);
    await coordinator.syncYear(2027);
    advance(23 * 60 * 60 * 1000);
    expect((await coordinator.syncYear(2027)).sync.cached).toBe(true);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(1);
    await coordinator.syncYear(2027, true);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(2);
    advance(24 * 60 * 60 * 1000);
    await coordinator.syncYear(2027);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(3);
  });

  it("keeps data on failure and retries after an hour rather than on every visit", async () => {
    const { coordinator, fetchCalendarYear, advance } = setup(official);
    fetchCalendarYear.mockRejectedValue(new Error("OFFICIAL_SOURCE_UNAVAILABLE"));
    const first = await coordinator.syncYear(2027);
    expect(first.holidays.some((holiday) => holiday.origin === "PLANNED")).toBe(true);
    expect(first.sync.message).toBe("OFFICIAL_SOURCE_UNAVAILABLE");
    advance(59 * 60 * 1000);
    await coordinator.syncYear(2027);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(1);
    advance(60 * 1000);
    await coordinator.syncYear(2027);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(2);
  });

  it("deduplicates overlapping imports for the same year", async () => {
    const { coordinator, fetchCalendarYear } = setup(official);
    const results = await Promise.all([coordinator.syncYear(2027), coordinator.syncYear(2027), coordinator.syncYear(2027)]);
    expect(results.every((result) => result.holidays[0]?.date === "2027-02-23")).toBe(true);
    expect(fetchCalendarYear).toHaveBeenCalledTimes(1);
  });

  it("checks the current Bangkok year and two upcoming years during a daily run", async () => {
    const { coordinator, fetchCalendarYear, advance } = setup({ ...official, coverage: "PARTIAL" });
    advance(Date.parse("2026-12-31T18:00:00.000Z") - Date.parse("2026-11-26T00:00:00.000Z"));
    await coordinator.syncUpcomingYears();
    expect(fetchCalendarYear.mock.calls.map(([year]) => year)).toEqual([2027, 2028, 2029]);
  });
});
