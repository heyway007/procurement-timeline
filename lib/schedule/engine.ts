import {
  addWorkingDays,
  countWorkingDayAdditions,
  isWorkingDay,
} from "./date";
import type {
  ScheduledMilestone,
  ScheduledTimeline,
  TemplateStep,
} from "./types";

export function buildTimeline(
  template: TemplateStep[],
  startDate: string,
  holidays: ReadonlySet<string>,
): ScheduledTimeline {
  if (template.length === 0) {
    throw new Error("TEMPLATE_EMPTY");
  }
  if (!isWorkingDay(startDate, holidays)) {
    throw new Error("START_DATE_MUST_BE_WORKING_DAY");
  }

  const milestones: ScheduledMilestone[] = template.map((step, index) => ({
    order: step.order,
    label: step.label,
    workingDaysToNext: step.workingDaysToNext,
    scheduledDate: index === 0 ? startDate : "",
    isDateManuallyAdjusted: false,
  }));

  for (let index = 1; index < milestones.length; index += 1) {
    const previous = milestones[index - 1];
    milestones[index].scheduledDate = addWorkingDays(
      previous.scheduledDate,
      previous.workingDaysToNext,
      holidays,
    );
  }

  const last = milestones[milestones.length - 1];
  return {
    milestones,
    processEndDate: addWorkingDays(
      last.scheduledDate,
      last.workingDaysToNext,
      holidays,
    ),
    isProcessEndManuallyAdjusted: false,
  };
}

export function adjustMilestone(
  timeline: ScheduledTimeline,
  order: number,
  newDate: string,
  holidays: ReadonlySet<string>,
): ScheduledTimeline {
  const index = timeline.milestones.findIndex((item) => item.order === order);
  if (index < 0) {
    throw new Error("MILESTONE_NOT_FOUND");
  }
  if (!isWorkingDay(newDate, holidays)) {
    throw new Error("DATE_MUST_BE_WORKING_DAY");
  }
  if (index === 0) {
    return buildTimeline(timeline.milestones, newDate, holidays);
  }

  countWorkingDayAdditions(
    timeline.milestones[index - 1].scheduledDate,
    newDate,
    holidays,
  );

  const milestones = timeline.milestones.map((item) => ({ ...item }));
  milestones[index].scheduledDate = newDate;
  milestones[index].isDateManuallyAdjusted = true;

  for (let cursor = index + 1; cursor < milestones.length; cursor += 1) {
    const previous = milestones[cursor - 1];
    milestones[cursor].scheduledDate = addWorkingDays(
      previous.scheduledDate,
      previous.workingDaysToNext,
      holidays,
    );
    milestones[cursor].isDateManuallyAdjusted = false;
  }

  const last = milestones[milestones.length - 1];
  return {
    milestones,
    processEndDate: addWorkingDays(
      last.scheduledDate,
      last.workingDaysToNext,
      holidays,
    ),
    isProcessEndManuallyAdjusted: false,
  };
}

export function adjustProcessEnd(
  timeline: ScheduledTimeline,
  newDate: string,
  holidays: ReadonlySet<string>,
): ScheduledTimeline {
  const last = timeline.milestones[timeline.milestones.length - 1];
  countWorkingDayAdditions(last.scheduledDate, newDate, holidays);
  return {
    ...timeline,
    processEndDate: newDate,
    isProcessEndManuallyAdjusted: true,
  };
}
