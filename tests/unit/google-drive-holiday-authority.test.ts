import { describe, expect, it } from "vitest";
import { createEmptyGoogleDriveDocument, GoogleDriveDataStore } from "@/lib/google-drive/datastore";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import type { OfficialHolidayInput } from "@/lib/holidays/repository";
import { addWorkingDays } from "@/lib/schedule/date";

const oldAnnualUrl = "https://www.soc.go.th/annual-2570-original";
const annualUrl = "https://www.soc.go.th/annual-2570";
const specialUrl = "https://www.soc.go.th/special-2570";
const firstSync = "2026-12-01T00:00:00.000Z";
const laterSync = "2026-12-02T00:00:00.000Z";

function official(date: string, sourceUrl = annualUrl): OfficialHolidayInput {
  return { date, name: "วันหยุดราชการ", scope: "NATIONWIDE", sourceUrl, sourceLabel: "สลค." };
}

function setup() {
  let content = JSON.stringify(createEmptyGoogleDriveDocument(firstSync));
  const store = new GoogleDriveDataStore({
    readText: async () => content,
    writeText: async (value) => { content = value; },
  });
  const projects = new GoogleDriveProjectRepository(store);
  return {
    store,
    projects,
    holidays: new GoogleDriveHolidayRepository(store, projects),
  };
}

describe("Google Drive authoritative holiday calendars", () => {
  it("replaces a projected date in the calendar and both scheduling readers", async () => {
    const { holidays, projects } = setup();
    expect((await holidays.listAllDates()).has("2027-02-22")).toBe(true);

    await holidays.reconcileOfficialYear(2027, [official("2027-02-23")], firstSync, { complete: true });

    const calendar = await holidays.listYear(2027);
    expect(calendar.holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23"]);
    expect(calendar.coverage).toMatchObject({ officialCalendarCompleteAt: firstSync, officialAnnualSourceUrl: annualUrl });
    for (const dates of [await holidays.listAllDates(), await projects.listHolidayDates()]) {
      expect(dates.has("2027-02-22")).toBe(false);
      expect(dates.has("2027-02-23")).toBe(true);
      expect(dates.has("2028-01-03")).toBe(true);
      expect(addWorkingDays("2027-02-19", 1, dates)).toBe("2027-02-22");
    }
  });

  it("keeps projections after a partial announcement or manual year verification", async () => {
    const { holidays, projects } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-09-17", specialUrl)], firstSync);
    await holidays.verifyYear(2027, "ตรวจสอบโดยผู้ดูแล");

    const calendar = await holidays.listYear(2027);
    expect(calendar.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-22", origin: "PLANNED" }),
      expect.objectContaining({ date: "2027-09-17", origin: "OFFICIAL_SYNC" }),
    ]));
    expect(calendar.coverage?.officialCalendarCompleteAt ?? null).toBeNull();
    expect((await projects.listHolidayDates()).has("2027-02-22")).toBe(true);
  });

  it("prunes obsolete annual records while preserving manual entries and separate special announcements", async () => {
    const { holidays, store } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-02-22", oldAnnualUrl)], firstSync, { complete: true });
    await holidays.reconcileOfficialYear(2027, [official("2027-05-20"), official("2027-09-17", specialUrl)], firstSync);
    await holidays.reconcileOfficialYear(2028, [official("2028-02-10", oldAnnualUrl)], firstSync);
    await holidays.applyMutation({ operation: "create", holiday: { date: "2027-04-06", name: "วันหยุดหน่วยงาน", sourceNote: "เพิ่มเอง" } });

    const result = await holidays.reconcileOfficialYear(2027, [official("2027-02-23"), official("2027-04-06")], laterSync, { complete: true });

    expect(result.conflicts).toEqual(["2027-04-06"]);
    const calendar = await holidays.listYear(2027);
    expect(calendar.holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23", "2027-04-06", "2027-09-17"]);
    expect(calendar.holidays.find((holiday) => holiday.date === "2027-04-06")).toMatchObject({ name: "วันหยุดหน่วยงาน", origin: "MANUAL" });
    expect(calendar.holidays.find((holiday) => holiday.date === "2027-09-17")).toMatchObject({ officialSourceUrl: specialUrl });
    expect((await store.read()).holidays.some((holiday) => holiday.date === "2028-02-10")).toBe(true);
  });

  it("preserves legacy official records with unknown source ownership", async () => {
    const { holidays, store } = setup();
    await store.mutate((document) => {
      document.holidays.push({
        id: "legacy-official", date: "2027-09-17", name: "วันหยุดเดิม", sourceNote: "legacy",
        scope: "NATIONWIDE", origin: "OFFICIAL_SYNC", officialSourceUrl: null,
        officialSourceLabel: null, lastConfirmedAt: null, createdAt: firstSync, updatedAt: firstSync,
      });
    });

    await holidays.reconcileOfficialYear(2027, [official("2027-02-23")], firstSync, { complete: true });

    expect((await holidays.listYear(2027)).holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23", "2027-09-17"]);
  });

  it("keeps explicit annual source ownership when a separate special announcement sorts first", async () => {
    const { holidays } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-02-22", oldAnnualUrl)], firstSync, { complete: true });
    await holidays.reconcileOfficialYear(2027, [official("2027-01-03", specialUrl), official("2027-05-20")], firstSync);

    await holidays.reconcileOfficialYear(2027, [official("2027-01-02", specialUrl), official("2027-02-23")], laterSync, { complete: true, annualSourceUrl: annualUrl });

    const calendar = await holidays.listYear(2027);
    expect(calendar.coverage?.officialAnnualSourceUrl).toBe(annualUrl);
    expect(calendar.holidays.map((holiday) => holiday.date)).toEqual(["2027-01-02", "2027-01-03", "2027-02-23"]);
  });

  it("retains annual authority after a partial refresh and later offline failure", async () => {
    const { holidays, projects } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-02-23")], firstSync, { complete: true });
    await holidays.reconcileOfficialYear(2027, [official("2027-09-17", specialUrl)], laterSync, { complete: false });
    await holidays.recordSyncFailure(2027, "2026-12-03T00:00:00.000Z", "offline");

    const calendar = await holidays.listYear(2027);
    expect(calendar.coverage).toMatchObject({ officialCalendarCompleteAt: firstSync, officialAnnualSourceUrl: annualUrl, lastSyncStatus: "FAILED" });
    expect(calendar.holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23", "2027-09-17"]);
    expect((await projects.listHolidayDates()).has("2027-02-22")).toBe(false);
  });

  it("treats official annual coverage as verified without requiring manual verification", async () => {
    const { holidays, projects } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-02-23")], firstSync, { complete: true });

    expect((await holidays.listYear(2027)).coverage?.isVerifiedComplete).toBe(false);
    expect(await projects.listUnverifiedYears("2027-01-01", "2028-01-01")).toEqual([2028]);
  });

  it("uses cached fallback only for missing dates without claiming a live confirmation", async () => {
    const { holidays } = setup();
    await holidays.reconcileOfficialYear(2026, [official("2026-12-10")], firstSync);
    await holidays.applyMutation({ operation: "create", holiday: { date: "2026-04-06", name: "วันหยุดหน่วยงาน", sourceNote: "เพิ่มเอง" } });
    const original = (await holidays.listYear(2026)).holidays;

    const result = await holidays.reconcileOfficialYear(2026, [
      { ...official("2026-12-10"), name: "ข้อมูลสำรองเก่า" },
      official("2026-04-06"),
      official("2026-01-02"),
    ], laterSync, { complete: true, cached: true });

    expect(result).toEqual({ inserted: 1, updated: 0, conflicts: ["2026-04-06"] });
    const calendar = await holidays.listYear(2026);
    expect(calendar.holidays).toEqual(expect.arrayContaining(original));
    expect(calendar.holidays.find((holiday) => holiday.date === "2026-01-02")).toMatchObject({ lastConfirmedAt: null });
    expect(calendar.coverage).toMatchObject({
      officialCalendarCompleteAt: null,
      lastSuccessfulSyncAt: firstSync,
      lastSyncAttemptAt: laterSync,
      lastSyncStatus: "CACHED",
      lastSyncMessage: "OFFICIAL_SOURCE_CACHED",
    });
  });

  it("does not resurrect removed dates from cached fallback after accepting an annual calendar", async () => {
    const { holidays, projects } = setup();
    await holidays.reconcileOfficialYear(2027, [official("2027-02-23")], firstSync, { complete: true });

    await holidays.reconcileOfficialYear(2027, [official("2027-02-22")], laterSync, { cached: true });

    expect((await holidays.listYear(2027)).holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23"]);
    expect((await projects.listHolidayDates()).has("2027-02-22")).toBe(false);
  });

  it.each([
    ["empty", []],
    ["wrong year", [official("2028-02-10")]],
    ["mixed years", [official("2027-02-23"), official("2028-02-10")]],
  ] as const)("rejects %s complete payload before writing", async (_label, incoming) => {
    const { holidays, store } = setup();
    const before = await store.read();

    await expect(holidays.reconcileOfficialYear(2027, [...incoming], firstSync, { complete: true })).rejects.toThrow("OFFICIAL_SOURCE_INVALID");

    expect(await store.read()).toEqual(before);
  });

  it("reads a legacy Drive document with missing annual-authority fields", async () => {
    const document = createEmptyGoogleDriveDocument(firstSync);
    document.holidayCalendarYears.push({
      year: 2027, isVerifiedComplete: true, sourceNote: "legacy", verifiedAt: firstSync,
      lastSyncAttemptAt: firstSync, lastSuccessfulSyncAt: firstSync, lastSyncStatus: "FRESH", lastSyncMessage: null,
    });
    const content = JSON.stringify(document);
    const store = new GoogleDriveDataStore({ readText: async () => content, writeText: async () => { throw new Error("UNEXPECTED_WRITE"); } });

    expect((await store.read()).holidayCalendarYears[0]).toMatchObject({ officialCalendarCompleteAt: null, officialAnnualSourceUrl: null });
    const holidays = new GoogleDriveHolidayRepository(store, new GoogleDriveProjectRepository(store));
    expect((await holidays.listYear(2027)).holidays.some((holiday) => holiday.origin === "PLANNED")).toBe(true);
  });
});
