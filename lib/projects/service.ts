import {
  adjustMilestone,
  adjustProcessEnd,
  buildTimeline,
} from "@/lib/schedule/engine";
import { countWorkingDayAdditions } from "@/lib/schedule/date";
import {
  APPROVED_TEMPLATE_KEY,
  APPROVED_TEMPLATE_STEPS,
} from "@/lib/schedule/approved-template";
import type { ScheduledTimeline } from "@/lib/schedule/types";
import type { HolidayCalendarReader, ProjectRepository } from "./repository";
import { createProjectSchema, listProjectsSchema, versionSchema } from "./schema";
import type {
  AdjustStepInput,
  CreateProjectInput,
  ListProjectsFilter,
  ProjectRecord,
  ProjectReplacement,
  UpdateProjectInput,
} from "./types";

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly calendar: HolidayCalendarReader,
  ) {}

  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    return this.projects.list(listProjectsSchema.parse(filter));
  }

  async get(id: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    return project;
  }

  async create(input: CreateProjectInput): Promise<{
    project: ProjectRecord;
    unverifiedCalendarYears: number[];
  }> {
    const parsed = createProjectSchema.parse(input);
    const holidays = await this.calendar.listHolidayDates();
    const timeline = buildTimeline(
      APPROVED_TEMPLATE_STEPS,
      parsed.startDate,
      holidays,
    );
    const project = await this.projects.create({
      name: parsed.name,
      ownerName: parsed.ownerName,
      budget: parsed.budget,
      startDate: parsed.startDate,
      note: parsed.note,
      templateKey: APPROVED_TEMPLATE_KEY,
      templateVersion: 1,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: false,
      scheduleStatus: "NORMAL",
      steps: timeline.milestones,
    });
    const unverifiedCalendarYears = await this.calendar.listUnverifiedYears(
      project.startDate,
      project.processEndDate,
    );
    return { project, unverifiedCalendarYears };
  }

  async adjustStep(id: string, input: AdjustStepInput): Promise<ProjectRecord> {
    versionSchema.parse(input.version);
    const project = await this.get(id);
    this.assertVersion(project, input.version);
    const index = project.steps.findIndex((step) => step.order === input.order);
    if (index < 0) throw new Error("MILESTONE_NOT_FOUND");

    if (
      project.steps.slice(index + 1).some((step) => step.isDateManuallyAdjusted) &&
      !input.confirmOverwrite
    ) {
      throw new Error("DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED");
    }

    const holidays = await this.calendar.listHolidayDates();
    if (index > 0) {
      const previous = project.steps[index - 1];
      const actualDurationToNext = countWorkingDayAdditions(
        previous.scheduledDate,
        input.newDate,
        holidays,
      );
      if (
        actualDurationToNext < previous.workingDaysToNext &&
        !input.confirmShortening
      ) {
        throw new Error("DURATION_SHORTER_THAN_TEMPLATE");
      }
    }

    const changed = adjustMilestone(
      this.toTimeline(project),
      input.order,
      input.newDate,
      holidays,
    );
    return this.replaceTimeline(project, changed, input.version);
  }

  async updateDetails(
    id: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRecord> {
    const parsed = createProjectSchema.parse(input);
    const project = await this.get(id);
    this.assertVersion(project, input.version);
    const startChanged = parsed.startDate !== project.startDate;
    if (startChanged && !input.confirmReset) {
      throw new Error("SCHEDULE_RESET_CONFIRMATION_REQUIRED");
    }

    const holidays = await this.calendar.listHolidayDates();
    const timeline = startChanged
      ? buildTimeline(project.steps, parsed.startDate, holidays)
      : this.toTimeline(project);
    const replacement: ProjectReplacement = {
      name: parsed.name,
      ownerName: parsed.ownerName,
      budget: parsed.budget,
      startDate: timeline.milestones[0].scheduledDate,
      note: parsed.note,
      templateKey: project.templateKey,
      templateVersion: project.templateVersion,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
      scheduleStatus: "NORMAL",
      steps: timeline.milestones,
    };
    const result = await this.projects.replace(
      project.id,
      input.version,
      replacement,
    );
    if (result.kind === "not_found") throw new Error("PROJECT_NOT_FOUND");
    if (result.kind === "conflict") throw new Error("PROJECT_VERSION_CONFLICT");
    return result.project;
  }

  async adjustEnd(
    id: string,
    newDate: string,
    version: number,
    confirmShortening: boolean,
  ): Promise<ProjectRecord> {
    const project = await this.get(id);
    this.assertVersion(project, version);
    const holidays = await this.calendar.listHolidayDates();
    const last = project.steps[project.steps.length - 1];
    const actualDurationToNext = countWorkingDayAdditions(
      last.scheduledDate,
      newDate,
      holidays,
    );
    if (actualDurationToNext < last.workingDaysToNext && !confirmShortening) {
      throw new Error("DURATION_SHORTER_THAN_TEMPLATE");
    }
    return this.replaceTimeline(
      project,
      adjustProcessEnd(this.toTimeline(project), newDate, holidays),
      version,
    );
  }

  async resetSchedule(id: string, version: number): Promise<ProjectRecord> {
    const project = await this.get(id);
    this.assertVersion(project, version);
    const holidays = await this.calendar.listHolidayDates();
    const timeline = buildTimeline(project.steps, project.startDate, holidays);
    return this.replaceTimeline(project, timeline, version);
  }

  async remove(id: string, version: number): Promise<void> {
    const result = await this.projects.remove(id, version);
    if (result.kind === "not_found") throw new Error("PROJECT_NOT_FOUND");
    if (result.kind === "conflict") throw new Error("PROJECT_VERSION_CONFLICT");
  }

  private assertVersion(project: ProjectRecord, version: number): void {
    if (project.version !== version) throw new Error("PROJECT_VERSION_CONFLICT");
  }

  private toTimeline(project: ProjectRecord): ScheduledTimeline {
    return {
      milestones: project.steps,
      processEndDate: project.processEndDate,
      isProcessEndManuallyAdjusted: project.isProcessEndManuallyAdjusted,
    };
  }

  private async replaceTimeline(
    project: ProjectRecord,
    timeline: ScheduledTimeline,
    expectedVersion: number,
  ): Promise<ProjectRecord> {
    const replacement: ProjectReplacement = {
      name: project.name,
      ownerName: project.ownerName,
      budget: project.budget,
      startDate: timeline.milestones[0].scheduledDate,
      note: project.note,
      templateKey: project.templateKey,
      templateVersion: project.templateVersion,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
      scheduleStatus: "NORMAL",
      steps: timeline.milestones,
    };
    const result = await this.projects.replace(
      project.id,
      expectedVersion,
      replacement,
    );
    if (result.kind === "not_found") throw new Error("PROJECT_NOT_FOUND");
    if (result.kind === "conflict") throw new Error("PROJECT_VERSION_CONFLICT");
    return result.project;
  }
}
