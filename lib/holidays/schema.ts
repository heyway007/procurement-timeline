import { z } from "zod";
import { isoDateSchema } from "@/lib/projects/schema";

const holidayInputSchema = z.object({
  date: isoDateSchema,
  name: z.string().trim().min(1, "กรุณาระบุชื่อวันหยุด").max(200),
  sourceNote: z.string().trim().min(1, "กรุณาระบุแหล่งอ้างอิง").max(1000),
});

export const holidayMutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), holiday: holidayInputSchema }),
  z.object({
    operation: z.literal("update"),
    id: z.string().uuid(),
    previousDate: isoDateSchema,
    holiday: holidayInputSchema,
  }),
  z.object({
    operation: z.literal("delete"),
    id: z.string().uuid(),
    date: isoDateSchema,
  }),
]);
