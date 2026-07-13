import type { ScheduledMilestone } from "@/lib/schedule/types";
import type { BidSubmissionTimeSlot } from "@/lib/schedule/milestone-kind";
import type { BudgetCategory } from "./budget-category";

export type ScheduleStatus = "NORMAL" | "NEEDS_REVIEW";

export type ProjectRecord = {
  id: string;
  name: string;
  ownerName: string;
  departmentName?: string;
  budget: number;
  budgetCategory: BudgetCategory;
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
  departmentName?: string;
  budget: number;
  budgetCategory: BudgetCategory;
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

export type UpdateBidSubmissionTimeInput = {
  timeSlot: BidSubmissionTimeSlot;
  version: number;
};

export type UpdateProjectInput = CreateProjectInput & {
  version: number;
  confirmReset: boolean;
};
