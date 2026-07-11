import { getPrisma } from "./prisma";
import { PrismaProjectRepository } from "./prisma-project-repository";
import type {
  HolidayMutation,
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
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: fromIsoDate(`${year}-01-01`),
          lte: fromIsoDate(`${year}-12-31`),
        },
      },
      orderBy: { date: "asc" },
    });
    const coverage = await prisma.holidayCalendarYear.findUnique({
      where: { year },
    });
    return {
      holidays: holidays.map((holiday) => ({
        id: holiday.id,
        date: toIsoDate(holiday.date),
        name: holiday.name,
        sourceNote: holiday.sourceNote,
        createdAt: holiday.createdAt.toISOString(),
        updatedAt: holiday.updatedAt.toISOString(),
      })),
      coverage: coverage
        ? {
            year: coverage.year,
            isVerifiedComplete: coverage.isVerifiedComplete,
            sourceNote: coverage.sourceNote,
            verifiedAt: coverage.verifiedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async listAllDates(): Promise<ReadonlySet<string>> {
    const records = await getPrisma().holiday.findMany({ select: { date: true } });
    return new Set(records.map((record) => toIsoDate(record.date)));
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
    };
  }
}
