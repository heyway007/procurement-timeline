import { z } from "zod";
import { BUDGET_CATEGORIES, budgetCategoryFor, isProcurementMethod } from "./budget-category";
import { PROJECT_STATUS_TYPES } from "./project-status";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const createProjectSchema = z.object({
  name: z.string().trim().max(200).optional().default(""),
  ownerName: z.string().trim().max(120).optional().default(""),
  departmentName: z.string().trim().max(120).optional().default(""),
  budget: z.coerce.number().finite().min(1_000_000, "วงเงินจริงต้องไม่น้อยกว่า 1,000,000 บาท").optional(),
  budgetCategory: z.enum(BUDGET_CATEGORIES),
  projectStatusType: z.enum(PROJECT_STATUS_TYPES).default("SLA_COMPLIANT"),
  startDate: isoDateSchema,
  note: z.string().trim().max(2000).optional().default(""),
}).superRefine((value, context) => {
  if (value.budget === undefined) return;
  try {
    if (!isProcurementMethod(value.budgetCategory) && budgetCategoryFor(value.budget) !== value.budgetCategory) context.addIssue({ code: "custom", path: ["budgetCategory"], message: "ประเภทวงเงินไม่ตรงกับวงเงินจริง" });
  } catch {
    context.addIssue({ code: "custom", path: ["budget"], message: "วงเงินจริงต้องไม่น้อยกว่า 1,000,000 บาท" });
  }
});

export const listProjectsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const versionSchema = z.number().int().positive();

export const updateBidSubmissionTimeSchema = z.object({
  timeSlot: z.enum(["MORNING", "AFTERNOON"]),
  version: versionSchema,
});
