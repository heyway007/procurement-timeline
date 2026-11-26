import { describe, expect, it, vi } from "vitest";
import { PrismaHolidayRepository } from "@/lib/db/prisma-holiday-repository";
import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";

const state = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => state.client }));

const confirmedAt = new Date("2026-12-01T00:00:00.000Z");
const sourceUrl = "https://www.soc.go.th/annual-2570";
const official = {
  id: "official", date: new Date("2027-02-23T00:00:00.000Z"), name: "วันมาฆบูชา",
  sourceNote: "สลค.", scope: "NATIONWIDE", origin: "OFFICIAL_SYNC",
  officialSourceUrl: sourceUrl, officialSourceLabel: "สลค.",
  lastConfirmedAt: confirmedAt, createdAt: confirmedAt, updatedAt: confirmedAt,
};
const annualCoverage = {
  year: 2027, isVerifiedComplete: false, sourceNote: "สลค.", verifiedAt: null,
  lastSyncAttemptAt: confirmedAt, lastSuccessfulSyncAt: confirmedAt,
  lastSyncStatus: "FRESH", lastSyncMessage: null,
  officialCalendarCompleteAt: confirmedAt, officialAnnualSourceUrl: sourceUrl,
};
type Snapshot = { holidays: typeof official[]; coverage: typeof annualCoverage | null };

function concurrentAnnualImport() {
  let current: Snapshot = { holidays: [], coverage: null };
  const publish = () => { current = { holidays: [official], coverage: annualCoverage }; };
  function readers(snapshot: () => Snapshot) {
    return {
      holiday: {
        findMany: async () => {
          const holidays = snapshot().holidays;
          publish(); // A different request commits the annual import after the dates query.
          return holidays;
        },
      },
      holidayCalendarYear: {
        findUnique: async () => snapshot().coverage,
        findMany: async () => snapshot().coverage ? [snapshot().coverage] : [],
      },
    };
  }
  state.client = {
    ...readers(() => current),
    $transaction: async <T>(
      run: (client: ReturnType<typeof readers>) => Promise<T>,
      options?: { isolationLevel?: string },
    ): Promise<T> => {
      const initial = current;
      const snapshot = options?.isolationLevel === "RepeatableRead" ? () => initial : () => current;
      return run(readers(snapshot));
    },
  };
}

describe("Prisma holiday snapshot consistency", () => {
  it("reads the year's holiday rows and annual authority from the same version during an import", async () => {
    concurrentAnnualImport();
    const repository = new PrismaHolidayRepository();

    const calendar = await repository.listYear(2027);

    expect(calendar.coverage).toBeNull();
    expect(calendar.holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-22", origin: "PLANNED" }),
    ]));
    const nextRead = await repository.listYear(2027);
    expect(nextRead.holidays.map((holiday) => holiday.date)).toEqual(["2027-02-23"]);
  });

  it.each([
    ["holiday recalculation", () => new PrismaHolidayRepository().listAllDates()],
    ["project scheduling", () => new PrismaProjectRepository().listHolidayDates()],
  ] as const)("uses a consistent version for %s while an annual import commits", async (_label, read) => {
    concurrentAnnualImport();

    const dates = await read();

    expect(dates.has("2027-02-22")).toBe(true);
    expect(dates.has("2027-02-23")).toBe(false);
    const nextRead = await read();
    expect(nextRead.has("2027-02-22")).toBe(false);
    expect(nextRead.has("2027-02-23")).toBe(true);
  });
});
