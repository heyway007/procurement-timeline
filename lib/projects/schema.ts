import { z } from "zod";
import { BUDGET_CATEGORIES, budgetCategoryFor } from "./budget-category";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อโครงการ").max(200),
  ownerName: z.string().trim().min(1, "กรุณาระบุผู้รับผิดชอบ").max(120),
  departmentName: z.string().trim().max(120).optional().default(""),
  budget: z.coerce.number().finite().min(1_000_000, "วงเงินจริงต้องไม่น้อยกว่า 1,000,000 บาท"),
  budgetCategory: z.enum(BUDGET_CATEGORIES),
  startDate: isoDateSchema,
  note: z.string().trim().max(2000).optional().default(""),
}).superRefine((value, context) => {
  try {
    if (budgetCategoryFor(value.budget) !== value.budgetCategory) context.addIssue({ code: "custom", path: ["budgetCategory"], message: "ประเภทวงเงินไม่ตรงกับวงเงินจริง" });
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
