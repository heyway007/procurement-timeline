import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaHolidayRepository } from "@/lib/db/prisma-holiday-repository";
import { PrismaProjectRepository } from "@/lib/db/prisma-project-repository";
import type { OfficialHolidayInput } from "@/lib/holidays/repository";

const state = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => state.client }));

const confirmedAt = "2026-11-27T00:00:00.000Z";
const annualUrl = "https://www.soc.go.th/?p=annual-2027";
const previousAnnualUrl = "https://www.soc.go.th/?p=previous-2027";
const specialUrl = "https://www.soc.go.th/?p=special-2027";
const isoDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

function holiday(date: string, sourceUrl: string | null = annualUrl) {
  return {
    id: `holiday-${date}`,
    date: isoDate(date),
    name: sourceUrl ? "วันหยุดราชการ" : "วันหยุดหน่วยงาน",
    sourceNote: "ประกาศ",
    scope: "NATIONWIDE" as const,
    origin: sourceUrl ? "OFFICIAL_SYNC" as const : "MANUAL" as const,
    officialSourceUrl: sourceUrl,
    officialSourceLabel: sourceUrl ? "สลค." : null,
    lastConfirmedAt: sourceUrl ? new Date(confirmedAt) : null,
    createdAt: new Date(confirmedAt),
    updatedAt: new Date(confirmedAt),
  };
}

function coverage(complete = false) {
  return {
    year: 2027,
    isVerifiedComplete: false,
    sourceNote: "ประกาศ",
    verifiedAt: null as Date | null,
    lastSyncAttemptAt: null as Date | null,
    lastSuccessfulSyncAt: null as Date | null,
    lastSyncStatus: null as "FRESH" | "CACHED" | "FAILED" | null,
    lastSyncMessage: null as string | null,
    officialCalendarCompleteAt: complete ? new Date("2026-11-26T00:00:00.000Z") : null,
    officialAnnualSourceUrl: complete ? previousAnnualUrl : null,
  };
}

type DatabaseHoliday = ReturnType<typeof holiday>;
type Coverage = ReturnType<typeof coverage>;
type HolidayWhere = {
  id?: string;
  date?: Date | { gte?: Date; lte?: Date; notIn?: Date[] };
  origin?: string;
  officialSourceUrl?: { in: string[] };
};
type CoverageWhere = {
  year?: { in: number[] };
  isVerifiedComplete?: boolean;
  officialCalendarCompleteAt?: { not: null };
  OR?: CoverageWhere[];
};

function matchesCoverage(record: Coverage, where: CoverageWhere = {}): boolean {
  if (where.year && !where.year.in.includes(record.year)) return false;
  if (where.isVerifiedComplete !== undefined && record.isVerifiedComplete !== where.isVerifiedComplete) return false;
  if (where.officialCalendarCompleteAt && !record.officialCalendarCompleteAt) return false;
  return !where.OR || where.OR.some((condition) => matchesCoverage(record, condition));
}

function matches(record: DatabaseHoliday, where: HolidayWhere = {}) {
  if (where.id && record.id !== where.id) return false;
  if (where.origin && record.origin !== where.origin) return false;
  if (where.officialSourceUrl && !where.officialSourceUrl.in.includes(record.officialSourceUrl ?? "")) return false;
  if (where.date instanceof Date) return record.date.getTime() === where.date.getTime();
  if (where.date?.gte && record.date < where.date.gte) return false;
  if (where.date?.lte && record.date > where.date.lte) return false;
  return !where.date?.notIn?.some((date) => date.getTime() === record.date.getTime());
}

function database(records: DatabaseHoliday[] = [], calendar: Coverage | null = null) {
  let rows = records;
  let year = calendar;
  const transaction = {
    holiday: {
      findMany: async ({ where }: { where?: HolidayWhere } = {}) => rows.filter((record) => matches(record, where)),
      findUnique: async ({ where }: { where: HolidayWhere }) => rows.find((record) => matches(record, where)) ?? null,
      create: async ({ data }: { data: Partial<DatabaseHoliday> & { date: Date } }) => {
        const created = { ...holiday(data.date.toISOString().slice(0, 10), null), ...data };
        rows.push(created);
        return created;
      },
      update: async ({ where, data }: { where: HolidayWhere; data: Partial<DatabaseHoliday> }) => {
        const record = rows.find((item) => matches(item, where));
        if (!record) throw new Error("ROW_NOT_FOUND");
        Object.assign(record, data);
        return record;
      },
      deleteMany: async ({ where }: { where: HolidayWhere }) => {
        const previousCount = rows.length;
        rows = rows.filter((record) => !matches(record, where));
        return { count: previousCount - rows.length };
      },
    },
    holidayCalendarYear: {
      findUnique: async () => year,
      findMany: async ({ where }: { where?: CoverageWhere } = {}) =>
        year && matchesCoverage(year, where) ? [year] : [],
      upsert: async ({ create, update }: { create: Coverage; update: Partial<Coverage> }) => {
        year = year ? Object.assign(year, update) : { ...coverage(), ...create };
        return year;
      },
    },
  };
  const client = {
    ...transaction,
    $transaction: async <T>(run: (client: typeof transaction) => Promise<T>): Promise<T> => run(transaction),
  };
  state.client = client;
  return { rows: () => rows, coverage: () => year };
}

function official(date: string): OfficialHolidayInput {
  return { date, name: "วันหยุดจากปฏิทินประจำปี", scope: "NATIONWIDE", sourceUrl: annualUrl, sourceLabel: "สลค." };
}

beforeEach(() => { state.client = undefined; });

describe("Prisma authoritative annual holiday calendar", () => {
  it("replaces obsolete annual-source dates while keeping manual and separate special holidays", async () => {
    const manual = holiday("2027-04-06", null);
    const special = holiday("2027-10-16", specialUrl);
    const outsideYear = holiday("2028-02-10", previousAnnualUrl);
    const data = database([
      holiday("2027-02-22", previousAnnualUrl),
      holiday("2027-05-20"), manual, special, outsideYear,
    ], coverage(true));
    const repository = new PrismaHolidayRepository();

    const result = await repository.reconcileOfficialYear(2027, [official("2027-02-23"), official("2027-04-06")], confirmedAt, { complete: true });

    expect(result).toEqual({ inserted: 1, updated: 0, conflicts: ["2027-04-06"] });
    expect(data.rows().map((record) => record.date.toISOString().slice(0, 10)).sort()).toEqual([
      "2027-02-23", "2027-04-06", "2027-10-16", "2028-02-10",
    ]);
    expect(data.rows()).toContain(manual);
    expect(data.rows()).toContain(special);
    expect(data.coverage()).toMatchObject({
      officialCalendarCompleteAt: new Date(confirmedAt),
      officialAnnualSourceUrl: annualUrl,
      isVerifiedComplete: false,
    });
  });

  it("removes an outdated projection from the calendar and both scheduling readers", async () => {
    database();
    const repository = new PrismaHolidayRepository();
    await repository.reconcileOfficialYear(2027, [official("2027-02-23")], confirmedAt, { complete: true });

    const result = await repository.listYear(2027);

    expect(result.holidays.map((record) => record.date)).toEqual(["2027-02-23"]);
    expect(result.coverage).toMatchObject({ officialCalendarCompleteAt: confirmedAt, officialAnnualSourceUrl: annualUrl });
    for (const dates of [await repository.listAllDates(), await new PrismaProjectRepository().listHolidayDates()]) {
      expect(dates.has("2027-02-22")).toBe(false);
      expect(dates.has("2027-02-23")).toBe(true);
      expect(dates.has("2028-01-03")).toBe(true);
    }
  });

  it("uses explicit annual ownership when a separate special announcement sorts first", async () => {
    const data = database([
      holiday("2027-02-22", previousAnnualUrl), holiday("2027-05-20"), holiday("2027-01-03", specialUrl),
    ], coverage(true));
    const special = { ...official("2027-01-02"), sourceUrl: specialUrl };

    await new PrismaHolidayRepository().reconcileOfficialYear(2027, [special, official("2027-02-23")], confirmedAt, { complete: true, annualSourceUrl: annualUrl });

    expect(data.coverage()?.officialAnnualSourceUrl).toBe(annualUrl);
    expect(data.rows().map((record) => record.date.toISOString().slice(0, 10)).sort()).toEqual(["2027-01-02", "2027-01-03", "2027-02-23"]);
  });

  it("keeps projections and prior official dates after a partial special announcement", async () => {
    const data = database([holiday("2027-02-22", previousAnnualUrl)]);
    const repository = new PrismaHolidayRepository();

    await repository.reconcileOfficialYear(2027, [official("2027-02-23")], confirmedAt);

    expect(data.rows().map((record) => record.date.toISOString().slice(0, 10))).toEqual(["2027-02-22", "2027-02-23"]);
    expect(data.coverage()?.officialCalendarCompleteAt).toBeNull();
    expect((await repository.listYear(2027)).holidays).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-05-20", origin: "PLANNED" }),
    ]));
  });

  it("retains annual authority after a partial refresh and subsequent source failure", async () => {
    const data = database([holiday("2027-02-23")], coverage(true));
    const repository = new PrismaHolidayRepository();
    const previousAuthority = data.coverage()?.officialCalendarCompleteAt;

    await repository.reconcileOfficialYear(2027, [official("2027-10-16")], confirmedAt);
    await repository.recordSyncFailure(2027, confirmedAt, "OFFICIAL_SOURCE_UNAVAILABLE");

    expect(data.coverage()?.officialCalendarCompleteAt).toEqual(previousAuthority);
    expect(data.coverage()?.officialAnnualSourceUrl).toBe(previousAnnualUrl);
    expect(data.coverage()?.lastSyncStatus).toBe("FAILED");
    expect((await repository.listYear(2027)).holidays.some((record) => record.origin === "PLANNED")).toBe(false);
  });

  it.each([
    { label: "empty", incoming: [] },
    { label: "wrong year", incoming: [official("2028-02-10")] },
  ])("rejects an invalid complete snapshot without removing existing data ($label)", async ({ incoming }) => {
    const existing = holiday("2027-02-22");
    const data = database([existing]);

    await expect(new PrismaHolidayRepository().reconcileOfficialYear(2027, incoming, confirmedAt, { complete: true })).rejects.toThrow("OFFICIAL_SOURCE_INVALID");

    expect(data.rows()).toEqual([existing]);
    expect(data.coverage()).toBeNull();
  });

  it("uses cached fallback rows without replacing confirmed or manual records or declaring authority", async () => {
    const confirmed = holiday("2027-02-22");
    confirmed.name = "ข้อมูลยืนยันก่อนหน้า";
    const manual = holiday("2027-04-06", null);
    const data = database([confirmed, manual]);
    const repository = new PrismaHolidayRepository();

    const result = await repository.reconcileOfficialYear(2027, [
      official("2027-02-22"), official("2027-04-06"), official("2027-05-20"),
    ], confirmedAt, { complete: true, cached: true });

    expect(result).toEqual({ inserted: 1, updated: 0, conflicts: ["2027-04-06"] });
    expect(data.rows().find((record) => record.id === confirmed.id)).toMatchObject({
      name: "ข้อมูลยืนยันก่อนหน้า", lastConfirmedAt: new Date(confirmedAt),
    });
    expect(data.rows().find((record) => record.id === manual.id)).toEqual(manual);
    expect(data.rows().find((record) => record.date.toISOString().slice(0, 10) === "2027-05-20")?.lastConfirmedAt).toBeNull();
    expect(data.coverage()).toMatchObject({
      officialCalendarCompleteAt: null, officialAnnualSourceUrl: null,
      lastSuccessfulSyncAt: null, lastSyncAttemptAt: new Date(confirmedAt),
      lastSyncStatus: "CACHED", lastSyncMessage: "OFFICIAL_SOURCE_CACHED",
    });
    expect((await repository.listYear(2027)).holidays.some((record) => record.origin === "PLANNED")).toBe(true);
  });

  it("does not reintroduce absent cached dates after an authoritative annual publication", async () => {
    const calendar = coverage(true);
    calendar.lastSuccessfulSyncAt = new Date("2026-11-26T12:00:00.000Z");
    const data = database([holiday("2027-02-23")], calendar);

    await new PrismaHolidayRepository().reconcileOfficialYear(2027, [official("2027-02-22")], confirmedAt, { cached: true });

    expect(data.rows().map((record) => record.date.toISOString().slice(0, 10))).toEqual(["2027-02-23"]);
    expect(data.coverage()).toMatchObject({
      officialCalendarCompleteAt: new Date("2026-11-26T00:00:00.000Z"),
      officialAnnualSourceUrl: previousAnnualUrl,
      lastSuccessfulSyncAt: new Date("2026-11-26T12:00:00.000Z"),
      lastSyncStatus: "CACHED",
    });
  });

  it.each(["official", "manual"])("counts %s annual verification for project warnings", async (verification) => {
    const calendar = coverage(verification === "official");
    calendar.isVerifiedComplete = verification === "manual";
    database([], calendar);

    expect(await new PrismaProjectRepository().listUnverifiedYears("2027-12-01", "2028-01-31")).toEqual([2028]);
    if (verification === "manual") {
      expect((await new PrismaHolidayRepository().listYear(2027)).holidays.some((record) => record.origin === "PLANNED")).toBe(true);
    }
  });

  it("protects an edited official holiday as a manual entry on the next sync", async () => {
    const existing = holiday("2027-02-23");
    const data = database([existing]);
    const repository = new PrismaHolidayRepository();

    await repository.applyMutation({ operation: "update", id: existing.id, previousDate: "2027-02-23", holiday: { date: "2027-02-23", name: "แก้ไขโดยหน่วยงาน", sourceNote: "เพิ่มเอง" } });
    const result = await repository.reconcileOfficialYear(2027, [official("2027-02-23")], confirmedAt);

    expect(result.conflicts).toEqual(["2027-02-23"]);
    expect(data.rows()[0]).toMatchObject({
      origin: "MANUAL", name: "แก้ไขโดยหน่วยงาน", officialSourceUrl: null, officialSourceLabel: null, lastConfirmedAt: null,
    });
  });
});
