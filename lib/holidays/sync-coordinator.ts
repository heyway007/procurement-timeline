import type { HolidayRepository, HolidaySyncStatus } from "./repository";
import type { HolidaySource, OfficialHolidayCalendar } from "./official-source";

const SUCCESS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 60 * 1000;

export type HolidaySyncResult = Awaited<ReturnType<HolidayRepository["listYear"]>> & {
  conflicts: string[];
  sync: {
    status: HolidaySyncStatus;
    cached: boolean;
    message: string | null;
    sourceUrl: string | null;
    lastSuccessfulSyncAt: string | null;
  };
};

export class HolidaySyncCoordinator {
  private readonly inFlight = new Map<number, Promise<HolidaySyncResult>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repository: HolidayRepository,
    private readonly source?: HolidaySource,
    private readonly now: () => number = Date.now,
  ) {}

  async syncYear(year: number, force = false): Promise<HolidaySyncResult> {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("INVALID_CALENDAR_YEAR");
    const pending = this.inFlight.get(year);
    if (pending) return pending;
    const stored = await this.repository.listYear(year);
    const coverage = stored.coverage;
    const lastAttempt = coverage?.lastSyncAttemptAt ?? coverage?.lastSuccessfulSyncAt;
    const lastStatus = coverage?.lastSyncStatus;
    const age = lastAttempt ? this.now() - Date.parse(lastAttempt) : Infinity;
    const interval = lastStatus === "FRESH" ? SUCCESS_INTERVAL_MS : RETRY_INTERVAL_MS;
    if (!force && age >= 0 && age < interval) {
      return this.cachedResult(year, stored, lastStatus === "FRESH" ? "FRESH" : undefined);
    }
    if (!this.source) return this.cachedResult(year, stored, undefined, "ไม่ได้กำหนดแหล่งข้อมูลราชการ");

    // Another request may have started a job while listYear was awaited.
    const started = this.inFlight.get(year);
    if (started) return started;
    const job = this.queue.then(() => this.importYear(year));
    this.queue = job.then(() => undefined, () => undefined);
    this.inFlight.set(year, job);
    try {
      return await job;
    } finally {
      this.inFlight.delete(year);
    }
  }

  async syncUpcomingYears(): Promise<HolidaySyncResult[]> {
    const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(this.now())));
    const results: HolidaySyncResult[] = [];
    for (let offset = 0; offset < 3; offset += 1) results.push(await this.syncYear(year + offset));
    return results;
  }

  private async importYear(year: number): Promise<HolidaySyncResult> {
    const attemptedAt = new Date(this.now()).toISOString();
    try {
      const calendar: OfficialHolidayCalendar = this.source!.fetchCalendarYear
        ? await this.source!.fetchCalendarYear(year)
        : { holidays: await this.source!.fetchYear(year), coverage: "PARTIAL" as const, cached: false };
      if (!calendar.holidays.length || calendar.holidays.some((holiday) => {
        const date = new Date(`${holiday.date}T00:00:00.000Z`);
        return !holiday.date.startsWith(`${year}-`) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== holiday.date;
      })) throw new Error("OFFICIAL_SOURCE_INVALID");
      const reconciliation = await this.repository.reconcileOfficialYear(year, calendar.holidays, attemptedAt, {
        complete: calendar.coverage === "FULL_YEAR" && !calendar.cached,
        cached: calendar.cached,
        annualSourceUrl: calendar.annualSourceUrl,
      });
      const stored = await this.repository.listYear(year);
      if (calendar.cached) return { ...this.cachedResult(year, stored, "CACHED", "OFFICIAL_SOURCE_CACHED"), conflicts: reconciliation.conflicts };
      return {
        ...stored,
        conflicts: reconciliation.conflicts,
        sync: { status: "FRESH", cached: false, message: null, sourceUrl: calendar.annualSourceUrl ?? calendar.holidays[0].sourceUrl, lastSuccessfulSyncAt: attemptedAt },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "OFFICIAL_SOURCE_UNAVAILABLE";
      await this.repository.recordSyncFailure(year, attemptedAt, message);
      return this.cachedResult(year, await this.repository.listYear(year), undefined, message);
    }
  }

  private cachedResult(
    year: number,
    stored: Awaited<ReturnType<HolidayRepository["listYear"]>>,
    status?: HolidaySyncStatus,
    message = stored.coverage?.lastSyncMessage ?? null,
  ): HolidaySyncResult {
    let sourceUrl = stored.coverage?.officialAnnualSourceUrl ?? null;
    if (!sourceUrl) {
      try { sourceUrl = this.source?.sourceUrl(year) ?? null; } catch { /* A future source may not yet exist. */ }
    }
    return {
      ...stored, conflicts: [],
      sync: { status: status ?? (stored.holidays.length ? "CACHED" : "FAILED"), cached: true, message, sourceUrl, lastSuccessfulSyncAt: stored.coverage?.lastSuccessfulSyncAt ?? null },
    };
  }
}
