import type {
  ListProjectsFilter,
  NewProjectRecord,
  ProjectRecord,
  ProjectReplacement,
} from "./types";

export type ProjectMutationResult =
  | { kind: "ok"; project: ProjectRecord }
  | { kind: "not_found" }
  | { kind: "conflict" };

export interface ProjectRepository {
  list(filter: ListProjectsFilter): Promise<ProjectRecord[]>;
  findById(id: string): Promise<ProjectRecord | null>;
  create(input: NewProjectRecord): Promise<ProjectRecord>;
  replace(
    id: string,
    expectedVersion: number,
    input: ProjectReplacement,
  ): Promise<ProjectMutationResult>;
  remove(id: string, expectedVersion: number): Promise<ProjectMutationResult>;
}

export interface HolidayCalendarReader {
  listHolidayDates(): Promise<ReadonlySet<string>>;
  listUnverifiedYears(from: string, to: string): Promise<number[]>;
}
