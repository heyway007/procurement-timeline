import { randomUUID } from "node:crypto";
import {
  mergePlanningHolidays,
  withPlanningHolidayDates,
} from "@/lib/holidays/planning-calendar";
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
    const coverage = document.holidayCalendarYears.find((item) => item.year === year) ?? null;
    return {
      holidays: mergePlanningHolidays(
        document.holidays.filter((holiday) => holiday.date.startsWith(`${year}-`)),
        year,
        Boolean(coverage?.officialCalendarCompleteAt),
      ),
      coverage,
    };
  }

  async listAllDates(): Promise<ReadonlySet<string>> {
    const document = await this.store.read();
    return withPlanningHolidayDates(
      document.holidays.map((holiday) => holiday.date),
      document.holidayCalendarYears
        .filter((coverage) => coverage.officialCalendarCompleteAt)
        .map((coverage) => coverage.year),
    );
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
    options: { complete?: boolean; cached?: boolean; annualSourceUrl?: string } = {},
  ): Promise<{ inserted: number; updated: number; conflicts: string[] }> {
    const complete = options.complete === true && !options.cached;
    if (complete && (holidays.length === 0 || holidays.some((holiday) => !holiday.date.startsWith(`${year}-`)))) {
      throw new Error("OFFICIAL_SOURCE_INVALID");
    }
    return this.store.mutate((document) => {
      const previousCoverage = document.holidayCalendarYears.find((coverage) => coverage.year === year);
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
        if (options.cached && (existing || previousCoverage?.officialCalendarCompleteAt)) continue;
        const data = {
          date: holiday.date,
          name: holiday.name,
          sourceNote: holiday.sourceLabel,
          scope: holiday.scope,
          origin: "OFFICIAL_SYNC" as const,
          officialSourceUrl: holiday.sourceUrl,
          officialSourceLabel: holiday.sourceLabel,
          lastConfirmedAt: options.cached ? null : confirmedAt,
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
      if (complete) {
        const annualSourceUrl = options.annualSourceUrl ?? holidays[0].sourceUrl;
        const annualSources = new Set(
          [annualSourceUrl, previousCoverage?.officialAnnualSourceUrl]
            .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl)),
        );
        const incomingDates = new Set(holidays.map((holiday) => holiday.date));
        document.holidays = document.holidays.filter((holiday) =>
          !holiday.date.startsWith(`${year}-`) ||
          holiday.origin !== "OFFICIAL_SYNC" ||
          !annualSources.has(holiday.officialSourceUrl ?? "") ||
          incomingDates.has(holiday.date),
        );
      }
      upsertCoverage(document.holidayCalendarYears, year, {
        sourceNote: "สำนักเลขาธิการคณะรัฐมนตรี",
        lastSyncAttemptAt: confirmedAt,
        ...(options.cached ? {} : { lastSuccessfulSyncAt: confirmedAt }),
        lastSyncStatus: options.cached ? "CACHED" : "FRESH",
        lastSyncMessage: options.cached ? "OFFICIAL_SOURCE_CACHED" : null,
        ...(complete ? {
          officialCalendarCompleteAt: confirmedAt,
          officialAnnualSourceUrl: options.annualSourceUrl ?? holidays[0].sourceUrl,
        } : {}),
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
    officialCalendarCompleteAt: null,
    officialAnnualSourceUrl: null,
    ...patch,
  };
  records.push(created);
  return created;
}
