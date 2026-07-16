import type { Prisma } from "@/app/generated/prisma/client";
import { getPrisma } from "./prisma";
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

const includeProject = {
  template: true,
  steps: { orderBy: { order: "asc" as const } },
} satisfies Prisma.ProjectInclude;

type DatabaseProject = Prisma.ProjectGetPayload<{
  include: typeof includeProject;
}>;

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapProject(project: DatabaseProject): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    ownerName: project.ownerName,
    departmentName: project.departmentName,
    budget: project.budget.toNumber(),
    budgetCategory: project.budgetCategory,
    startDate: toIsoDate(project.startDate),
    note: project.note ?? "",
    templateKey: project.template.key,
    templateVersion: project.templateVersion,
    processEndDate: toIsoDate(project.processEndDate),
    isProcessEndManuallyAdjusted: project.isProcessEndManuallyAdjusted,
    scheduleStatus: project.scheduleStatus,
    version: project.version,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    steps: project.steps.map((step) => ({
      order: step.order,
      label: step.label,
      workingDaysToNext: step.workingDaysToNext,
      scheduledDate: toIsoDate(step.scheduledDate),
      isDateManuallyAdjusted: step.isDateManuallyAdjusted,
      bidSubmissionTimeSlot: step.bidSubmissionTimeSlot ?? undefined,
    })),
  };
}

function projectData(input: NewProjectRecord | ProjectReplacement) {
  return {
    name: input.name,
    ownerName: input.ownerName,
    departmentName: input.departmentName ?? "",
    budget: input.budget,
    budgetCategory: input.budgetCategory,
    startDate: fromIsoDate(input.startDate),
    note: input.note || null,
    templateVersion: input.templateVersion,
    processEndDate: fromIsoDate(input.processEndDate),
    isProcessEndManuallyAdjusted: input.isProcessEndManuallyAdjusted,
    scheduleStatus: input.scheduleStatus,
  };
}

export class PrismaProjectRepository
  implements ProjectRepository, HolidayCalendarReader
{
  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    const prisma = getPrisma();
    const where: Prisma.ProjectWhereInput = {};
    if (filter.query) {
      where.OR = [
        { name: { contains: filter.query, mode: "insensitive" } },
        { ownerName: { contains: filter.query, mode: "insensitive" } },
        { departmentName: { contains: filter.query, mode: "insensitive" } },
      ];
    }
    if (filter.from) {
      where.processEndDate = { gte: fromIsoDate(filter.from) };
    }
    if (filter.to) {
      where.startDate = { lte: fromIsoDate(filter.to) };
    }
    const projects = await prisma.project.findMany({
      where,
      include: includeProject,
      orderBy: { updatedAt: "desc" },
    });
    return projects.map(mapProject);
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const project = await getPrisma().project.findUnique({
      where: { id },
      include: includeProject,
    });
    return project ? mapProject(project) : null;
  }

  async create(input: NewProjectRecord): Promise<ProjectRecord> {
    return getPrisma().$transaction(async (transaction) => {
      const template = await transaction.template.findUniqueOrThrow({
        where: { key: input.templateKey },
      });
      const project = await transaction.project.create({
        data: {
          ...projectData(input),
          templateId: template.id,
          steps: {
            create: input.steps.map((step) => ({
              order: step.order,
              label: step.label,
              workingDaysToNext: step.workingDaysToNext,
              scheduledDate: fromIsoDate(step.scheduledDate),
              isDateManuallyAdjusted: step.isDateManuallyAdjusted,
              bidSubmissionTimeSlot: step.bidSubmissionTimeSlot,
            })),
          },
        },
        include: includeProject,
      });
      return mapProject(project);
    });
  }

  async replace(
    id: string,
    expectedVersion: number,
    input: ProjectReplacement,
  ): Promise<ProjectMutationResult> {
    return getPrisma().$transaction(async (transaction) => {
      const updated = await transaction.project.updateMany({
        where: { id, version: expectedVersion },
        data: { ...projectData(input), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        const exists = await transaction.project.count({ where: { id } });
        return exists ? { kind: "conflict" } : { kind: "not_found" };
      }
      await transaction.projectStep.deleteMany({ where: { projectId: id } });
      await transaction.projectStep.createMany({
        data: input.steps.map((step) => ({
          projectId: id,
          order: step.order,
          label: step.label,
          workingDaysToNext: step.workingDaysToNext,
          scheduledDate: fromIsoDate(step.scheduledDate),
          isDateManuallyAdjusted: step.isDateManuallyAdjusted,
          bidSubmissionTimeSlot: step.bidSubmissionTimeSlot,
        })),
      });
      const project = await transaction.project.findUniqueOrThrow({
        where: { id },
        include: includeProject,
      });
      return { kind: "ok", project: mapProject(project) };
    });
  }

  async remove(
    id: string,
    expectedVersion: number,
  ): Promise<ProjectMutationResult> {
    return getPrisma().$transaction(async (transaction) => {
      const project = await transaction.project.findUnique({
        where: { id },
        include: includeProject,
      });
      if (!project) return { kind: "not_found" };
      if (project.version !== expectedVersion) return { kind: "conflict" };
      await transaction.project.delete({ where: { id } });
      return { kind: "ok", project: mapProject(project) };
    });
  }

  async listHolidayDates(): Promise<ReadonlySet<string>> {
    const holidays = await getPrisma().holiday.findMany({ select: { date: true } });
    return new Set(holidays.map((holiday) => toIsoDate(holiday.date)));
  }

  async listUnverifiedYears(from: string, to: string): Promise<number[]> {
    const startYear = Number(from.slice(0, 4));
    const endYear = Number(to.slice(0, 4));
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, index) => startYear + index,
    );
    const verified = await getPrisma().holidayCalendarYear.findMany({
      where: { year: { in: years }, isVerifiedComplete: true },
      select: { year: true },
    });
    const verifiedSet = new Set(verified.map((item) => item.year));
    return years.filter((year) => !verifiedSet.has(year));
  }
}
