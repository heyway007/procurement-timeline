import type { BudgetCategory } from "@/lib/projects/budget-category";
import type { TemplateStep } from "./types";

export const APPROVED_TEMPLATE_KEY = "procurement-29m-v1";

export const APPROVED_TEMPLATE_STEPS = [
  {
    order: 1,
    workingDaysToNext: 4,
    label:
      "ส่วนงานพัสดุฯ จัดทำรายงานขอซื้อขอจ้าง + คำสั่งแต่งตั้งกรรมการ",
  },
  {
    order: 2,
    workingDaysToNext: 1,
    label: "ประกาศร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์",
  },
  {
    order: 3,
    workingDaysToNext: 3,
    label: "เผยแพร่ร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์",
  },
  {
    order: 4,
    workingDaysToNext: 4,
    label: "ส่วนงานพัสดุฯ จัดทำเอกสารประกาศ + ประกวดราคา",
  },
  {
    order: 5,
    workingDaysToNext: 1,
    label: "ประกาศประกวดราคาขึ้นบนเว็บไซต์กรมบัญชีกลาง",
  },
  {
    order: 6,
    workingDaysToNext: 5,
    label:
      "กำหนดขอรับ/ซื้อเอกสาร (ผู้สนใจสามารถดาวน์โหลดเอกสารจากเว็บไซต์กรมบัญชีกลาง)",
  },
  {
    order: 7,
    workingDaysToNext: 1,
    label:
      "กำหนดวันเสนอราคา (ตั้งแต่เวลา 8.30 น. - 12.00 น.) ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น",
  },
  {
    order: 8,
    workingDaysToNext: 1,
    label: "ตรวจสอบเอกสารเสนอราคา (8.30 น. - 12.00 น.)",
  },
  {
    order: 9,
    workingDaysToNext: 1,
    label: "กำหนดวันเวลาในการ Present (เลือกวันใดวันหนึ่ง)",
  },
  {
    order: 10,
    workingDaysToNext: 4,
    label: "คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ + ต่อรองราคา",
  },
  {
    order: 11,
    workingDaysToNext: 4,
    label:
      "ส่วนงานพัสดุฯ จัดทำเอกสารรายงานผลการพิจารณา + ประกาศผู้ชนะ",
  },
  {
    order: 12,
    workingDaysToNext: 1,
    label: "ประกาศผู้ชนะบนเว็บไซต์",
  },
  {
    order: 13,
    workingDaysToNext: 7,
    label:
      "ระยะเวลาอุทธรณ์และติดต่อให้ผู้รับจ้างนำส่งเอกสารเพื่อทำสัญญาและวางหลักประกันสัญญา",
  },
] satisfies TemplateStep[];

export function approvedTemplateStepsForBudgetCategory(
  budgetCategory: BudgetCategory,
): TemplateStep[] {
  if (budgetCategory === "ONE_TO_FIVE_MILLION") {
    return smallBudgetTemplateSteps();
  }
  if (budgetCategory !== "FIVE_TO_TEN_MILLION") {
    return APPROVED_TEMPLATE_STEPS;
  }
  return APPROVED_TEMPLATE_STEPS.map((step) =>
    step.order === 6 ? { ...step, workingDaysToNext: 10 } : step,
  );
}

function smallBudgetTemplateSteps(): TemplateStep[] {
  return [
    stepFromApprovedTemplate(1, 1),
    stepFromApprovedTemplate(2, 4),
    stepFromApprovedTemplate(3, 5),
    stepFromApprovedTemplate(4, 6),
    stepFromApprovedTemplate(5, 7),
    stepFromApprovedTemplate(6, 8),
    stepFromApprovedTemplate(7, 9),
    stepFromApprovedTemplate(8, 10),
    stepFromApprovedTemplate(9, 11),
    stepFromApprovedTemplate(10, 12),
    stepFromApprovedTemplate(11, 13),
  ];
}

function stepFromApprovedTemplate(order: number, approvedOrder: number): TemplateStep {
  const source = APPROVED_TEMPLATE_STEPS.find((step) => step.order === approvedOrder);
  if (!source) throw new Error("APPROVED_TEMPLATE_STEP_NOT_FOUND");
  return { ...source, order };
}
