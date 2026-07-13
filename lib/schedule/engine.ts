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
import { isPresentMilestone } from "./milestone-kind";

const PRESENT_MANUAL_WORKING_DAYS_TO_NEXT = 1;

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
    bidSubmissionTimeSlot: step.bidSubmissionTimeSlot,
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
  if (isPresentMilestone(milestones[index].label)) {
    milestones[index].workingDaysToNext = PRESENT_MANUAL_WORKING_DAYS_TO_NEXT;
  }

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

export function recalculateWithManualAnchors(
  timeline: ScheduledTimeline,
  holidays: ReadonlySet<string>,
):
  | { kind: "ok"; timeline: ScheduledTimeline }
  | { kind: "conflict"; order: number | "process-end" } {
  const milestones = timeline.milestones.map((item) => ({ ...item }));
  if (!isWorkingDay(milestones[0].scheduledDate, holidays)) {
    return { kind: "conflict", order: 1 };
  }

  for (let index = 1; index < milestones.length; index += 1) {
    const previous = milestones[index - 1];
    const current = milestones[index];
    if (current.isDateManuallyAdjusted) {
      try {
        countWorkingDayAdditions(
          previous.scheduledDate,
          current.scheduledDate,
          holidays,
        );
      } catch {
        return { kind: "conflict", order: current.order };
      }
    } else {
      current.scheduledDate = addWorkingDays(
        previous.scheduledDate,
        previous.workingDaysToNext,
        holidays,
      );
    }
  }

  const last = milestones[milestones.length - 1];
  let processEndDate = timeline.processEndDate;
  if (timeline.isProcessEndManuallyAdjusted) {
    try {
      countWorkingDayAdditions(
        last.scheduledDate,
        timeline.processEndDate,
        holidays,
      );
    } catch {
      return { kind: "conflict", order: "process-end" };
    }
  } else {
    processEndDate = addWorkingDays(
      last.scheduledDate,
      last.workingDaysToNext,
      holidays,
    );
  }

  return {
    kind: "ok",
    timeline: {
      milestones,
      processEndDate,
      isProcessEndManuallyAdjusted: timeline.isProcessEndManuallyAdjusted,
    },
  };
}
