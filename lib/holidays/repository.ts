import type { ProjectRecord } from "@/lib/projects/types";

export type HolidayInput = {
  date: string;
  name: string;
  sourceNote: string;
};

export type HolidayScope = "NATIONWIDE" | "BANGKOK";
export type HolidayOrigin = "MANUAL" | "OFFICIAL_SYNC";
export type HolidaySyncStatus = "FRESH" | "CACHED" | "FAILED";

export type OfficialHolidayInput = {
  date: string;
  name: string;
  scope: HolidayScope;
  sourceUrl: string;
  sourceLabel: string;
};

export type HolidayRecord = HolidayInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  scope: HolidayScope;
  origin: HolidayOrigin;
  officialSourceUrl: string | null;
  officialSourceLabel: string | null;
  lastConfirmedAt: string | null;
};

export type YearCoverageRecord = {
  year: number;
  isVerifiedComplete: boolean;
  sourceNote: string;
  verifiedAt: string | null;
  lastSyncAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncStatus: HolidaySyncStatus | null;
  lastSyncMessage: string | null;
};

export type HolidayMutation =
  | { operation: "create"; holiday: HolidayInput }
  | {
      operation: "update";
      id: string;
      previousDate: string;
      holiday: HolidayInput;
    }
  | { operation: "delete"; id: string; date: string };

export interface HolidayRepository {
  listYear(year: number): Promise<{
    holidays: HolidayRecord[];
    coverage: YearCoverageRecord | null;
  }>;
  listAllDates(): Promise<ReadonlySet<string>>;
  listAffectedProjects(dates: string[]): Promise<ProjectRecord[]>;
  applyMutation(mutation: HolidayMutation): Promise<void>;
  verifyYear(year: number, sourceNote: string): Promise<YearCoverageRecord>;
  reconcileOfficialYear(year: number, holidays: OfficialHolidayInput[], confirmedAt: string): Promise<{ inserted: number; updated: number; conflicts: string[] }>;
  recordSyncFailure(year: number, attemptedAt: string, message: string): Promise<void>;
}
