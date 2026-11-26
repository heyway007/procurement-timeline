import { getPrisma } from "./prisma";
import { PrismaProjectRepository } from "./prisma-project-repository";
import { readHolidayDates } from "./holiday-calendar-reader";
import { mergePlanningHolidays } from "@/lib/holidays/planning-calendar";
import type {
  HolidayMutation,
  OfficialHolidayInput,
  HolidayRecord,
  HolidayRepository,
  YearCoverageRecord,
} from "@/lib/holidays/repository";
import type { ProjectRecord } from "@/lib/projects/types";

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export class PrismaHolidayRepository implements HolidayRepository {
  private readonly projects = new PrismaProjectRepository();

  async listYear(year: number): Promise<{
    holidays: HolidayRecord[];
    coverage: YearCoverageRecord | null;
  }> {
    const prisma = getPrisma();
    const { holidays, coverage } = await prisma.$transaction(async (transaction) => {
      const [holidays, coverage] = await Promise.all([
        transaction.holiday.findMany({
          where: {
            date: {
              gte: fromIsoDate(`${year}-01-01`),
              lte: fromIsoDate(`${year}-12-31`),
            },
          },
          orderBy: { date: "asc" },
        }),
        transaction.holidayCalendarYear.findUnique({ where: { year } }),
      ]);
      return { holidays, coverage };
    }, { isolationLevel: "RepeatableRead" });
    return {
      holidays: mergePlanningHolidays(
        holidays.map((holiday) => ({
          id: holiday.id,
          date: toIsoDate(holiday.date),
          name: holiday.name,
          sourceNote: holiday.sourceNote,
          createdAt: holiday.createdAt.toISOString(),
          updatedAt: holiday.updatedAt.toISOString(),
          scope: holiday.scope,
          origin: holiday.origin,
          officialSourceUrl: holiday.officialSourceUrl,
          officialSourceLabel: holiday.officialSourceLabel,
          lastConfirmedAt: holiday.lastConfirmedAt?.toISOString() ?? null,
        })),
        year,
        Boolean(coverage?.officialCalendarCompleteAt),
      ),
      coverage: coverage
        ? {
            year: coverage.year,
            isVerifiedComplete: coverage.isVerifiedComplete,
            sourceNote: coverage.sourceNote,
            verifiedAt: coverage.verifiedAt?.toISOString() ?? null,
            lastSyncAttemptAt: coverage.lastSyncAttemptAt?.toISOString() ?? null,
            lastSuccessfulSyncAt: coverage.lastSuccessfulSyncAt?.toISOString() ?? null,
            lastSyncStatus: coverage.lastSyncStatus,
            lastSyncMessage: coverage.lastSyncMessage,
            officialCalendarCompleteAt: coverage.officialCalendarCompleteAt?.toISOString() ?? null,
            officialAnnualSourceUrl: coverage.officialAnnualSourceUrl,
          }
        : null,
    };
  }

  async listAllDates(): Promise<ReadonlySet<string>> {
    return readHolidayDates();
  }

  async listAffectedProjects(dates: string[]): Promise<ProjectRecord[]> {
    const ordered = [...dates].sort();
    const projects = await this.projects.list({
      from: ordered[0],
      to: ordered[ordered.length - 1],
    });
    return projects.filter((project) =>
      dates.some(
        (date) => date >= project.startDate && date <= project.processEndDate,
      ),
    );
  }

  async applyMutation(mutation: HolidayMutation): Promise<void> {
    const prisma = getPrisma();
    if (mutation.operation === "create") {
      await prisma.holiday.create({
        data: {
          date: fromIsoDate(mutation.holiday.date),
          name: mutation.holiday.name,
          sourceNote: mutation.holiday.sourceNote,
        },
      });
      return;
    }
    if (mutation.operation === "update") {
      await prisma.holiday.update({
        where: { id: mutation.id },
        data: {
          date: fromIsoDate(mutation.holiday.date),
          name: mutation.holiday.name,
          sourceNote: mutation.holiday.sourceNote,
          origin: "MANUAL",
          officialSourceUrl: null,
          officialSourceLabel: null,
          lastConfirmedAt: null,
        },
      });
      return;
    }
    await prisma.holiday.delete({ where: { id: mutation.id } });
  }

  async verifyYear(
    year: number,
    sourceNote: string,
  ): Promise<YearCoverageRecord> {
    const record = await getPrisma().holidayCalendarYear.upsert({
      where: { year },
      create: {
        year,
        isVerifiedComplete: true,
        sourceNote,
        verifiedAt: new Date(),
      },
      update: {
        isVerifiedComplete: true,
        sourceNote,
        verifiedAt: new Date(),
      },
    });
    return {
      year: record.year,
      isVerifiedComplete: record.isVerifiedComplete,
      sourceNote: record.sourceNote,
        verifiedAt: record.verifiedAt?.toISOString() ?? null,
      lastSyncAttemptAt: record.lastSyncAttemptAt?.toISOString() ?? null,
      lastSuccessfulSyncAt: record.lastSuccessfulSyncAt?.toISOString() ?? null,
      lastSyncStatus: record.lastSyncStatus,
      lastSyncMessage: record.lastSyncMessage,
      officialCalendarCompleteAt: record.officialCalendarCompleteAt?.toISOString() ?? null,
      officialAnnualSourceUrl: record.officialAnnualSourceUrl,
    };
  }

  async reconcileOfficialYear(
    year: number,
    holidays: OfficialHolidayInput[],
    confirmedAt: string,
    options: { complete?: boolean; cached?: boolean; annualSourceUrl?: string } = {},
  ): Promise<{ inserted: number; updated: number; conflicts: string[] }> {
    const complete = options.complete === true && options.cached !== true;
    if (complete && (holidays.length === 0 || holidays.some((holiday) => !holiday.date.startsWith(`${year}-`)))) {
      throw new Error("OFFICIAL_SOURCE_INVALID");
    }
    const prisma = getPrisma();
    const confirmed = new Date(confirmedAt);
    return prisma.$transaction(async (tx) => {
      const previousCoverage = complete || options.cached
        ? await tx.holidayCalendarYear.findUnique({ where: { year } })
        : null;
      const annualSourceUrl = options.annualSourceUrl ?? holidays[0]?.sourceUrl ?? null;
      let inserted = 0;
      let updated = 0;
      const conflicts: string[] = [];
      for (const holiday of holidays) {
        if (!holiday.date.startsWith(`${year}-`)) continue;
        const date = fromIsoDate(holiday.date);
        const existing = await tx.holiday.findUnique({ where: { date } });
        if (existing?.origin === "MANUAL") {
          conflicts.push(holiday.date);
          continue;
        }
        if (options.cached && (existing || previousCoverage?.officialCalendarCompleteAt)) continue;
        const data = {
          name: holiday.name,
          sourceNote: holiday.sourceLabel,
          scope: holiday.scope,
          origin: "OFFICIAL_SYNC" as const,
          officialSourceUrl: holiday.sourceUrl,
          officialSourceLabel: holiday.sourceLabel,
          lastConfirmedAt: options.cached ? null : confirmed,
        };
        if (existing) {
          await tx.holiday.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.holiday.create({ data: { date, ...data } });
          inserted += 1;
        }
      }
      if (complete) {
        const annualSources = [previousCoverage?.officialAnnualSourceUrl, annualSourceUrl]
          .filter((url): url is string => Boolean(url));
        await tx.holiday.deleteMany({
          where: {
            origin: "OFFICIAL_SYNC",
            officialSourceUrl: { in: annualSources },
            date: {
              gte: fromIsoDate(`${year}-01-01`),
              lte: fromIsoDate(`${year}-12-31`),
              notIn: holidays.map((holiday) => fromIsoDate(holiday.date)),
            },
          },
        });
      }
      const syncPatch = {
        lastSyncAttemptAt: confirmed,
        ...(options.cached
          ? { lastSyncStatus: "CACHED" as const, lastSyncMessage: "OFFICIAL_SOURCE_CACHED" }
          : { lastSuccessfulSyncAt: confirmed, lastSyncStatus: "FRESH" as const, lastSyncMessage: null }),
        ...(complete ? { officialCalendarCompleteAt: confirmed, officialAnnualSourceUrl: annualSourceUrl } : {}),
      };
      await tx.holidayCalendarYear.upsert({
        where: { year },
        create: { year, sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี", ...syncPatch },
        update: syncPatch,
      });
      return { inserted, updated, conflicts };
    });
  }

  async recordSyncFailure(year: number, attemptedAt: string, message: string): Promise<void> {
    const attempted = new Date(attemptedAt);
    await getPrisma().holidayCalendarYear.upsert({
      where: { year },
      create: { year, sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี", lastSyncAttemptAt: attempted, lastSyncStatus: "FAILED", lastSyncMessage: message },
      update: { lastSyncAttemptAt: attempted, lastSyncStatus: "FAILED", lastSyncMessage: message },
    });
  }
}
