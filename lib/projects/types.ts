import type { ScheduledMilestone } from "@/lib/schedule/types";

export type ScheduleStatus = "NORMAL" | "NEEDS_REVIEW";

export type ProjectRecord = {
  id: string;
  name: string;
  ownerName: string;
  budget: number;
  startDate: string;
  note: string;
  templateKey: string;
  templateVersion: number;
  processEndDate: string;
  isProcessEndManuallyAdjusted: boolean;
  scheduleStatus: ScheduleStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  steps: ScheduledMilestone[];
};

export type NewProjectRecord = Omit<
  ProjectRecord,
  "id" | "version" | "createdAt" | "updatedAt"
>;

export type ProjectReplacement = Omit<
  ProjectRecord,
  "id" | "version" | "createdAt" | "updatedAt"
>;

export type ListProjectsFilter = {
  query?: string;
  from?: string;
  to?: string;
};

export type CreateProjectInput = {
  name: string;
  ownerName: string;
  budget: number;
  startDate: string;
  note?: string;
};

export type AdjustStepInput = {
  order: number;
  newDate: string;
  version: number;
  confirmShortening: boolean;
  confirmOverwrite: boolean;
};

export type UpdateProjectInput = CreateProjectInput & {
  version: number;
  confirmReset: boolean;
};
