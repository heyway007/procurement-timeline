import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z.string().datetime();

export const googleDriveStepSchema = z.object({
  order: z.number().int().positive(),
  label: z.string(),
  workingDaysToNext: z.number().int().nonnegative(),
  scheduledDate: isoDateSchema.optional(),
  isDateManuallyAdjusted: z.boolean().optional(),
});

export const googleDriveTemplateSchema = z.object({
  key: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  steps: z.array(
    z.object({
      order: z.number().int().positive(),
      label: z.string(),
      workingDaysToNext: z.number().int().nonnegative(),
    }),
  ),
});

export const googleDriveProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerName: z.string(),
  departmentName: z.string().optional(),
  budget: z.number(),
  budgetCategory: z.enum([
    "ONE_TO_FIVE_MILLION",
    "FIVE_TO_TEN_MILLION",
    "TEN_TO_TWENTY_MILLION",
    "ABOVE_TWENTY_MILLION",
  ]),
  startDate: isoDateSchema,
  note: z.string(),
  templateKey: z.string(),
  templateVersion: z.number().int().positive(),
  processEndDate: isoDateSchema,
  isProcessEndManuallyAdjusted: z.boolean(),
  scheduleStatus: z.enum(["NORMAL", "NEEDS_REVIEW"]),
  version: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  steps: z.array(
    z.object({
      order: z.number().int().positive(),
      label: z.string(),
      workingDaysToNext: z.number().int().nonnegative(),
      scheduledDate: isoDateSchema,
      isDateManuallyAdjusted: z.boolean(),
    }),
  ),
});

export const googleDriveHolidaySchema = z.object({
  id: z.string(),
  date: isoDateSchema,
  name: z.string(),
  sourceNote: z.string(),
  scope: z.enum(["NATIONWIDE", "BANGKOK"]),
  origin: z.enum(["MANUAL", "OFFICIAL_SYNC"]),
  officialSourceUrl: z.string().nullable(),
  officialSourceLabel: z.string().nullable(),
  lastConfirmedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const googleDriveYearCoverageSchema = z.object({
  year: z.number().int(),
  isVerifiedComplete: z.boolean(),
  sourceNote: z.string(),
  verifiedAt: isoDateTimeSchema.nullable(),
  lastSyncAttemptAt: isoDateTimeSchema.nullable(),
  lastSuccessfulSyncAt: isoDateTimeSchema.nullable(),
  lastSyncStatus: z.enum(["FRESH", "CACHED", "FAILED"]).nullable(),
  lastSyncMessage: z.string().nullable(),
});

export const googleDriveDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  templates: z.array(googleDriveTemplateSchema),
  projects: z.array(googleDriveProjectSchema),
  holidays: z.array(googleDriveHolidaySchema),
  holidayCalendarYears: z.array(googleDriveYearCoverageSchema),
  updatedAt: isoDateTimeSchema,
});

export type GoogleDriveDocument = z.infer<typeof googleDriveDocumentSchema>;
