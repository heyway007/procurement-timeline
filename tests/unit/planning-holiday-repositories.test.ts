import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaHolidayRepository } from "@/lib/db/prisma-holiday-repository";
import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import { createEmptyGoogleDriveDocument, GoogleDriveDataStore } from "@/lib/google-drive/datastore";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import type { HolidayRecord } from "@/lib/holidays/repository";
import { buildTimeline } from "@/lib/schedule/engine";

const database = vi.hoisted(() => ({ holidays: [] as unknown[] }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => {
    const transaction = {
      holiday: { findMany: async () => database.holidays },
      holidayCalendarYear: { findUnique: async () => null, findMany: async () => [] },
    };
    return {
      ...transaction,
      $transaction: async <T>(run: (client: typeof transaction) => Promise<T>): Promise<T> => run(transaction),
    };
  },
}));

const timestamp = "2026-11-26T00:00:00.000Z";

function storedHoliday(date: string, origin: "MANUAL" | "OFFICIAL_SYNC"): HolidayRecord & { origin: "MANUAL" | "OFFICIAL_SYNC" } {
  return {
    id: `stored-${date}`,
    date,
    name: origin === "MANUAL" ? "วันหยุดหน่วยงาน" : "วันหยุดจากประกาศราชการ",
    sourceNote: "ข้อมูลที่บันทึกไว้",
    scope: "NATIONWIDE",
    origin,
    officialSourceUrl: origin === "OFFICIAL_SYNC" ? "https://www.soc.go.th/" : null,
    officialSourceLabel: origin === "OFFICIAL_SYNC" ? "สลค." : null,
    lastConfirmedAt: origin === "OFFICIAL_SYNC" ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function prismaRepositories(records: ReturnType<typeof storedHoliday>[] = []) {
  database.holidays = records.map((record) => ({
    ...record,
    date: new Date(`${record.date}T00:00:00.000Z`),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    lastConfirmedAt: record.lastConfirmedAt ? new Date(record.lastConfirmedAt) : null,
  }));
  return {
    holidays: new PrismaHolidayRepository(),
    projects: new PrismaProjectRepository(),
    storedDates: async () => database.holidays.map((record) =>
      (record as { date: Date }).date.toISOString().slice(0, 10)),
  };
}

function driveRepositories(records: ReturnType<typeof storedHoliday>[] = []) {
  const document = createEmptyGoogleDriveDocument(timestamp);
  document.holidays = records;
  let content = JSON.stringify(document);
  const store = new GoogleDriveDataStore({
    readText: async () => content,
    writeText: async (value) => { content = value; },
  });
  const projects = new GoogleDriveProjectRepository(store);
  return {
    holidays: new GoogleDriveHolidayRepository(store, projects),
    projects,
    storedDates: async () => (await store.read()).holidays.map((record) => record.date),
  };
}

beforeEach(() => { database.holidays = []; });

describe.each([
  ["Prisma", prismaRepositories],
  ["Google Drive", driveRepositories],
] as const)("%s planning holiday readers", (_name, repositories) => {
  it("shows future holidays immediately without saving planning records", async () => {
    const { holidays, storedDates } = repositories();

    const firstYear = await holidays.listYear(2027);
    const secondYear = await holidays.listYear(2028);

    expect(firstYear.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-22", origin: "PLANNED", lastConfirmedAt: null }),
      expect.objectContaining({ date: "2027-07-20", origin: "PLANNED", lastConfirmedAt: null }),
    ]));
    expect(secondYear.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2028-01-03", origin: "PLANNED", lastConfirmedAt: null }),
    ]));
    expect(firstYear.coverage).toBeNull();
    expect(secondYear.coverage).toBeNull();
    expect(await storedDates()).toEqual([]);
  });

  it.each(["MANUAL", "OFFICIAL_SYNC"] as const)("keeps a persisted %s holiday instead of its planned row", async (origin) => {
    const existing = storedHoliday("2027-02-22", origin);
    const { holidays } = repositories([existing]);

    const result = await holidays.listYear(2027);

    expect(result.holidays.filter((record) => record.date === existing.date)).toEqual([existing]);
    expect(result.holidays.map((record) => record.date)).toEqual(
      [...result.holidays.map((record) => record.date)].sort(),
    );
  });

  it("makes both scheduling readers skip future holidays before any calendar visit or sync", async () => {
    const existing = storedHoliday("2030-02-01", "MANUAL");
    const { holidays, projects, storedDates } = repositories([existing]);

    for (const dates of [await holidays.listAllDates(), await projects.listHolidayDates()]) {
      for (const date of ["2027-02-22", "2027-07-20", "2028-01-03", "2030-02-01"]) {
        expect(dates.has(date), date).toBe(true);
      }
      const steps = [
        { order: 1, label: "เริ่ม", workingDaysToNext: 1 },
        { order: 2, label: "สิ้นสุด", workingDaysToNext: 0 },
      ];
      expect(buildTimeline(steps, "2027-02-19", dates).milestones[1].scheduledDate).toBe("2027-02-23");
      expect(buildTimeline(steps, "2027-12-30", dates).milestones[1].scheduledDate).toBe("2028-01-04");
    }
    expect(await storedDates()).toEqual(["2030-02-01"]);
  });
});
