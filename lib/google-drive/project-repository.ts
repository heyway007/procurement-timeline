import { randomUUID } from "node:crypto";
import type {
  HolidayCalendarReader,
  ProjectMutationResult,
  ProjectRepository,
} from "@/lib/projects/repository";
import type {
  ListProjectsFilter,
  NewProjectRecord,
  ProjectRecord,
  ProjectReplacement,
} from "@/lib/projects/types";
import type { GoogleDriveDataStore } from "./datastore";

export class GoogleDriveProjectRepository
  implements ProjectRepository, HolidayCalendarReader
{
  constructor(private readonly store: GoogleDriveDataStore) {}

  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    const document = await this.store.read();
    return document.projects
      .filter((project) => matchesProjectFilter(project, filter))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const document = await this.store.read();
    return document.projects.find((project) => project.id === id) ?? null;
  }

  async create(input: NewProjectRecord): Promise<ProjectRecord> {
    return this.store.mutate((document) => {
      const template = document.templates.find(
        (item) => item.key === input.templateKey,
      );
      if (!template) throw new Error("TEMPLATE_NOT_FOUND");
      const now = new Date().toISOString();
      const project: ProjectRecord = {
        ...input,
        id: randomUUID(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      document.projects.unshift(project);
      return project;
    });
  }

  async replace(
    id: string,
    expectedVersion: number,
    input: ProjectReplacement,
  ): Promise<ProjectMutationResult> {
    return this.store.mutate((document) => {
      const index = document.projects.findIndex((project) => project.id === id);
      if (index < 0) return { kind: "not_found" };
      const existing = document.projects[index];
      if (existing.version !== expectedVersion) return { kind: "conflict" };
      const project: ProjectRecord = {
        ...input,
        id,
        version: expectedVersion + 1,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      document.projects[index] = project;
      return { kind: "ok", project };
    });
  }

  async remove(
    id: string,
    expectedVersion: number,
  ): Promise<ProjectMutationResult> {
    return this.store.mutate((document) => {
      const index = document.projects.findIndex((project) => project.id === id);
      if (index < 0) return { kind: "not_found" };
      const project = document.projects[index];
      if (project.version !== expectedVersion) return { kind: "conflict" };
      document.projects.splice(index, 1);
      return { kind: "ok", project };
    });
  }

  async listHolidayDates(): Promise<ReadonlySet<string>> {
    const document = await this.store.read();
    return new Set(document.holidays.map((holiday) => holiday.date));
  }

  async listUnverifiedYears(from: string, to: string): Promise<number[]> {
    const startYear = Number(from.slice(0, 4));
    const endYear = Number(to.slice(0, 4));
    const verifiedYears = new Set(
      (await this.store.read()).holidayCalendarYears
        .filter((coverage) => coverage.isVerifiedComplete)
        .map((coverage) => coverage.year),
    );
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index,
    ).filter((year) => !verifiedYears.has(year));
  }
}

function matchesProjectFilter(
  project: ProjectRecord,
  filter: ListProjectsFilter,
): boolean {
  const query = filter.query?.trim().toLowerCase();
  if (
    query &&
    !project.name.toLowerCase().includes(query) &&
    !project.ownerName.toLowerCase().includes(query) &&
    !(project.departmentName ?? "").toLowerCase().includes(query)
  ) {
    return false;
  }
  if (filter.from && project.processEndDate < filter.from) return false;
  if (filter.to && project.startDate > filter.to) return false;
  return true;
}
