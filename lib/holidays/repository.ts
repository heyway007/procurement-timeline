import type { ProjectRecord } from "@/lib/projects/types";

export type HolidayInput = {
  date: string;
  name: string;
  sourceNote: string;
};

export type HolidayRecord = HolidayInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type YearCoverageRecord = {
  year: number;
  isVerifiedComplete: boolean;
  sourceNote: string;
  verifiedAt: string | null;
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
}
