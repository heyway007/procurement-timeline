export type TemplateStep = {
  order: number;
  label: string;
  workingDaysToNext: number;
};

export type ScheduledMilestone = TemplateStep & {
  scheduledDate: string;
  isDateManuallyAdjusted: boolean;
};

export type ScheduledTimeline = {
  milestones: ScheduledMilestone[];
  processEndDate: string;
  isProcessEndManuallyAdjusted: boolean;
};
