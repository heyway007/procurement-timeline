import {
  adjustMilestone,
  adjustProcessEnd,
  buildTimeline,
  recalculateWithManualAnchors,
} from "@/lib/schedule/engine";
import { countWorkingDayAdditions, isWorkingDay } from "@/lib/schedule/date";
import {
  APPROVED_TEMPLATE_KEY,
  approvedTemplateStepsForProjectStatus,
  usesCurrentSpecificMethodTemplate,
  usesLegacySpecificMethodTemplate,
} from "@/lib/schedule/approved-template";
import type { ScheduledTimeline } from "@/lib/schedule/types";
import { isBidSubmissionMilestone, isPresentMilestone } from "@/lib/schedule/milestone-kind";
import type { HolidayCalendarReader, ProjectRepository } from "./repository";
import { createProjectSchema, listProjectsSchema, updateBidSubmissionTimeSchema, versionSchema } from "./schema";
import { defaultBudgetForCategory, generatedProjectName } from "./auto-values";
import type {
  AdjustStepInput,
  CreateProjectInput,
  ListProjectsFilter,
  ProjectRecord,
  ProjectReplacement,
  UpdateProjectInput,
  UpdateBidSubmissionTimeInput,
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
    const project = await this.getRaw(id);
    if (usesLegacySpecificMethodTemplate(project)) {
      // The old template has steps with no equivalent in the shorter schedule.
      if (project.isProcessEndManuallyAdjusted || project.steps.some((step) => step.isDateManuallyAdjusted)) {
        return project;
      }
      const holidays = await this.calendar.listHolidayDates();
      if (!isWorkingDay(project.startDate, holidays)) return project;
      const timeline = buildTimeline(
        approvedTemplateStepsForProjectStatus(project.projectStatusType, project.budgetCategory),
        project.startDate,
        holidays,
      );
      try {
        return await this.replaceTimeline(project, timeline, project.version);
      } catch (error) {
        if (error instanceof Error && error.message === "PROJECT_VERSION_CONFLICT") {
          return this.getRaw(id);
        }
        throw error;
      }
    }
    const present = project.steps.find((step) => isPresentMilestone(step.label));
    const defaultPresentDays = project.budgetCategory === "SELECTIVE_METHOD" ? 2 : 3;
    if (
      !present ||
      present.isDateManuallyAdjusted ||
      present.workingDaysToNext === defaultPresentDays ||
      present.workingDaysToNext === 3
    ) {
      return project;
    }
    const holidays = await this.calendar.listHolidayDates();
    const legacyTimeline = this.toTimeline({
      ...project,
      steps: project.steps.map((step) =>
        step.order === present.order ? { ...step, workingDaysToNext: defaultPresentDays } : step,
      ),
    });
    const recalculated = recalculateWithManualAnchors(legacyTimeline, holidays);
    const timeline = recalculated.kind === "ok" ? recalculated.timeline : legacyTimeline;
    return this.replaceProjectTimeline(
      project,
      timeline,
      project.version,
      recalculated.kind === "ok" ? "NORMAL" : "NEEDS_REVIEW",
    );
  }

  async create(input: CreateProjectInput): Promise<{
    project: ProjectRecord;
    unverifiedCalendarYears: number[];
  }> {
    const parsed = createProjectSchema.parse(input);
    const name = parsed.name || generatedProjectName(await this.projects.list({}));
    const ownerName = parsed.ownerName || "-";
    const departmentName = parsed.departmentName || "-";
    const budget = parsed.budget ?? defaultBudgetForCategory(parsed.budgetCategory);
    const holidays = await this.calendar.listHolidayDates();
    const timeline = buildTimeline(
      approvedTemplateStepsForProjectStatus(parsed.projectStatusType, parsed.budgetCategory),
      parsed.startDate,
      holidays,
    );
    const project = await this.projects.create({
      name,
      ownerName,
      departmentName,
      budget,
      budgetCategory: parsed.budgetCategory,
      projectStatusType: parsed.projectStatusType,
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
    const project = await this.getRaw(id);
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

  async updateBidSubmissionTime(
    id: string,
    input: UpdateBidSubmissionTimeInput,
  ): Promise<ProjectRecord> {
    const parsed = updateBidSubmissionTimeSchema.parse(input);
    const project = await this.getRaw(id);
    this.assertVersion(project, parsed.version);
    const index = project.steps.findIndex((step) =>
      isBidSubmissionMilestone(step.label),
    );
    if (index < 0) throw new Error("BID_SUBMISSION_MILESTONE_NOT_FOUND");
    const steps = project.steps.map((step, stepIndex) =>
      stepIndex === index
        ? { ...step, bidSubmissionTimeSlot: parsed.timeSlot }
        : step,
    );
    return this.replaceTimeline(
      project,
      { ...this.toTimeline(project), milestones: steps },
      parsed.version,
    );
  }

  async updateDetails(
    id: string,
    input: UpdateProjectInput,
  ): Promise<ProjectRecord> {
    const parsed = createProjectSchema.parse(input);
    const project = await this.getRaw(id);
    this.assertVersion(project, input.version);
    const projectStatusType = input.projectStatusType ?? project.projectStatusType ?? "SLA_COMPLIANT";
    const categoryChanged = parsed.budgetCategory !== project.budgetCategory;
    const startChanged = parsed.startDate !== project.startDate;
    const statusTypeChanged = projectStatusType !== (project.projectStatusType ?? "SLA_COMPLIANT");
    const shouldResetSchedule = startChanged || categoryChanged || statusTypeChanged;
    if (shouldResetSchedule && input.confirmReset !== true) {
      throw new Error("SCHEDULE_RESET_CONFIRMATION_REQUIRED");
    }

    const timeline = shouldResetSchedule
      ? buildTimeline(
          approvedTemplateStepsForProjectStatus(projectStatusType, parsed.budgetCategory),
          parsed.startDate,
          await this.calendar.listHolidayDates(),
        )
      : this.toTimeline(project);
    const budget = parsed.budget ?? (categoryChanged
      ? defaultBudgetForCategory(parsed.budgetCategory)
      : project.budget);
    const replacement: ProjectReplacement = {
      name: input.name === undefined ? project.name : parsed.name || "-",
      ownerUserId: project.ownerUserId,
      ownerName: parsed.ownerName || project.ownerName,
      departmentName: input.departmentName === undefined ? project.departmentName : parsed.departmentName || "-",
      budget,
      budgetCategory: parsed.budgetCategory,
      projectStatusType,
      startDate: parsed.startDate,
      note: input.note === undefined ? project.note : parsed.note,
      templateKey: project.templateKey,
      templateVersion: project.templateVersion,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
      scheduleStatus: shouldResetSchedule ? "NORMAL" : project.scheduleStatus,
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
    const project = await this.getRaw(id);
    this.assertVersion(project, version);
    const holidays = await this.calendar.listHolidayDates();
    const last = project.steps[project.steps.length - 1];
    const actualDurationToNext = countWorkingDayAdditions(
      last.scheduledDate,
      newDate,
      holidays,
    );
    if (usesCurrentSpecificMethodTemplate(project)) {
      if (actualDurationToNext !== last.workingDaysToNext) {
        throw new Error("SIGNING_DATE_MUST_FOLLOW_WINNER_ANNOUNCEMENT");
      }
      return project;
    }
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
    const project = await this.getRaw(id);
    this.assertVersion(project, version);
    const holidays = await this.calendar.listHolidayDates();
    const timeline = buildTimeline(
      approvedTemplateStepsForProjectStatus(project.projectStatusType, project.budgetCategory),
      project.startDate,
      holidays,
    );
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

  private async getRaw(id: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(id);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    return project;
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
    return this.replaceProjectTimeline(project, timeline, expectedVersion, "NORMAL");
  }

  private async replaceProjectTimeline(
    project: ProjectRecord,
    timeline: ScheduledTimeline,
    expectedVersion: number,
    scheduleStatus: ProjectRecord["scheduleStatus"],
  ): Promise<ProjectRecord> {
    const replacement: ProjectReplacement = {
      name: project.name,
      ownerUserId: project.ownerUserId,
      ownerName: project.ownerName,
      departmentName: project.departmentName ?? "",
      budget: project.budget,
      budgetCategory: project.budgetCategory,
      projectStatusType: project.projectStatusType,
      startDate: timeline.milestones[0].scheduledDate,
      note: project.note,
      templateKey: project.templateKey,
      templateVersion: project.templateVersion,
      processEndDate: timeline.processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
      scheduleStatus,
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
