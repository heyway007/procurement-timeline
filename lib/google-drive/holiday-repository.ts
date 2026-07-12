import { randomUUID } from "node:crypto";
import type {
  HolidayMutation,
  HolidayRecord,
  HolidayRepository,
  OfficialHolidayInput,
  YearCoverageRecord,
} from "@/lib/holidays/repository";
import type { ProjectRepository } from "@/lib/projects/repository";
import type { ProjectRecord } from "@/lib/projects/types";
import type { GoogleDriveDataStore } from "./datastore";

export class GoogleDriveHolidayRepository implements HolidayRepository {
  constructor(
    private readonly store: GoogleDriveDataStore,
    private readonly projects: ProjectRepository,
  ) {}

  async listYear(year: number): Promise<{
    holidays: HolidayRecord[];
    coverage: YearCoverageRecord | null;
  }> {
    const document = await this.store.read();
    return {
      holidays: document.holidays
        .filter((holiday) => holiday.date.startsWith(`${year}-`))
        .sort((left, right) => left.date.localeCompare(right.date)),
      coverage:
        document.holidayCalendarYears.find(
          (coverage) => coverage.year === year,
        ) ?? null,
    };
  }

  async listAllDates(): Promise<ReadonlySet<string>> {
    const document = await this.store.read();
    return new Set(document.holidays.map((holiday) => holiday.date));
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
    await this.store.mutate((document) => {
      const now = new Date().toISOString();
      if (mutation.operation === "create") {
        document.holidays.push({
          id: randomUUID(),
          ...mutation.holiday,
          scope: "NATIONWIDE",
          origin: "MANUAL",
          officialSourceUrl: null,
          officialSourceLabel: null,
          lastConfirmedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return;
      }
      if (mutation.operation === "update") {
        const index = document.holidays.findIndex(
          (holiday) => holiday.id === mutation.id,
        );
        if (index < 0) throw new Error("HOLIDAY_NOT_FOUND");
        const existing = document.holidays[index];
        document.holidays[index] = {
          ...existing,
          ...mutation.holiday,
          origin: "MANUAL",
          officialSourceUrl: null,
          officialSourceLabel: null,
          lastConfirmedAt: null,
          updatedAt: now,
        };
        return;
      }
      const index = document.holidays.findIndex(
        (holiday) => holiday.id === mutation.id,
      );
      if (index >= 0) document.holidays.splice(index, 1);
    });
  }

  async verifyYear(
    year: number,
    sourceNote: string,
  ): Promise<YearCoverageRecord> {
    return this.store.mutate((document) => {
      const now = new Date().toISOString();
      const coverage = upsertCoverage(document.holidayCalendarYears, year, {
        isVerifiedComplete: true,
        sourceNote,
        verifiedAt: now,
      });
      return coverage;
    });
  }

  async reconcileOfficialYear(
    year: number,
    holidays: OfficialHolidayInput[],
    confirmedAt: string,
  ): Promise<{ inserted: number; updated: number; conflicts: string[] }> {
    return this.store.mutate((document) => {
      let inserted = 0;
      let updated = 0;
      const conflicts: string[] = [];
      for (const holiday of holidays) {
        if (!holiday.date.startsWith(`${year}-`)) continue;
        const existing = document.holidays.find(
          (item) => item.date === holiday.date,
        );
        if (existing?.origin === "MANUAL") {
          conflicts.push(holiday.date);
          continue;
        }
        const data = {
          date: holiday.date,
          name: holiday.name,
          sourceNote: holiday.sourceLabel,
          scope: holiday.scope,
          origin: "OFFICIAL_SYNC" as const,
          officialSourceUrl: holiday.sourceUrl,
          officialSourceLabel: holiday.sourceLabel,
          lastConfirmedAt: confirmedAt,
          updatedAt: confirmedAt,
        };
        if (existing) {
          Object.assign(existing, data);
          updated += 1;
        } else {
          document.holidays.push({
            id: randomUUID(),
            ...data,
            createdAt: confirmedAt,
          });
          inserted += 1;
        }
      }
      upsertCoverage(document.holidayCalendarYears, year, {
        sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี",
        lastSyncAttemptAt: confirmedAt,
        lastSuccessfulSyncAt: confirmedAt,
        lastSyncStatus: "FRESH",
        lastSyncMessage: null,
      });
      return { inserted, updated, conflicts };
    });
  }

  async recordSyncFailure(
    year: number,
    attemptedAt: string,
    message: string,
  ): Promise<void> {
    await this.store.mutate((document) => {
      upsertCoverage(document.holidayCalendarYears, year, {
        sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี",
        lastSyncAttemptAt: attemptedAt,
        lastSyncStatus: "FAILED",
        lastSyncMessage: message,
      });
    });
  }
}

function upsertCoverage(
  records: YearCoverageRecord[],
  year: number,
  patch: Partial<YearCoverageRecord>,
): YearCoverageRecord {
  const existing = records.find((coverage) => coverage.year === year);
  if (existing) {
    Object.assign(existing, patch);
    return existing;
  }
  const created: YearCoverageRecord = {
    year,
    isVerifiedComplete: false,
    sourceNote: "",
    verifiedAt: null,
    lastSyncAttemptAt: null,
    lastSuccessfulSyncAt: null,
    lastSyncStatus: null,
    lastSyncMessage: null,
    ...patch,
  };
  records.push(created);
  return created;
}
