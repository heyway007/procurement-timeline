import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อโครงการ").max(200),
  ownerName: z.string().trim().min(1, "กรุณาระบุผู้รับผิดชอบ").max(120),
  budget: z.coerce.number().finite().min(0, "วงเงินต้องไม่ติดลบ"),
  startDate: isoDateSchema,
  note: z.string().trim().max(2000).optional().default(""),
});

export const listProjectsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const versionSchema = z.number().int().positive();
